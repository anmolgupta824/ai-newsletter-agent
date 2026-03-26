import { BaseSource } from './base-source.js';
import { NormalizedStory } from '../types/index.js';
import { generateStoryHash, extractDomain, getFaviconUrl } from '../utils/hash.js';
import { fetchWithRetry } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sourcesConfig = JSON.parse(readFileSync(join(__dirname, '../../config/sources.json'), 'utf-8')) as SourcesConfig;

interface SourcesConfig {
  rss_feeds: { name: string; url: string; source_name: string }[];
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class RSSSource extends BaseSource {
  readonly sourceName = 'rss' as const;

  protected async fetchStories(): Promise<NormalizedStory[]> {
    // Import rss-parser dynamically (ESM)
    const { default: Parser } = await import('rss-parser');
    const parser = new Parser({ timeout: 15_000 });

    const feeds = sourcesConfig.rss_feeds;
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const allStories: NormalizedStory[] = [];

    for (const feed of feeds) {
      try {
        const result = await parser.parseURL(feed.url);
        const stories = (result.items ?? [])
          .filter(item => {
            if (!item.link || !item.title) return false;
            const date = new Date(item.isoDate ?? item.pubDate ?? 0).getTime();
            return date > cutoff;
          })
          .map(item => this.normalize(item, feed.source_name));

        logger.debug(`RSS ${feed.name}: ${stories.length} recent items`);
        allStories.push(...stories);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`RSS feed failed: ${feed.name}`, { error: msg });
        // Continue with other feeds — one failure doesn't kill RSS source
      }
    }

    return allStories;
  }

  private normalize(item: RSSItem, sourceName: string): NormalizedStory {
    const url = item.link!;
    const title = item.title!;
    const domain = extractDomain(url);

    return {
      url,
      title,
      raw_summary: item.contentSnippet ?? item.summary ?? undefined,
      source_name: sourceName,
      source_domain: domain,
      source_favicon_url: getFaviconUrl(domain),
      og_image_url: item.enclosure?.url,
      engagement_stats: {},
      published_at: new Date(item.isoDate ?? item.pubDate ?? Date.now()).toISOString(),
      content_hash: generateStoryHash(url, title),
    };
  }

  async healthCheck(): Promise<boolean> {
    // Check first RSS feed
    const firstFeed = sourcesConfig.rss_feeds[0];
    if (!firstFeed) return false;

    try {
      const res = await fetchWithRetry(firstFeed.url, { maxRetries: 0, timeoutMs: 5_000 });
      return res.ok;
    } catch {
      return false;
    }
  }
}

interface RSSItem {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  summary?: string;
  enclosure?: { url: string };
}
