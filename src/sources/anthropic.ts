import { BaseSource } from './base-source.js';
import { NormalizedStory } from '../types/index.js';
import { generateStoryHash, extractDomain, getFaviconUrl } from '../utils/hash.js';
import { fetchWithRetry } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';

const BASE_URL = 'https://www.anthropic.com';
const NEWS_URL = `${BASE_URL}/news`;
// Anthropic publishes infrequently (a few times/month) — use 30-day window
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface AnthropicArticle {
  slug: string;
  url: string;
  title: string;
  description: string;
  category: string;
  publishedAt: string | null;
}

/**
 * Scrape https://www.anthropic.com/news
 * Reverse-engineered: Next.js App Router renders articles server-side into HTML.
 * Each article is an <a href="/news/slug"> anchor containing category, date, title, description.
 */
export class AnthropicSource extends BaseSource {
  readonly sourceName = 'anthropic' as const;

  protected async fetchStories(): Promise<NormalizedStory[]> {
    const res = await fetchWithRetry(NEWS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      maxRetries: 2,
      timeoutMs: 15_000,
    });

    if (!res.ok) {
      throw new Error(`Anthropic news returned ${res.status}`);
    }

    const html = await res.text();
    const articles = parseArticles(html);
    const cutoff = Date.now() - THIRTY_DAYS_MS;

    return articles
      .filter(a => {
        if (!a.publishedAt) return true; // include if date unknown
        return new Date(a.publishedAt).getTime() > cutoff;
      })
      .map(a => normalize(a));
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetchWithRetry(NEWS_URL, { maxRetries: 0, timeoutMs: 5_000 });
      return res.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Parse article cards from Anthropic news HTML.
 *
 * Each article anchor contains plain text in this order:
 *   [Category] [Date] [Title] [Description]
 *   OR
 *   [Date] [Category] [Title] [Description]
 *
 * Example text content:
 *   "Product Feb 17, 2026 Introducing Claude Sonnet 4.6 Sonnet delivers frontier..."
 */
function parseArticles(html: string): AnthropicArticle[] {
  const articles: AnthropicArticle[] = [];

  // Match all <a href="/news/..."> anchors
  const anchorRe = /<a\s+href="(\/news\/([^"]+))"[^>]*>([\s\S]*?)<\/a>/g;
  let match: RegExpExecArray | null;

  while ((match = anchorRe.exec(html)) !== null) {
    const path = match[1];
    const slug = match[2];
    const innerHtml = match[3];

    // Skip non-article slugs (e.g. bare "/news")
    if (!slug || slug.length < 3) continue;

    // Strip HTML tags to get plain text
    const text = innerHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    const parsed = parseArticleText(text);
    if (!parsed.title) continue;

    articles.push({
      slug,
      url: `${BASE_URL}${path}`,
      ...parsed,
    });
  }

  return articles;
}

/**
 * Parse the flat text content of an article card into structured fields.
 *
 * Text format: "[Category?] [Date?] [Title] [Description?]"
 * Categories: Product, Announcements, Policy, Research, News
 * Dates: "Feb 17, 2026" or "Mar 12, 2026"
 */
function parseArticleText(text: string): Omit<AnthropicArticle, 'slug' | 'url'> {
  const knownCategories = ['Product', 'Announcements', 'Announcement', 'Policy', 'Research', 'News'];
  const dateRe = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/;

  let remaining = text;
  let category = '';
  let publishedAt: string | null = null;

  // Strip leading category if present
  for (const cat of knownCategories) {
    if (remaining.startsWith(cat + ' ')) {
      category = cat;
      remaining = remaining.slice(cat.length).trim();
      break;
    }
  }

  // Strip date
  const dateMatch = remaining.match(dateRe);
  if (dateMatch) {
    publishedAt = new Date(dateMatch[0]).toISOString();
    remaining = remaining.slice(dateMatch[0].length).trim();
  }

  // Strip trailing category (sometimes date comes first, then category)
  if (!category) {
    for (const cat of knownCategories) {
      if (remaining.startsWith(cat + ' ')) {
        category = cat;
        remaining = remaining.slice(cat.length).trim();
        break;
      }
    }
  }

  // First sentence (up to a period or ~80 chars) = title; rest = description
  // In practice, Anthropic cards show title then short description
  const dotIdx = remaining.indexOf('. ');
  let title: string;
  let description: string;

  if (dotIdx > 0 && dotIdx < 120) {
    // Split at first sentence break that looks like end of title
    // But titles rarely have periods — use newline or length heuristic
    title = remaining;
    description = '';
  } else {
    title = remaining;
    description = '';
  }

  // If text is long, first ~80 chars is likely the title
  // Anthropic cards embed description after title — split on 4th+ word boundary at ~80 chars
  if (remaining.length > 100) {
    // Find a reasonable split: after the title-like portion
    // Titles are typically 5-15 words; descriptions follow
    const words = remaining.split(' ');
    // Heuristic: first 8-12 words = title, rest = description
    const titleWordCount = estimateTitleWords(words);
    title = words.slice(0, titleWordCount).join(' ');
    description = words.slice(titleWordCount).join(' ');
  }

  return { title: title.trim(), description: description.trim(), category, publishedAt };
}

/**
 * Estimate how many words belong to the title vs description.
 * Anthropic titles tend to be 4-10 words and don't end with common description starters.
 */
function estimateTitleWords(words: string[]): number {
  const descStarters = ['We', "We've", 'Our', 'This', 'Today', 'Announcing', 'Sonnet', 'Claude'];
  // Walk words until we hit something that looks like description start
  for (let i = 4; i < Math.min(words.length, 14); i++) {
    if (descStarters.includes(words[i])) return i;
  }
  return Math.min(10, words.length);
}

function normalize(a: AnthropicArticle): NormalizedStory {
  const domain = extractDomain(a.url);
  return {
    url: a.url,
    title: a.title,
    raw_summary: a.description || undefined,
    source_name: 'Anthropic',
    source_domain: domain,
    source_favicon_url: getFaviconUrl(domain),
    engagement_stats: {},
    published_at: a.publishedAt ?? new Date().toISOString(),
    content_hash: generateStoryHash(a.url, a.title),
  };
}
