import { BaseSource } from './base-source.js';
import { NormalizedStory } from '../types/index.js';
import { fetchWithRetry, runConcurrent } from '../utils/rate-limiter.js';
import { generateStoryHash, extractDomain, getFaviconUrl } from '../utils/hash.js';
import { logger } from '../utils/logger.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sourcesConfig = JSON.parse(readFileSync(join(__dirname, '../../config/sources.json'), 'utf-8')) as SourcesConfig;

interface SourcesConfig {
  hackernews: { min_score: number; max_stories: number; keywords?: string[]; ai_keywords?: string[] };
}

const HN_API = 'https://hacker-news.firebaseio.com/v0';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class HackerNewsSource extends BaseSource {
  readonly sourceName = 'hackernews' as const;

  protected async fetchStories(): Promise<NormalizedStory[]> {
    // Fetch top story IDs
    const idsRes = await fetchWithRetry(`${HN_API}/topstories.json`);
    if (!idsRes.ok) throw new Error(`HN top stories: ${idsRes.status}`);
    const allIds: number[] = await idsRes.json();

    // Take top 100 candidates
    const candidateIds = allIds.slice(0, sourcesConfig.hackernews.max_stories);

    // Fetch items in parallel (10 concurrent)
    const items = await runConcurrent(
      candidateIds.map(id => () => this.fetchItem(id)),
      10
    );

    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const keywords = sourcesConfig.hackernews.keywords ?? sourcesConfig.hackernews.ai_keywords ?? [];
    const minScore = sourcesConfig.hackernews.min_score;

    return items
      .filter((item): item is HNItem =>
        item !== null &&
        item.url !== undefined &&
        item.score >= minScore &&
        item.time * 1000 > cutoff &&
        this.isRelevant(item.title, keywords)
      )
      .map(item => this.normalize(item));
  }

  private async fetchItem(id: number): Promise<HNItem | null> {
    try {
      const res = await fetchWithRetry(`${HN_API}/item/${id}.json`, {
        timeoutMs: 10_000,
        maxRetries: 1,
      });
      if (!res.ok) return null;
      return await res.json() as HNItem;
    } catch {
      return null;
    }
  }

  private isRelevant(title: string, keywords: string[]): boolean {
    const lower = title.toLowerCase();
    return keywords.some(kw => lower.includes(kw));
  }

  private normalize(item: HNItem): NormalizedStory {
    const url = item.url ?? `https://news.ycombinator.com/item?id=${item.id}`;
    const domain = extractDomain(url);

    return {
      url,
      title: item.title,
      raw_summary: undefined,
      source_name: 'Hacker News',
      source_domain: 'news.ycombinator.com',
      source_favicon_url: getFaviconUrl('news.ycombinator.com'),
      engagement_stats: { hn_points: item.score, hn_comments: item.descendants ?? 0 },
      published_at: new Date(item.time * 1000).toISOString(),
      content_hash: generateStoryHash(url, item.title),
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetchWithRetry(`${HN_API}/topstories.json`, { maxRetries: 0, timeoutMs: 5_000 });
      return res.ok;
    } catch {
      return false;
    }
  }
}

interface HNItem {
  id: number;
  title: string;
  url?: string;
  score: number;
  time: number;
  descendants?: number;
  by: string;
}
