import { BaseSource } from './base-source.js';
import { NormalizedStory } from '../types/index.js';
import { fetchWithRetry } from '../utils/rate-limiter.js';
import { generateStoryHash, extractDomain, getFaviconUrl } from '../utils/hash.js';
import { logger } from '../utils/logger.js';

const PH_API = 'https://api.producthunt.com/v2/api/graphql';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const QUERY = `
  query {
    posts(first: 30, topic: "artificial-intelligence", order: VOTES) {
      edges {
        node {
          id
          name
          tagline
          description
          url
          votesCount
          createdAt
          thumbnail { url }
          topics { edges { node { name } } }
        }
      }
    }
  }
`;

export class ProductHuntSource extends BaseSource {
  readonly sourceName = 'producthunt' as const;

  protected async fetchStories(): Promise<NormalizedStory[]> {
    const apiKey = process.env.PRODUCT_HUNT_API_KEY;
    if (!apiKey) {
      logger.warn('PRODUCT_HUNT_API_KEY not set — skipping Product Hunt source');
      return [];
    }

    const res = await fetchWithRetry(PH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: QUERY }),
    });

    if (!res.ok) {
      throw new Error(`Product Hunt API: ${res.status} ${res.statusText}`);
    }

    const json = await res.json() as PHResponse;

    if (json.errors?.length) {
      throw new Error(`Product Hunt GraphQL error: ${json.errors[0].message}`);
    }

    const cutoff = Date.now() - SEVEN_DAYS_MS;

    return (json.data?.posts?.edges ?? [])
      .map(edge => edge.node)
      .filter(post => new Date(post.createdAt).getTime() > cutoff && post.votesCount >= 50)
      .map(post => this.normalize(post));
  }

  private normalize(post: PHPost): NormalizedStory {
    const domain = extractDomain(post.url);

    return {
      url: post.url,
      title: `${post.name}: ${post.tagline}`,
      raw_summary: post.description ?? post.tagline,
      source_name: 'Product Hunt',
      source_domain: 'producthunt.com',
      source_favicon_url: getFaviconUrl('producthunt.com'),
      og_image_url: post.thumbnail?.url,
      engagement_stats: { ph_upvotes: post.votesCount },
      published_at: post.createdAt,
      content_hash: generateStoryHash(post.url, post.name),
    };
  }

  async healthCheck(): Promise<boolean> {
    const apiKey = process.env.PRODUCT_HUNT_API_KEY;
    if (!apiKey) return false;

    try {
      const res = await fetchWithRetry(PH_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ query: '{ posts(first: 1) { edges { node { id } } } }' }),
        maxRetries: 0,
        timeoutMs: 5_000,
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

interface PHPost {
  id: string;
  name: string;
  tagline: string;
  description?: string;
  url: string;
  votesCount: number;
  createdAt: string;
  thumbnail?: { url: string };
}

interface PHResponse {
  data?: {
    posts?: {
      edges: { node: PHPost }[];
    };
  };
  errors?: { message: string }[];
}
