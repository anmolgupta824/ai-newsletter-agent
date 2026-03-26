# Instructions for AI Agents

This file helps AI coding tools (Claude Code, Codex, Cursor, Copilot) understand and work with this codebase.

## Project Overview

AI Digest Agent collects news from 6 sources, scores them with AI, selects the top 25,
writes summaries and an editorial, and stores everything in Supabase.
Runs weekly via GitHub Actions.

## Project Structure

```
src/
├── sources/        One file per news source
│   ├── hackernews.ts
│   ├── producthunt.ts
│   ├── github-trending.ts
│   ├── rss.ts
│   ├── tavily.ts
│   └── anthropic.ts (custom HTML scraper)
├── curation/       AI-powered content processing
│   ├── client.ts      OpenRouter client (supports any LLM)
│   ├── score.ts       Score articles 0-50 on 5 criteria
│   ├── summarize.ts   Write headlines + summaries + "why it matters"
│   ├── editorial.ts   Generate weekly editorial (runner + validation)
│   └── prompt.ts      All prompts — CUSTOMIZE editorial here
├── db/
│   └── operations.ts  Supabase CRUD for digests + stories
└── index.ts        Main pipeline orchestrator

config/
├── sources.json    Which sources to scrape (user-editable)
└── scoring.json    Thresholds and limits (user-editable)

migrations/
└── 001-create-tables.sql   Supabase schema
```

## Key Commands

```bash
npm run digest:generate              # Full pipeline
npm run digest:generate -- --dry-run # Preview without saving
npm run digest:generate -- --source hackernews  # Single source test
npm run digest:health-check          # Ping all source APIs
npm run digest:status                # Show recent digests
```

## How to Add a New Source

1. Create `src/sources/your-source.ts`
2. Export a class extending `BaseSource`:
   ```typescript
   import { BaseSource } from './base-source.js';
   import { NormalizedStory } from '../types/index.js';

   export class YourSource extends BaseSource {
     readonly sourceName = 'your-source' as const;

     protected async fetchStories(): Promise<NormalizedStory[]> {
       // fetch and return normalized stories
     }

     async healthCheck(): Promise<boolean> {
       // return true if source is reachable
     }
   }
   ```
3. Add to `getAllSources()` in `src/index.ts`
4. Test: `npm run digest:generate -- --source your-source --dry-run`

## How to Customize the Editorial

1. Open `src/curation/prompt.ts`
2. Replace `buildEditorialPrompt()` with your own voice and personality
3. Choose your model in `config/scoring.json` (`editorial_model` field)
4. Test: `npm run digest:generate -- --dry-run`

## How to Change Scoring

1. Open `config/scoring.json`
2. Key settings:
   - `CANDIDATE_THRESHOLD`: min score to enter candidate pool (default: 30)
   - `STORIES_PER_SECTION`: stories per section (default: 5)
   - `scoring_model`: which LLM scores articles
   - `editorial_model`: which LLM writes editorial
3. Test: `npm run digest:generate -- --dry-run`

## Environment Variables

| Variable | Required | How to Get |
|----------|----------|------------|
| `OPENROUTER_API_KEY` | Yes | openrouter.ai/keys |
| `TAVILY_API_KEY` | Yes | tavily.com (free: 1000/month) |
| `SUPABASE_URL` | Yes | supabase.com or local `supabase start` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | supabase.com or local `supabase start` |
| `PRODUCT_HUNT_API_KEY` | Optional | producthunt.com/v2/oauth/applications |
| `GITHUB_TOKEN` | Optional | github.com/settings/tokens |

## Pipeline Flow

```
1. Health check (ping all sources)
2. Collect stories from all sources (parallel, fault-isolated)
3. Dedup (hash URL+title, skip duplicates from previous runs)
4. AI Score (rate each article 0-50)
5. Select top 25 (5 per section by category)
6. AI Summarize (headline + summary + "why it matters")
7. Fetch OG images (parse meta tags from article URLs)
8. AI Editorial (your chosen model writes the weekly take)
9. Store to Supabase (digests + digest_stories tables)
10. Mark as published
```

## Guardrails

- Max 50K tokens per run (TOKEN_CAP in config)
- One source failing never kills the pipeline (fault isolation)
- Health check: 2+ sources down = skip entire run
- Dedup: sha256(url+title) prevents duplicate stories
- Rate limiting: exponential backoff on 429/5xx responses
- Retry: 2-3 attempts per source, then skip
