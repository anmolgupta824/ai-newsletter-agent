# AI Digest Agent

Build your own AI-curated weekly digest in 30 minutes.

90+ articles collected, AI scores every one, top 25 curated, editorial written, auto-published.
Cost: $0.006/run. Fully automated via GitHub Actions.

## What It Does

- Collects from 6 sources (HN, Product Hunt, GitHub, RSS, Tavily, custom scraper)
- AI scores every article on 5 criteria (relevance, signal, freshness, credibility, engagement)
- Selects top 25 stories (5 per section: Top Stories, Launches, PM Corner, Stats, Bonus)
- Writes summaries + "why it matters" for each story
- Generates a weekly editorial (bring your own prompt for your voice)
- Stores everything in Supabase
- Auto-publishes on a weekly cron schedule

## Quick Start

1. Fork this repo
2. Copy `.env.example` to `.env.local`
3. Add your keys:
   - `OPENROUTER_API_KEY` (required — works with any LLM, get one at openrouter.ai)
   - `TAVILY_API_KEY` (free tier at tavily.com, 1000 searches/month)
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
4. Run migrations: copy `migrations/001-create-tables.sql` into Supabase Studio SQL editor
5. Install: `npm install`
6. Test: `npm run digest:generate -- --dry-run`
7. Run for real: `npm run digest:generate`
8. Automate: add secrets to GitHub repo, enable the cron in `.github/workflows/digest-weekly.yml`

## Supported LLM Providers

Works with any model via OpenRouter. Set your preferred model in `config/scoring.json`:

| Provider | Model | Cost/run |
|----------|-------|----------|
| OpenAI | gpt-4o-mini | ~$0.006 |
| OpenAI | gpt-4o | ~$0.02 |
| Anthropic | claude-sonnet-4-5 | ~$0.01 |
| Google | gemini-pro | ~$0.005 |
| Meta | llama-3.1-8b | ~$0.002 |

## Cost

| Frequency | gpt-4o-mini | gpt-4o |
|-----------|-------------|--------|
| Per run | ~$0.006 | ~$0.02 |
| Weekly | ~$0.006 | ~$0.02 |
| Monthly | ~$0.024 | ~$0.08 |

## Architecture

```
6 Sources → 90+ raw stories
  → AI Scoring (gpt-4o-mini, ~30 calls) → 25 selected
    → AI Summarization (gpt-4o-mini, ~10 calls) → headlines + summaries
      → AI Editorial (your model, 1 call) → weekly take
        → Supabase → Published
```

3 places AI is used:
1. **Scoring:** rates 90+ articles on 5 criteria (~30 calls)
2. **Summarizing:** writes headlines + "why it matters" (~10 calls)
3. **Editorial:** writes the weekly take (1 call, bring your own prompt)

See `docs/flow-diagram.md` for the full architecture diagram.

## Customize

### Add Your Voice (Editorial)
Edit `src/curation/prompt.ts` — the `buildEditorialPrompt` function.
The included prompt is intentionally generic. Replace it with your own voice, opinions, and personality.
The best digests come from prompts tuned to your audience.

See `examples/sample-output.md` for what a tuned editorial looks like.

### Add/Remove Sources
Edit `config/sources.json`. Each RSS feed needs a name, URL, and source_name.
For Tavily, edit the `tavily_queries` array to match your topic.

### Adjust Scoring
Edit `config/scoring.json`:
- `CANDIDATE_THRESHOLD`: minimum score to enter candidate pool (default: 30)
- `STORIES_PER_SECTION`: stories per section (default: 5)
- `scoring_model`: which LLM scores articles (default: gpt-4o-mini)
- `editorial_model`: which LLM writes the editorial (default: gpt-4o-mini)

### Add a New Source
1. Create `src/sources/your-source.ts`
2. Extend `BaseSource` and implement `fetchStories()` returning `NormalizedStory[]`
3. Add to `src/index.ts` `getAllSources()`
4. Test: `npm run digest:generate -- --source your-source --dry-run`

## CLI Commands

| Command | What It Does |
|---------|-------------|
| `npm run digest:generate` | Full pipeline (collect, score, select, summarize, editorial, store) |
| `npm run digest:generate -- --dry-run` | Preview without saving to DB |
| `npm run digest:generate -- --source hackernews` | Run single source only |
| `npm run digest:health-check` | Ping all source APIs |
| `npm run digest:status` | Show recent digests |

## Works With

This repo includes instruction files for multiple AI coding platforms:

| File | Platform |
|------|----------|
| `CLAUDE.md` | Claude Code |
| `AGENTS.md` | OpenAI Codex, GitHub Copilot, Cursor, Windsurf, Amp, Devin, Replit |
| `GEMINI.md` | Gemini CLI |

## Guardrails

- Max 50 LLM calls per run (hard cap in config)
- Max 50K tokens per run
- Fault isolated: one source failing never kills the pipeline
- Health check runs before pipeline (2+ sources down = skip run)
- Hash-based dedup: no duplicate stories across runs
- Rate limiting with exponential backoff

---

If this saved you time, give it a ⭐ — it helps others find this project.

## License

MIT
