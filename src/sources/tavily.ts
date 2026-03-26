import { BaseSource } from './base-source.js';
import { NormalizedStory } from '../types/index.js';
import { fetchWithRetry } from '../utils/rate-limiter.js';
import { generateStoryHash, extractDomain, getFaviconUrl } from '../utils/hash.js';
import { logger } from '../utils/logger.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sourcesConfig = JSON.parse(readFileSync(join(__dirname, '../../config/sources.json'), 'utf-8')) as SourcesConfig;

interface SourcesConfig {
  tavily_queries: string[];
}

const TAVILY_API = 'https://api.tavily.com/search';

export class TavilySource extends BaseSource {
  readonly sourceName = 'tavily' as const;

  protected async fetchStories(): Promise<NormalizedStory[]> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      logger.warn('TAVILY_API_KEY not set — skipping Tavily source');
      return [];
    }

    const queries = sourcesConfig.tavily_queries;
    const allStories: NormalizedStory[] = [];
    const seenUrls = new Set<string>();

    for (const query of queries) {
      try {
        const stories = await this.searchTavily(query, apiKey);
        for (const story of stories) {
          if (!seenUrls.has(story.url)) {
            seenUrls.add(story.url);
            allStories.push(story);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`Tavily query failed: "${query}"`, { error: msg });
      }
    }

    return allStories;
  }

  private async searchTavily(query: string, apiKey: string): Promise<NormalizedStory[]> {
    const res = await fetchWithRetry(TAVILY_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: 5,
        include_raw_content: false,
        days: 7,  // last 7 days
      }),
    });

    if (!res.ok) {
      throw new Error(`Tavily API: ${res.status} ${res.statusText}`);
    }

    const json = await res.json() as TavilyResponse;

    return (json.results ?? []).map(result => this.normalize(result));
  }

  private normalize(result: TavilyResult): NormalizedStory {
    const domain = extractDomain(result.url);

    return {
      url: result.url,
      title: result.title,
      raw_summary: result.content,
      source_name: this.getSourceName(domain),
      source_domain: domain,
      source_favicon_url: getFaviconUrl(domain),
      engagement_stats: { tavily_score: Math.round((result.score ?? 0.5) * 100) },
      published_at: result.published_date ?? new Date().toISOString(),
      content_hash: generateStoryHash(result.url, result.title),
    };
  }

  private getSourceName(domain: string): string {
    const knownSources: Record<string, string> = {
      'techcrunch.com': 'TechCrunch',
      'wired.com': 'Wired',
      'venturebeat.com': 'VentureBeat',
      'theverge.com': 'The Verge',
      'thenextweb.com': 'The Next Web',
      'reuters.com': 'Reuters',
      'bloomberg.com': 'Bloomberg',
      'forbes.com': 'Forbes',
    };
    return knownSources[domain] ?? domain;
  }

  async healthCheck(): Promise<boolean> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return false;

    try {
      const res = await fetchWithRetry(TAVILY_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ query: 'AI', max_results: 1, search_depth: 'basic' }),
        maxRetries: 0,
        timeoutMs: 5_000,
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

interface TavilyResult {
  url: string;
  title: string;
  content: string;
  score?: number;
  published_date?: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
}
