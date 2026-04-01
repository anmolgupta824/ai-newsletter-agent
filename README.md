# AI Newsletter Agent

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/anmolgupta824/ai-newsletter-agent?style=social)](https://github.com/anmolgupta824/ai-newsletter-agent)

Build a curated newsletter on **any topic** in 30 minutes. AI-powered. Fully automated. $0.006/run.

> Clone this repo. Open in Claude Code, Cursor, or Gemini. Say "build me a crypto newsletter." Done.

---

## How It Works

```
6 Sources (RSS, Hacker News, Product Hunt, GitHub, Tavily Search, Custom Scraper)
    |
90+ articles collected
    |
AI Scoring — 5 criteria, 0-50 scale (~30 LLM calls)
    |
Top 25 selected (5 per section)
    |
AI Summarization — headline + "why it matters" (~10 LLM calls)
    |
AI Editorial — weekly take in your voice (1 LLM call)
    |
Stored in Supabase — Auto-published
```

**Total: ~41 LLM calls per run. Cost: ~$0.006 with gpt-4o-mini.**

---

## See It In Action

This agent powers **[The AI-Native Digest](https://theainativepm.com/digest)** — a weekly AI newsletter with 1.2M+ Threads views, auto-published every Friday.

Same pipeline. Same code. The only difference is a tuned editorial prompt.

---

## Quick Start (AI-First)

**The fastest way:** Open this repo in an AI coding tool and let it set everything up.

| Tool | How |
|------|-----|
| **Claude Code** | `git clone` then `claude` then "Set up a healthcare newsletter" |
| **Cursor** | Open folder then Cmd+L then "Set up a crypto newsletter" |
| **GitHub Copilot** | Open folder then Chat then "Help me configure this for finance news" |
| **Gemini CLI** | `git clone` then `gemini` then "Build me a tech newsletter" |

The AI reads the instruction files (CLAUDE.md / AGENTS.md / GEMINI.md) and handles:
- Picking the right config for your topic
- Setting up Supabase tables
- Configuring API keys
- Running a dry-run test
- Setting up the weekly cron

---

## Quick Start (Manual)

1. Fork this repo
2. Copy `.env.example` to `.env.local`
3. Add your API keys:
   - `OPENROUTER_API_KEY` — required ([get one free](https://openrouter.ai/keys))
   - `TAVILY_API_KEY` — required, free tier ([tavily.com](https://tavily.com), 1000 searches/month)
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — required ([supabase.com](https://supabase.com))
4. Run migrations: paste `migrations/001-create-tables.sql` in Supabase SQL editor
5. Pick your topic:
   ```bash
   cp examples/configs/crypto-fintech.json config/sources.json
   ```
6. Install and test:
   ```bash
   npm install
   npm run digest:generate -- --dry-run
   ```
7. Run for real: `npm run digest:generate`
8. Automate: add secrets to GitHub, enable `.github/workflows/newsletter-weekly.yml`

---

## Pick a Topic

Ships with 6 ready-to-use configs. All RSS feeds verified and working.

| Config | Sources | Use Case |
|--------|---------|----------|
| **ai.json** (default) | TechCrunch AI, Anthropic, OpenAI, Google AI, a16z | AI tools, LLMs, agents |
| **crypto-fintech.json** | CoinDesk, The Block, Decrypt, CoinTelegraph, TechCrunch Fintech | Crypto, DeFi, payments |
| **finance.json** | Bloomberg, Seeking Alpha, Motley Fool, MarketWatch, NYT Business | Markets, IPOs, earnings |
| **healthcare.json** | STAT News, Fierce Healthcare, MedCity, Healthcare IT, Rock Health | Digital health, biotech |
| **tech.json** | The New Stack, InfoQ, DZone, TechCrunch | Cloud, infra, dev tools |
| **product-management.json** | Lenny's, Product Talk, SVPG, Pragmatic Engineer, ProductPlan, Intercom | PM strategy, frameworks |

**Create your own:** Copy any config, swap the RSS feeds and search queries.

```bash
# Switch topics in one command
cp examples/configs/healthcare.json config/sources.json
npm run digest:generate -- --dry-run
```

---

## Architecture

```
+-----------------------------------------------------------+
|                  AI NEWSLETTER AGENT                       |
|                                                           |
|  +----------+  +----------+  +----------+                 |
|  | Hacker   |  | Product  |  | GitHub   |                 |
|  | News API |  | Hunt API |  | Trending |                 |
|  +----+-----+  +----+-----+  +----+-----+                |
|       |             |             |                        |
|  +----+-----+  +----+-----+  +---+------+                |
|  | RSS      |  | Tavily   |  | Custom   |                 |
|  | Feeds    |  | Search   |  | Scraper  |                 |
|  +----+-----+  +----+-----+  +----+-----+                |
|       +--------------+--------------+                     |
|                      v                                    |
|            +------------------+                           |
|            |  90+ raw stories |                           |
|            +--------+---------+                           |
|                     v                                     |
|            +------------------+                           |
|            |  AI SCORING      |  5 criteria, 0-50         |
|            |  ~30 LLM calls   |  via OpenRouter           |
|            +--------+---------+                           |
|                     v                                     |
|            +------------------+                           |
|            |  DEDUP + SELECT  |  sha256 hash              |
|            |  Top 25 stories  |  5 per section            |
|            +--------+---------+                           |
|                     v                                     |
|            +------------------+                           |
|            |  SUMMARIZE       |  headline + summary       |
|            |  ~10 LLM calls   |  + "why it matters"       |
|            +--------+---------+                           |
|                     v                                     |
|            +------------------+                           |
|            |  EDITORIAL       |  your voice, your take    |
|            |  1 LLM call      |  (customize the prompt!)  |
|            +--------+---------+                           |
|                     v                                     |
|            +------------------+                           |
|            |  SUPABASE        |  digests + stories tables |
|            +--------+---------+                           |
|                     v                                     |
|            +------------------+                           |
|            |  PUBLISHED       |  weekly cron, zero effort |
|            +------------------+                           |
|                                                           |
|  Total: ~41 LLM calls | ~$0.006/run | fully automated    |
+-----------------------------------------------------------+
```

See `docs/flow-diagram.md` for the detailed version.

---

## Supported LLM Providers

Works with **any model** via [OpenRouter](https://openrouter.ai). One API key, 100+ models.

| Provider | Model | Cost/run |
|----------|-------|----------|
| OpenAI | gpt-4o-mini | ~$0.006 |
| OpenAI | gpt-4o | ~$0.02 |
| Anthropic | claude-sonnet-4-5 | ~$0.01 |
| Google | gemini-pro | ~$0.005 |
| Meta | llama-3.1-8b | ~$0.002 |

Set your model in `config/scoring.json`. Change it anytime.

---

## Monthly Cost

| Frequency | gpt-4o-mini | gpt-4o |
|-----------|-------------|--------|
| Weekly | ~$0.024/mo | ~$0.08/mo |
| Daily | ~$0.18/mo | ~$0.60/mo |

Supabase free tier + GitHub Actions free tier + OpenRouter pay-per-use = practically free to run.

---

## CLI Commands

| Command | What It Does |
|---------|-------------|
| `npm run digest:generate` | Full pipeline: collect, score, summarize, editorial, publish |
| `npm run digest:generate -- --dry-run` | Preview everything without saving to database |
| `npm run digest:generate -- --source hackernews` | Test a single source |
| `npm run digest:generate -- --summarize` | Dry run with full AI summaries |
| `npm run digest:health-check` | Ping all source APIs, show status |
| `npm run digest:status` | Show recent newsletters and run history |

---

## Customize Everything

### Change Topic
```bash
cp examples/configs/finance.json config/sources.json
```

### Add Your Voice
Edit `src/curation/prompt.ts`. The default prompt is intentionally generic. Replace it with your personality, opinions, and style. This is what makes your newsletter yours.

### Add/Remove Sources
Edit `config/sources.json`. Add any RSS feed:
```json
{ "name": "My Source", "url": "https://example.com/feed", "source_name": "Example" }
```

### Adjust Scoring
Edit `config/scoring.json`:
- `CANDIDATE_THRESHOLD` — min score to be a candidate (default: 30)
- `STORIES_PER_SECTION` — stories per section (default: 5)
- `scoring_model` — which LLM scores articles
- `editorial_model` — which LLM writes the editorial

### Add a New Source Type
1. Create `src/sources/your-source.ts`
2. Extend `BaseSource`, implement `fetchStories()`
3. Add to `src/index.ts` in `getAllSources()`
4. Test: `npm run digest:generate -- --source your-source --dry-run`

---

## Works With Any AI Coding Tool

This repo includes instruction files so AI tools can understand and modify it:

| File | Platform |
|------|----------|
| `CLAUDE.md` | Claude Code |
| `AGENTS.md` | OpenAI Codex, GitHub Copilot, Cursor, Windsurf, Amp, Devin, Replit |
| `GEMINI.md` | Gemini CLI |

Just open the repo and ask your AI to set it up. It knows what to do.

---

## Guardrails

- **Max 50 LLM calls per run** — hard cap, won't exceed
- **Max 50K tokens per run** — budget protection
- **Fault isolated** — one source failing never kills the pipeline
- **Health check** — 2+ sources down = skip entire run
- **Hash-based dedup** — no duplicate stories across runs (sha256)
- **Rate limiting** — exponential backoff on 429/5xx
- **Idempotent** — safe to run multiple times, won't duplicate

---

## Star This Repo

If this saved you time or gave you ideas, give it a star. It helps others find it.

---

## License

MIT — use it however you want.
