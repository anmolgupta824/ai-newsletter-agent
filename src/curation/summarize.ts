import { getOpenRouterClient, CURATION_MODELS } from './client.js';
import { buildSummarizePrompt } from './prompt.js';
import { ScoredStory, StoryCategory } from '../types/index.js';
import { SCORING } from '../config/scoring.js';
import { logger } from '../utils/logger.js';
import { sleep } from '../utils/rate-limiter.js';

const MAX_RETRIES = 2;
const DELAY_BETWEEN_CALLS_MS = 300;

interface TokenUsage {
  totalTokensUsed: number;
  capReached: boolean;
}

interface SummarizeResult {
  headline: string;
  summary: string;
  why_it_matters: string;
  category: StoryCategory;
}

/**
 * Write AI summaries for scored stories.
 * Only processes top N stories (cost control).
 * Stories that fail summarization keep their original title/snippet.
 */
export async function summarizeStories(
  stories: ScoredStory[],
  tokenUsage: TokenUsage
): Promise<ScoredStory[]> {
  if (stories.length === 0) return [];

  // Only summarize top N (sorted by score already)
  const toSummarize = stories.slice(0, SCORING.MAX_TO_SUMMARIZE);
  const noSummarize = stories.slice(SCORING.MAX_TO_SUMMARIZE);

  logger.info(`Summarizing ${toSummarize.length} stories`);

  const results: ScoredStory[] = [];

  for (const story of toSummarize) {
    if (tokenUsage.totalTokensUsed >= SCORING.TOKEN_CAP) {
      logger.warn('Token cap reached during summarization — stopping', {
        used: tokenUsage.totalTokensUsed,
        remaining: toSummarize.length - results.length,
      });
      tokenUsage.capReached = true;
      // Push remaining stories without summaries
      results.push(...toSummarize.slice(results.length));
      break;
    }

    const summarized = await summarizeSingle(story, tokenUsage);
    results.push(summarized);

    // Small delay between calls
    await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  return [...results, ...noSummarize];
}

async function summarizeSingle(
  story: ScoredStory,
  tokenUsage: TokenUsage
): Promise<ScoredStory> {
  const client = getOpenRouterClient();
  const prompt = buildSummarizePrompt(story, story.category);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    for (const model of CURATION_MODELS) {
      try {
        const response = await client.chat.completions.create({
          model,
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        });

        const tokens = response.usage?.total_tokens ?? 0;
        tokenUsage.totalTokensUsed += tokens;
        logger.debug('Summarize tokens', { tokens, total: tokenUsage.totalTokensUsed, model, title: story.title.slice(0, 50) });

        const content = response.choices[0]?.message?.content?.trim() ?? '';
        const result = parseSummarizeResult(content);

        if (result) {
          return {
            ...story,
            headline: result.headline,
            summary: result.summary,
            why_it_matters: result.why_it_matters,
            category: result.category,
          };
        }
      } catch (err) {
        if (String(err).includes('429')) {
          logger.warn('Rate limited during summarize, waiting');
          await sleep(60_000);
        }
        // Try next model
      }
    }
    if (attempt < MAX_RETRIES - 1) await sleep(2_000);
  }

  // Fallback: use original title/snippet
  logger.warn('Summarize failed, using original', { title: story.title.slice(0, 50) });
  return {
    ...story,
    headline: story.title,
    summary: story.raw_summary ?? story.title,
    why_it_matters: undefined,
  };
}

function parseSummarizeResult(content: string): SummarizeResult | null {
  try {
    const json = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const parsed = JSON.parse(json);

    if (
      typeof parsed.headline === 'string' &&
      typeof parsed.summary === 'string' &&
      typeof parsed.why_it_matters === 'string'
    ) {
      return {
        headline: parsed.headline,
        summary: parsed.summary,
        why_it_matters: parsed.why_it_matters,
        category: (parsed.category as StoryCategory) ?? 'launch',
      };
    }
    return null;
  } catch {
    return null;
  }
}
