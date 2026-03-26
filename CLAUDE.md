# AI Digest Agent — Claude Code Instructions

## What This Is

An automated pipeline that collects AI news from 6 sources, scores every article with AI,
selects the top 25, writes summaries and an editorial, and stores everything in Supabase.
Runs weekly via GitHub Actions. Cost: ~$0.006/run.

## Key Commands

```bash
npm run digest:generate              # Full pipeline
npm run digest:generate -- --dry-run # Preview without saving
npm run digest:generate -- --source hackernews  # Single source
npm run digest:health-check          # Ping all source APIs
npm run digest:status                # Show recent digests
```

## Project Structure

```
src/
├── sources/        One file per news source
│   ├── hackernews.ts
│   ├── producthunt.ts
│   ├── github-trending.ts
│   ├── rss.ts
│   ├── tavily.ts
│   └── anthropic.ts
├── curation/       AI-powered content processing
│   ├── client.ts      OpenRouter client
│   ├── score.ts       Score articles 0-50 on 5 criteria
│   ├── summarize.ts   Write headlines + summaries
│   ├── editorial.ts   Generate weekly editorial
│   └── prompt.ts      All prompts — CUSTOMIZE editorial here
├── db/
│   ├── client.ts      Supabase client
│   └── operations.ts  CRUD operations
├── types/index.ts
└── index.ts        Main pipeline entry point

config/
├── sources.json    RSS feeds + Tavily queries + source settings
└── scoring.json    Thresholds + model selection

migrations/
└── 001-create-tables.sql   Run in Supabase Studio
```

## Environment Variables

Required in `.env.local`:
- `OPENROUTER_API_KEY` — get at openrouter.ai/keys
- `TAVILY_API_KEY` — get at tavily.com (free tier)
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (not anon key)

## How to Add a New Source

1. Create `src/sources/your-source.ts` extending `BaseSource`
2. Implement `fetchStories()` returning `NormalizedStory[]`
3. Implement `healthCheck()` returning `boolean`
4. Add to `getAllSources()` in `src/index.ts`
5. Test: `npm run digest:generate -- --source your-source --dry-run`

## How to Customize the Editorial

1. Open `src/curation/prompt.ts`
2. Find `buildEditorialPrompt()`
3. Replace the `system` and `user` strings with your own voice
4. Change the model in `config/scoring.json` (`editorial_model` field)
5. Test: `npm run digest:generate -- --dry-run`

## Common Tasks

**Change which model scores articles:**
Edit `config/scoring.json` → `scoring_model` field

**Change scoring thresholds:**
Edit `config/scoring.json` → `CANDIDATE_THRESHOLD` (default: 30), `STORIES_PER_SECTION` (default: 5)

**Add an RSS feed:**
Edit `config/sources.json` → `rss_feeds` array

**Add a Tavily search query:**
Edit `config/sources.json` → `tavily_queries` array

**Test a single source:**
`npm run digest:generate -- --source rss --dry-run`

## Pipeline Flow

1. Health check (ping all sources)
2. Collect stories from all sources (parallel, fault-isolated)
3. Dedup (sha256 hash, skip duplicates)
4. AI Score (rate each article 0-50)
5. Select top 25 (5 per section)
6. AI Summarize (headline + summary + "why it matters")
7. Fetch OG images
8. AI Editorial (weekly take)
9. Store to Supabase
10. Publish

## Guardrails

- `TOKEN_CAP` in `config/scoring.json` limits tokens per run (default: 50K)
- One source failing never kills the pipeline (fault isolation)
- 3+ sources down → entire run is skipped
- Exponential backoff on rate limits
