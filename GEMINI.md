# AI Newsletter Agent -- Gemini CLI Instructions

> This file is for Google Gemini CLI.

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

Walk the user through:

1. **Ask their topic.** Pick closest config from `examples/configs/` and copy to `config/sources.json`. Available: ai, crypto-fintech, finance, healthcare, tech, product-management.

2. **Environment.** Copy `.env.example` to `.env.local`. Then STOP and ask the user for each key one by one. Do NOT proceed until all keys are provided:
   - `OPENROUTER_API_KEY` (required) -- free at https://openrouter.ai/keys
   - `TAVILY_API_KEY` (required) -- free at https://tavily.com
   - `SUPABASE_URL` (required) -- from Supabase Dashboard > Settings > API
   - `SUPABASE_SERVICE_ROLE_KEY` (required) -- from Supabase Dashboard > Settings > API > service_role
   Never use placeholder values. The pipeline will fail without real keys.

3. **Database.** Ask the user before running. Then run `migrations/001-create-tables.sql` in their Supabase instance.

4. **Install + test.** `npm install` then `npm run digest:generate -- --dry-run`

5. **First run.** `npm run digest:generate`

6. **Automate.** Set up `.github/workflows/newsletter-weekly.yml` with repo secrets.

## Key Commands

- `npm run digest:generate` -- Full pipeline
- `npm run digest:generate -- --dry-run` -- Preview without saving
- `npm run digest:generate -- --source hackernews` -- Single source test
- `npm run digest:health-check` -- Ping all source APIs
- `npm run digest:status` -- Show recent newsletters

## Common Tasks

- **Change topic:** `cp examples/configs/[niche].json config/sources.json`
- **Add RSS source:** Add to `config/sources.json` rss_feeds array
- **Change editorial voice:** Edit `src/curation/editorial.ts` buildEditorialPrompt()
- **Change AI model:** Edit `config/scoring.json` scoring_model / editorial_model
- **Add source type:** Create `src/sources/your-source.ts`, extend BaseSource, add to getAllSources()

## Guardrails

- Max 50 LLM calls per run, max 50K tokens
- Fault isolated: one source failing never kills pipeline
- Hash-based dedup, rate limiting, idempotent
