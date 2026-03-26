// Raw story from a source (before AI scoring)
export interface NormalizedStory {
  url: string;
  title: string;
  raw_summary?: string;        // from source (not AI-written)
  source_name: string;         // "Hacker News", "Product Hunt", etc.
  source_domain: string;       // "news.ycombinator.com"
  source_favicon_url: string;  // https://www.google.com/s2/favicons?domain=...&sz=32
  og_image_url?: string;       // article's og:image
  engagement_stats: Record<string, number>;  // { hn_points: 542 } or { ph_upvotes: 890 }
  published_at: string;        // ISO 8601 date string
  content_hash: string;        // sha256(normalized_url + "|" + title.lower())[:16]
}

// Story after AI scoring
export interface ScoredStory extends NormalizedStory {
  ai_score: number;            // 0-50
  score_breakdown: {
    relevance: number;
    signal: number;
    freshness: number;
    credibility: number;
    engagement: number;
  };
  category: StoryCategory;     // AI-suggested category
  ai_selected: boolean;        // true if score >= 35 (pre-selected for admin review)
  // Set after summarization:
  headline?: string;
  summary?: string;
  why_it_matters?: string;
}

export type StoryCategory = 'top_story' | 'launch' | 'pm_corner' | 'stat';

// Source types
export type SourceName = 'hackernews' | 'producthunt' | 'github' | 'rss' | 'tavily' | 'anthropic';

export interface SourceResult {
  source: SourceName;
  stories: NormalizedStory[];
  error?: string;
  duration: number;
}

// Pipeline run result
export interface PipelineResult {
  digest_id: string;
  issue_number: number;
  week_of: string;
  sources_available: number;
  stories_collected: number;
  stories_scored: number;
  stories_stored: number;
  tokens_used: number;
  cost_estimate: number;
  duration: number;
  source_results: SourceResult[];
}

// CLI options
export interface CLIOptions {
  dryRun: boolean;
  source: SourceName | null;
  verbose: boolean;
  status: boolean;
  healthCheck: boolean;
  summarize: boolean;  // dry-run + also run summarization (no DB write)
}
