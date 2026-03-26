import { BaseSource } from './base-source.js';
import { NormalizedStory } from '../types/index.js';
import { fetchWithRetry } from '../utils/rate-limiter.js';
import { generateStoryHash, getFaviconUrl } from '../utils/hash.js';
import { logger } from '../utils/logger.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sourcesConfig = JSON.parse(readFileSync(join(__dirname, '../../config/sources.json'), 'utf-8')) as SourcesConfig;

interface SourcesConfig {
  github: { topics: string[]; min_stars: number; max_repos: number };
}

const GITHUB_API = 'https://api.github.com/search/repositories';

export class GitHubTrendingSource extends BaseSource {
  readonly sourceName = 'github' as const;

  protected async fetchStories(): Promise<NormalizedStory[]> {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Date 7 days ago — find repos pushed (updated) recently with good star counts
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    // Search for recently-PUSHED AI repos (catches trending, not just new)
    // Lower star threshold — trending repos may not have 100 stars yet
    const topics = sourcesConfig.github.topics;
    // GitHub search query — use primary topic only (multi-topic OR causes 422)
    // + = space separator, %3E = > (must be encoded)
    const queryStr = `topic:ai+pushed:%3E${sevenDaysAgo}+stars:%3E50`;

    const url = `${GITHUB_API}?q=${queryStr}&sort=stars&order=desc&per_page=${sourcesConfig.github.max_repos}`;

    const res = await fetchWithRetry(url, { headers });

    if (!res.ok) {
      throw new Error(`GitHub API: ${res.status} ${res.statusText}`);
    }

    const json = await res.json() as { items: GHRepo[] };
    return json.items.map(repo => this.normalize(repo));
  }

  private normalize(repo: GHRepo): NormalizedStory {
    const url = repo.html_url;
    const title = `${repo.full_name}: ${repo.description ?? 'New AI repository'}`;

    return {
      url,
      title,
      raw_summary: repo.description ?? undefined,
      source_name: 'GitHub',
      source_domain: 'github.com',
      source_favicon_url: getFaviconUrl('github.com'),
      engagement_stats: { github_stars: repo.stargazers_count, github_forks: repo.forks_count },
      published_at: repo.created_at,
      content_hash: generateStoryHash(url, repo.full_name),
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetchWithRetry(`${GITHUB_API}?q=topic:ai&per_page=1`, {
        maxRetries: 0,
        timeoutMs: 5_000,
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

interface GHRepo {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  created_at: string;
  topics: string[];
}
