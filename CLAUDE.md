# AI Newsletter Agent

You are helping the user build an automated newsletter using this codebase.

## What This Project Does

This is an AI-powered newsletter agent. It:
1. Collects 90+ articles from 6 sources (Hacker News, Product Hunt, GitHub Trending, RSS feeds, Tavily Search, custom scraper)
2. AI-scores every article on 5 criteria (relevance, signal, freshness, credibility, engagement)
3. Selects the top 25 stories (5 per section)
4. Writes AI summaries + "why it matters" for each
5. Generates a weekly editorial in the user's voice
6. Stores everything in Supabase
7. Runs weekly via GitHub Actions cron

Cost: ~$0.006/run with gpt-4o-mini via OpenRouter.

## First-Time Setup

When the user first opens this project, walk them through:

1. **Ask their topic.** "What topic do you want your newsletter to cover?" Then pick the closest config from `examples/configs/` and copy it to `config/sources.json`. Available: ai, crypto-fintech, finance, healthcare, tech, product-management. If none fit, help them create a custom config with RSS feeds for their niche.

2. **Environment setup.** Check if `.env.local` exists. If not, copy `.env.example` to `.env.local` and ask the user to fill in:
   - `OPENROUTER_API_KEY` (required -- get at openrouter.ai/keys)
   - `TAVILY_API_KEY` (required -- free tier at tavily.com)
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (required -- supabase.com or local)

3. **Database setup.** Run `migrations/001-create-tables.sql` against their Supabase instance.

4. **Install.** `npm install`

5. **Test.** `npm run digest:generate -- --dry-run` -- shows what the pipeline would produce without saving anything. Review the output with the user.

6. **First real run.** `npm run digest:generate` -- runs the full pipeline and saves to Supabase.

7. **Automation.** Help them set up `.github/workflows/newsletter-weekly.yml` with their repo secrets.

## Project Structure

```
src/
  sources/           -- One file per news source
    hackernews.ts       HN API: filters by keywords, min score
    producthunt.ts      PH GraphQL: today's top launches
    github-trending.ts  Scrapes trending repos by topic
    rss.ts              Fetches all RSS feeds from config
    tavily.ts           Tavily Search API: query-based discovery
    anthropic.ts        Custom HTML scraper (template for any site)
  curation/          -- AI-powered content processing
    score.ts            Scores articles 0-50 on 5 criteria
    summarize.ts        Writes headlines + summaries
    editorial.ts        Generates weekly editorial (CUSTOMIZE THIS)
  db/                -- Supabase CRUD operations
  config/            -- Runtime config loader
  types/             -- TypeScript interfaces
  utils/             -- Logger, rate limiter, helpers
  index.ts           -- Main pipeline orchestrator + CLI

config/
  sources.json       -- RSS feeds, Tavily queries, HN keywords, GitHub topics
  scoring.json       -- Model selection, thresholds, token limits

examples/configs/    -- Ready-to-use configs for 6 niches
```

## Key Commands

- `npm run digest:generate` -- Full pipeline
- `npm run digest:generate -- --dry-run` -- Preview without saving
- `npm run digest:generate -- --source hackernews` -- Single source test
- `npm run digest:generate -- --summarize` -- Dry run with full AI output
- `npm run digest:health-check` -- Ping all source APIs
- `npm run digest:status` -- Show recent newsletters

## Common Tasks

### "Change the topic"
Copy the right config: `cp examples/configs/[niche].json config/sources.json`
Available: ai, crypto-fintech, finance, healthcare, tech, product-management.

### "Add a new RSS source"
Add to `config/sources.json` in the `rss_feeds` array:
`{ "name": "Source Name", "url": "https://example.com/feed", "source_name": "Example" }`

### "Change the editorial voice"
Edit `src/curation/editorial.ts` -- the `buildEditorialPrompt()` function. This controls the personality of the weekly editorial. The default is generic -- encourage the user to make it their own.

### "Change the AI model"
Edit `config/scoring.json`:
- `scoring_model`: model for scoring + summarization (default: gpt-4o-mini)
- `editorial_model`: model for editorial (default: gpt-4o-mini)
Any model on OpenRouter works.

### "Add a new source type"
1. Create `src/sources/your-source.ts`
2. Extend `BaseSource` from `./base-source.ts`
3. Implement `fetchStories()` returning `NormalizedStory[]`
4. Add to `getAllSources()` in `src/index.ts`
5. Test: `npm run digest:generate -- --source your-source --dry-run`

### "Set up the weekly cron"
1. Push this repo to GitHub
2. Add secrets in GitHub Settings > Secrets: `OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
3. Enable the workflow in `.github/workflows/newsletter-weekly.yml`
4. Default schedule: Friday 6am UTC. Edit the cron expression to change.

## Guardrails

- Max 50 LLM calls per run (hard cap in config/scoring.json)
- Max 50K tokens per run
- One source failing never kills the pipeline (fault isolation)
- 2+ sources down = skip entire run
- Hash-based dedup across runs (sha256 of url+title)
- Rate limiting with exponential backoff
- Safe to run multiple times (idempotent)
