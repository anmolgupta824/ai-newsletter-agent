-- AI Digest Agent: Supabase Schema
-- Run in Supabase Studio SQL editor
-- Local: http://127.0.0.1:54323
-- Production: https://supabase.com/dashboard

-- Digests (one per published issue)
CREATE TABLE IF NOT EXISTS digests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_number INTEGER NOT NULL UNIQUE,
  week_of DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft', 'published'
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stories (all candidates, not just selected ones)
CREATE TABLE IF NOT EXISTS digest_stories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  digest_id UUID REFERENCES digests(id),
  category TEXT NOT NULL DEFAULT 'launch',  -- 'top_story', 'launch', 'pm_corner', 'stat'
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  pm_takeaway TEXT,
  source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  og_image_url TEXT,                        -- article's Open Graph image
  source_favicon_url TEXT,                  -- Google Favicons API URL
  engagement_stats JSONB,                   -- { hn_points: 542 } or { ph_upvotes: 890 }
  ai_score INTEGER,                         -- 0-50 composite score
  score_breakdown JSONB,                    -- { relevance: 9, signal: 8, ... }
  ai_selected BOOLEAN DEFAULT false,        -- AI recommendation (score >= 35)
  user_selected BOOLEAN,                    -- null = not reviewed, true = include, false = exclude
  status TEXT DEFAULT 'candidate',          -- 'candidate', 'published', 'excluded'
  published_at TIMESTAMPTZ,                 -- original article publish date
  week_of DATE NOT NULL,                    -- which week this was collected for
  is_manual BOOLEAN DEFAULT false,          -- true for items added manually
  content_hash TEXT,                        -- sha256(normalized_url + title)[:16] for dedup
  raw_summary TEXT,                         -- original summary from source (not AI-written)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Run logs (tracks cost, tokens, pipeline health)
CREATE TABLE IF NOT EXISTS digest_run_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type TEXT NOT NULL,              -- 'generate', 'health_check'
  status TEXT NOT NULL,                -- 'success', 'partial', 'failed', 'skipped'
  sources_available INTEGER,           -- how many sources responded
  stories_collected INTEGER,
  tokens_used INTEGER,
  cost_estimate NUMERIC(6,4),          -- e.g., 0.0060
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stories_week ON digest_stories(week_of);
CREATE INDEX IF NOT EXISTS idx_stories_status ON digest_stories(status);
CREATE INDEX IF NOT EXISTS idx_stories_score ON digest_stories(ai_score DESC);
CREATE INDEX IF NOT EXISTS idx_stories_digest ON digest_stories(digest_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stories_hash_week ON digest_stories(content_hash, week_of);
CREATE INDEX IF NOT EXISTS idx_run_logs_date ON digest_run_logs(created_at);
