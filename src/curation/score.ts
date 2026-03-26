import { getOpenRouterClient, CURATION_MODELS } from './client.js';
import { buildScoringPrompt } from './prompt.js';
import { NormalizedStory, ScoredStory, StoryCategory } from '../types/index.js';
import { SCORING } from '../config/scoring.js';
import { logger } from '../utils/logger.js';
import { sleep } from '../utils/rate-limiter.js';

const MAX_RETRIES = 3;
const RETRY_WAIT_MS = 15_000;

interface ScoreResult {
  index: number;
  relevance: number;
  signal: number;
  freshness: number;
  credibility: number;
  engagement: number;
  total: number;
  category: StoryCategory;
}

interface TokenUsage {
  totalTokensUsed: number;
  capReached: boolean;
}

/**
 * Score all stories in one batch AI call.
 * Returns ScoredStory[] with scores populated.
 * Stories below CANDIDATE_THRESHOLD are filtered out.
 */
export async function scoreStories(
  stories: NormalizedStory[],
  tokenUsage: TokenUsage
): Promise<ScoredStory[]> {
  if (stories.length === 0) return [];

  if (tokenUsage.totalTokensUsed >= SCORING.TOKEN_CAP) {
    logger.warn('Token cap reached before scoring', { used: tokenUsage.totalTokensUsed });
    return [];
  }

  logger.info(`Scoring ${stories.length} stories`);

  const client = getOpenRouterClient();
  const prompt = buildScoringPrompt(stories);
  let scoreResults: ScoreResult[] = [];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    for (const model of CURATION_MODELS) {
      try {
        const response = await client.chat.completions.create({
          model,
          max_tokens: 8000,  // 92 stories × ~80 tokens/score = ~7400 tokens needed
          messages: [{ role: 'user', content: prompt }],
        });

        // Track token usage
        const tokens = response.usage?.total_tokens ?? 0;
        tokenUsage.totalTokensUsed += tokens;
        logger.debug('Scoring tokens used', { tokens, total: tokenUsage.totalTokensUsed, model });

        if (tokenUsage.totalTokensUsed >= SCORING.TOKEN_CAP) {
          logger.warn('Token cap reached during scoring', {
            used: tokenUsage.totalTokensUsed,
            cap: SCORING.TOKEN_CAP,
          });
          tokenUsage.capReached = true;
        }

        const content = response.choices[0]?.message?.content?.trim() ?? '';
        scoreResults = parseScoreResults(content);

        if (scoreResults.length > 0) {
          logger.info(`Scored ${scoreResults.length} stories`, { model });
          break; // Success — stop trying models
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Rate limited — wait and retry
        if (String(err).includes('429')) {
          logger.warn('Rate limited, waiting 60s');
          await sleep(RETRY_WAIT_MS * 4);
        }
      }
    }
    if (scoreResults.length > 0) break;
    if (attempt < MAX_RETRIES - 1) await sleep(RETRY_WAIT_MS);
  }

  if (scoreResults.length === 0) {
    logger.error('Scoring failed after all retries', { error: lastError?.message });
    // Fall back: assign default scores so pipeline continues
    return stories.map(story => ({
      ...story,
      ai_score: 0,
      score_breakdown: { relevance: 0, signal: 0, freshness: 0, credibility: 0, engagement: 0 },
      category: 'launch' as StoryCategory,
      ai_selected: false,
    }));
  }

  // Merge scores back into stories
  const scored: ScoredStory[] = [];
  for (const result of scoreResults) {
    const story = stories[result.index];
    if (!story) continue;
    if (result.total < SCORING.CANDIDATE_THRESHOLD) continue; // Below threshold — skip

    scored.push({
      ...story,
      ai_score: result.total,
      score_breakdown: {
        relevance: result.relevance,
        signal: result.signal,
        freshness: result.freshness,
        credibility: result.credibility,
        engagement: result.engagement,
      },
      category: result.category,
      ai_selected: false, // overwritten below by per-section auto-selection
    });
  }

  logger.info(`${scored.length} stories above threshold (${SCORING.CANDIDATE_THRESHOLD}+)`, {
    total_scored: scoreResults.length,
    ai_selected: scored.filter(s => s.ai_selected).length,
  });

  // Sort by score descending
  scored.sort((a, b) => b.ai_score - a.ai_score);

  const N = SCORING.STORIES_PER_SECTION;
  const selected = new Set<number>();
  const countByCategory: Record<string, number> = {};

  // Pass 1 — fill top_story with AI-assigned top_story stories (respects AI categorization)
  for (let i = 0; i < scored.length && (countByCategory['top_story'] ?? 0) < N; i++) {
    if (scored[i].category === 'top_story') {
      selected.add(i);
      countByCategory['top_story'] = (countByCategory['top_story'] ?? 0) + 1;
    }
  }

  // Pass 2 — fill launch, pm_corner, stat (top N each, skip already-selected)
  for (let i = 0; i < scored.length; i++) {
    if (selected.has(i)) continue;
    const cat = scored[i].category;
    if (cat === 'top_story') continue; // Already handled above
    const count = countByCategory[cat] ?? 0;
    if (count < N) {
      selected.add(i);
      countByCategory[cat] = count + 1;
    }
  }

  const result = scored.map((s, i) => ({ ...s, ai_selected: selected.has(i) }));

  logger.info(`Auto-selected ${selected.size} stories`, { by_category: countByCategory });

  return result;
}

function parseScoreResults(content: string): ScoreResult[] {
  try {
    // Strip markdown code blocks if present
    const json = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) return [];

    const cap = (n: number, max: number) => Math.min(Math.max(Math.round(n), 0), max);

    return parsed.filter(item =>
      typeof item.index === 'number' &&
      typeof item.total === 'number' &&
      typeof item.category === 'string'
    ).map(item => {
      const relevance  = cap(Number(item.relevance)  || 0, 10);
      const signal     = cap(Number(item.signal)     || 0, 10);
      const freshness  = cap(Number(item.freshness)  || 0, 10);
      const credibility = cap(Number(item.credibility) || 0, 10);
      const engagement = cap(Number(item.engagement) || 0, 10);
      // Recompute total from capped criteria (don't trust AI's total)
      const total = relevance + signal + freshness + credibility + engagement;
      return {
        index: item.index,
        relevance, signal, freshness, credibility, engagement, total,
        category: (item.category as StoryCategory) || 'launch',
      };
    });
  } catch (err) {
    logger.error('Failed to parse score results', { content: content.slice(0, 200), error: String(err) });
    return [];
  }
}
