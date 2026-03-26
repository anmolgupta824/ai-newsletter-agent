import 'dotenv/config';
import { CLIOptions, SourceName, NormalizedStory } from './types/index.js';
import { HackerNewsSource } from './sources/hackernews.js';
import { ProductHuntSource } from './sources/producthunt.js';
import { GitHubTrendingSource } from './sources/github-trending.js';
import { RSSSource } from './sources/rss.js';
import { TavilySource } from './sources/tavily.js';
import { AnthropicSource } from './sources/anthropic.js';
import { BaseSource } from './sources/base-source.js';
import { scoreStories } from './curation/score.js';
import { summarizeStories } from './curation/summarize.js';
import { generateEditorial } from './curation/editorial.js';
import { fetchOgImagesBatch } from './utils/og-image.js';
import { getOrCreateDigest, getExistingHashes, storeStories, saveEditorial, publishDigest, logRun, getRecentRunLogs, getDigestStats } from './db/operations.js';
import { logger, setVerbose } from './utils/logger.js';

// --- CLI ---

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    dryRun: false,
    source: null,
    verbose: false,
    status: false,
    healthCheck: false,
    summarize: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--source':
        options.source = (args[++i] ?? null) as SourceName | null;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--status':
        options.status = true;
        break;
      case '--health-check':
        options.healthCheck = true;
        break;
      case '--summarize':
        options.summarize = true;
        options.dryRun = true;  // --summarize implies --dry-run
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
AI Digest Agent

Usage:
  npm run digest:generate              # Full pipeline
  npm run digest:generate -- --dry-run # Preview, don't save
  npm run digest:generate -- --source hackernews  # Single source
  npm run digest:status                # Show recent digests
  npm run digest:health-check          # Ping all source APIs

Options:
  --dry-run       Fetch and score but don't write to database
  --source <name> Only run one source: hackernews | producthunt | github | rss | tavily | anthropic
  --verbose       Enable debug logging
  --help          Show this message
`);
}

// --- Sources ---

function getAllSources(): BaseSource[] {
  return [
    new HackerNewsSource(),
    new ProductHuntSource(),
    new GitHubTrendingSource(),
    new RSSSource(),
    new TavilySource(),
    new AnthropicSource(),
  ];
}

// --- Pipeline ---

async function runPipeline(options: CLIOptions): Promise<void> {
  const start = Date.now();
  logger.info('AI Digest Agent starting', {
    dryRun: options.dryRun,
    source: options.source,
  });

  // 1. Determine week
  const { getWeekOf } = await import('./db/operations.js');
  const weekOf = getWeekOf();
  logger.info(`Week of: ${weekOf}`);

  // 2. Get or create digest record (skip if dry run)
  let digestId = 'dry-run';
  let issueNumber = 0;
  if (!options.dryRun) {
    const digest = await getOrCreateDigest(weekOf);
    digestId = digest.id;
    issueNumber = digest.issue_number;
    logger.info(`Digest #${issueNumber}`, { id: digestId });
  }

  // 3. Get existing hashes for dedup
  const existingHashes = options.dryRun ? new Set<string>() : await getExistingHashes(weekOf);
  logger.info(`${existingHashes.size} stories already stored this week`);

  // 4. Run sources (fault isolated — each source runs independently)
  const sources = getAllSources().filter(s =>
    options.source === null || s.sourceName === options.source
  );

  const sourceResults = await Promise.all(sources.map(s => s.run()));

  const availableSources = sourceResults.filter(r => r.stories.length > 0 || !r.error).length;
  const failedSources = sourceResults.filter(r => r.error).length;

  if (failedSources > 0) {
    logger.warn(`${failedSources} source(s) failed`, {
      failed: sourceResults.filter(r => r.error).map(r => `${r.source}: ${r.error}`),
    });
  }

  // Check if too many sources are down (3+ = skip run)
  if (availableSources < 2 && sources.length > 2) {
    logger.error('Too many sources failed — aborting pipeline');
    await logRun({
      run_type: 'generate',
      status: 'skipped',
      sources_available: availableSources,
      stories_collected: 0,
      tokens_used: 0,
      cost_estimate: 0,
      error_message: `Only ${availableSources}/${sources.length} sources available`,
    });
    process.exit(1);
  }

  // 5. Merge + dedup
  const allStories: NormalizedStory[] = [];
  const seenHashes = new Set<string>(existingHashes);

  for (const result of sourceResults) {
    for (const story of result.stories) {
      if (!seenHashes.has(story.content_hash)) {
        seenHashes.add(story.content_hash);
        allStories.push(story);
      }
    }
  }

  const totalCollected = sourceResults.reduce((n, r) => n + r.stories.length, 0);
  logger.info(`Collected ${totalCollected} stories → ${allStories.length} after dedup`);

  if (allStories.length === 0) {
    logger.warn('No new stories collected');
    return;
  }

  // 6. Fetch OG images in parallel
  logger.info('Fetching OG images...');
  const ogImages = await fetchOgImagesBatch(allStories.map(s => s.url));
  for (let i = 0; i < allStories.length; i++) {
    if (ogImages[i]) allStories[i] = { ...allStories[i], og_image_url: ogImages[i] };
  }
  const ogImageCount = ogImages.filter(Boolean).length;
  logger.info(`OG images: ${ogImageCount}/${allStories.length} found`);

  // 7. AI Scoring (batch)
  const tokenUsage = { totalTokensUsed: 0, capReached: false };
  const scoredStories = await scoreStories(allStories, tokenUsage);

  logger.info(`Scored: ${scoredStories.length} candidates`, {
    ai_selected: scoredStories.filter(s => s.ai_selected).length,
  });

  if (options.dryRun) {
    if (options.summarize && scoredStories.length > 0) {
      logger.info('Running summarization (--summarize flag)...');
      const summarized = await summarizeStories(scoredStories, tokenUsage);
      printDryRunSummary(summarized, sourceResults, true);
    } else {
      printDryRunSummary(scoredStories, sourceResults, false);
    }
    return;
  }

  // 8. AI Summarization (only top candidates)
  const summarizedStories = await summarizeStories(scoredStories, tokenUsage);

  // 9. Generate editorial
  logger.info('Generating editorial...');
  const editorial = await generateEditorial(summarizedStories);
  if (editorial) {
    await saveEditorial(digestId, editorial);
    logger.info('Editorial saved');
  }

  // 10. Store to Supabase
  const stored = await storeStories(summarizedStories, digestId, weekOf);

  // 11. Auto-publish
  await publishDigest(digestId);
  logger.info(`Digest #${issueNumber} published`);

  // 12. Log run
  const costEstimate = tokenUsage.totalTokensUsed * 0.000000375; // avg gpt-4o-mini cost
  await logRun({
    run_type: 'generate',
    status: failedSources > 0 ? 'partial' : 'success',
    sources_available: availableSources,
    stories_collected: stored,
    tokens_used: tokenUsage.totalTokensUsed,
    cost_estimate: costEstimate,
  });

  // 13. Print summary
  const duration = Date.now() - start;
  printSummary({
    issueNumber,
    weekOf,
    sourceResults,
    totalCollected: allStories.length,
    scored: scoredStories.length,
    stored,
    tokensUsed: tokenUsage.totalTokensUsed,
    costEstimate,
    tokenCapReached: tokenUsage.capReached,
    duration,
  });
}

// --- Health Check ---

async function runHealthCheck(sourceFilter: SourceName | null): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('  AI Digest Agent — Health Check');
  console.log('='.repeat(60));

  const sources = getAllSources().filter(s =>
    sourceFilter === null || s.sourceName === sourceFilter
  );

  let passed = 0;
  let failed = 0;

  for (const source of sources) {
    const ok = await source.healthCheck();
    const status = ok ? 'OK  ' : 'FAIL';
    console.log(`  ${status}  ${source.sourceName}`);
    if (ok) passed++; else failed++;
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`  ${passed} passed, ${failed} failed out of ${sources.length} sources`);
  console.log('='.repeat(60) + '\n');

  if (failed > 0) process.exit(1);
}

// --- Status ---

async function showStatus(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('  AI Digest Agent — Status');
  console.log('='.repeat(60));

  const stats = await getDigestStats();
  console.log(`\n  Digests:`);
  console.log(`    Published: ${stats.published}`);
  console.log(`    Draft:     ${stats.draft}`);
  console.log(`    Total stories: ${stats.total_stories}`);
  if (stats.latest_issue) {
    console.log(`    Latest issue: #${stats.latest_issue}`);
  }

  const logs = await getRecentRunLogs(5);
  if (logs.length > 0) {
    console.log(`\n  Recent Runs:`);
    for (const log of logs) {
      const created = new Date(log.created_at as string);
      const timeAgo = getTimeAgo(created);
      const status = log.status === 'success' ? 'OK  ' : log.status === 'partial' ? 'WARN' : 'FAIL';
      console.log(`    ${status}  ${timeAgo}  ${log.stories_collected} stories  ${log.sources_available}/6 sources  ~$${(log.cost_estimate as number).toFixed(4)}`);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// --- Display helpers ---

function printDryRunSummary(
  scored: import('./types/index.js').ScoredStory[],
  sourceResults: import('./types/index.js').SourceResult[],
  withSummaries = false
): void {
  console.log('\n' + '='.repeat(60));
  console.log('  AI Digest Agent — Dry Run Preview');
  console.log('='.repeat(60));

  console.log('\n  Sources:');
  for (const r of sourceResults) {
    const status = r.error ? 'FAIL' : 'OK  ';
    console.log(`    ${status}  ${r.source}  ${r.stories.length} stories  (${(r.duration / 1000).toFixed(1)}s)`);
  }

  console.log(`\n  Candidates (score >= 30): ${scored.length}`);
  console.log(`  Auto-selected (top 5/section): ${scored.filter(s => s.ai_selected).length}`);

  if (withSummaries) {
    console.log('\n' + '-'.repeat(60));
    console.log('  Full AI Output (scored + summarized):');
    console.log('-'.repeat(60));
    for (const s of scored) {
      const selected = s.ai_selected ? '⭐' : '  ';
      console.log(`\n${selected} [${s.ai_score}/50] [${s.category}] ${s.source_name}`);
      console.log(`  Headline:       ${s.headline ?? s.title}`);
      console.log(`  Summary:        ${s.summary ?? s.raw_summary ?? '(none)'}`);
      console.log(`  Why it matters: ${s.why_it_matters ?? '(none)'}`);
      console.log(`  URL:            ${s.url}`);
    }
  } else {
    const top10 = scored.slice(0, 10);
    if (top10.length > 0) {
      console.log('\n  Top 10 stories:');
      for (const s of top10) {
        const selected = s.ai_selected ? '⭐' : '  ';
        console.log(`    ${selected} [${s.ai_score}/50] [${s.category.padEnd(10)}] ${s.title.slice(0, 60)}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

function printSummary(params: {
  issueNumber: number;
  weekOf: string;
  sourceResults: import('./types/index.js').SourceResult[];
  totalCollected: number;
  scored: number;
  stored: number;
  tokensUsed: number;
  costEstimate: number;
  tokenCapReached: boolean;
  duration: number;
}): void {
  console.log('\n' + '='.repeat(60));
  console.log('  AI Digest Agent — Pipeline Complete');
  console.log('='.repeat(60));
  console.log(`\n  Issue #${params.issueNumber} (Week of ${params.weekOf})`);

  console.log('\n  Sources:');
  for (const r of params.sourceResults) {
    const status = r.error ? 'FAIL' : 'OK  ';
    console.log(`    ${status}  ${r.source}  ${r.stories.length} stories  (${(r.duration / 1000).toFixed(1)}s)`);
  }

  console.log('\n  Results:');
  console.log(`    Collected:  ${params.totalCollected} stories`);
  console.log(`    Scored:     ${params.scored} candidates`);
  console.log(`    Stored:     ${params.stored} to Supabase`);

  console.log('\n  Cost:');
  console.log(`    Tokens:  ${params.tokensUsed.toLocaleString()}`);
  console.log(`    Cost:    ~$${params.costEstimate.toFixed(4)}`);
  if (params.tokenCapReached) {
    console.log(`    ⚠️  Token cap (50K) reached — some stories may not be summarized`);
  }

  console.log(`\n  Duration: ${(params.duration / 1000).toFixed(1)}s`);
  console.log('='.repeat(60) + '\n');
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// --- Entry point ---

async function main(): Promise<void> {
  const options = parseArgs();
  setVerbose(options.verbose);

  if (options.status) {
    await showStatus();
    return;
  }

  if (options.healthCheck) {
    await runHealthCheck(options.source);
    return;
  }

  await runPipeline(options);
}

main().catch(err => {
  logger.error('Fatal error', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
