import { fetchWithRetry } from './rate-limiter.js';
import { logger } from './logger.js';

/**
 * Fetch the og:image URL from an article.
 * Returns undefined if fetch fails or no og:image found.
 * Uses a short timeout — we skip gracefully if slow.
 */
export async function fetchOgImage(url: string): Promise<string | undefined> {
  try {
    const response = await fetchWithRetry(url, {
      timeoutMs: 10_000,
      maxRetries: 0,  // no retries for OG images — not worth the wait
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Native-Digest/1.0)',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) return undefined;

    // Read only first 50KB — og:image is always in <head>
    const reader = response.body?.getReader();
    if (!reader) return undefined;

    let html = '';
    let bytesRead = 0;
    const maxBytes = 50_000;

    while (bytesRead < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
      bytesRead += value.length;

      // Stop once we've passed </head>
      if (html.includes('</head>')) {
        reader.cancel();
        break;
      }
    }

    return parseOgImage(html);
  } catch (err) {
    logger.debug('OG image fetch failed', { url, error: err instanceof Error ? err.message : String(err) });
    return undefined;
  }
}

function parseOgImage(html: string): string | undefined {
  // Match og:image in any attribute order
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const url = match[1].trim();
      // Basic validation: must look like a URL
      if (url.startsWith('http') || url.startsWith('//')) {
        return url.startsWith('//') ? `https:${url}` : url;
      }
    }
  }

  return undefined;
}

/**
 * Fetch OG images for multiple stories in parallel (max 5 concurrent).
 */
export async function fetchOgImagesBatch(
  urls: string[]
): Promise<(string | undefined)[]> {
  const results: (string | undefined)[] = new Array(urls.length).fill(undefined);
  const concurrency = 5;
  const queue = urls.map((url, i) => ({ url, i }));

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      results[item.i] = await fetchOgImage(item.url);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}
