import { createHash } from 'crypto';

/**
 * Generate a dedup hash for a story.
 * Based on normalized URL + title (lowercased, stripped tracking params).
 * Same story shared with different URLs still deduplicates.
 */
export function generateStoryHash(url: string, title: string): string {
  const normalizedUrl = normalizeUrl(url);
  const normalizedTitle = title.toLowerCase().trim();
  const input = `${normalizedUrl}|${normalizedTitle}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * Strip tracking params (utm_*, ref, etc.) and normalize URL.
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'source', 'fbclid', 'gclid'];
    trackingParams.forEach(p => parsed.searchParams.delete(p));
    // Remove trailing slash from pathname
    parsed.pathname = parsed.pathname.replace(/\/$/, '');
    return parsed.toString().toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

/**
 * Extract domain from a URL for favicons.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Build the Google Favicons API URL for a domain.
 */
export function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}
