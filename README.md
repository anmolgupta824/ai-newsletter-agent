<p align="center">
  <h1 align="center">AI Newsletter Agent</h1>
  <p align="center">
    An autonomous agent that reads 90+ articles, scores every one, curates the best 25, writes an editorial, and publishes your newsletter. Every week. Zero human effort.
  </p>
</p>

<p align="center">
  <a href="https://github.com/anmolgupta824/ai-newsletter-agent/stargazers"><img src="https://img.shields.io/github/stars/anmolgupta824/ai-newsletter-agent?style=for-the-badge&color=yellow" alt="Stars"></a>
  <a href="https://github.com/anmolgupta824/ai-newsletter-agent/network/members"><img src="https://img.shields.io/github/forks/anmolgupta824/ai-newsletter-agent?style=for-the-badge" alt="Forks"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/anmolgupta824/ai-newsletter-agent/issues"><img src="https://img.shields.io/github/issues/anmolgupta824/ai-newsletter-agent?style=for-the-badge" alt="Issues"></a>
</p>

<p align="center">
  <b>Any topic. Any niche. $0.006 per run.</b>
  <br/>
  <i>Ships with 6 ready-to-use configs: AI, Crypto, Finance, Healthcare, Tech, Product Management</i>
</p>

---

## What This Agent Does

Most newsletter tools help you **send** emails. This agent **writes the entire newsletter for you.**

```
You: "I want a weekly crypto newsletter"
Agent: *reads 90+ articles, scores them, picks the best 25, writes your editorial, publishes*
You: *sips coffee*
```

It runs on a cron. You set it up once. Every week, a new issue appears. No manual curation, no copy-pasting links, no writer's block.

---

## The Pipeline

```
                         YOUR NEWSLETTER AGENT
  ================================================================

  STEP 1: COLLECT                          6 Source Types
  ---------------------------------------------------------------
  +-------------+  +-------------+  +--------------+
  | RSS Feeds   |  | Hacker News |  | Product Hunt |
  | (any feed)  |  | (API)       |  | (GraphQL)    |
  +------+------+  +------+------+  +------+-------+
         |                |                |
  +------+------+  +------+------+  +------+-------+
  | GitHub      |  | Tavily      |  | Custom       |
  | Trending    |  | Search API  |  | Scraper      |
  +------+------+  +------+------+  +------+-------+
         |                |                |
         +--------+-------+-------+--------+
                  |
                  v
  STEP 2: SCORE                            ~30 LLM calls
  ---------------------------------------------------------------
  Every article scored 0-50 on 5 criteria:
  [Relevance] [Signal Strength] [Freshness] [Credibility] [Engagement]

  Model: gpt-4o-mini via OpenRouter (or any model you choose)
                  |
                  v
  STEP 3: DEDUPLICATE + SELECT
  ---------------------------------------------------------------
  sha256(url + title) -- no duplicates across weeks
  Top 25 stories selected (5 per section)
  30+ candidates scored, best survive
                  |
                  v
  STEP 4: SUMMARIZE                        ~10 LLM calls
  ---------------------------------------------------------------
  Each story gets:
  - Rewritten headline (not clickbait)
  - 2-3 sentence summary
  - "Why it matters" takeaway
                  |
                  v
  STEP 5: EDITORIAL                        1 LLM call
  ---------------------------------------------------------------
  Weekly editorial written in YOUR voice.
  Opinionated. First-person. Not a generic summary.
  (This is what makes your newsletter yours -- customize the prompt!)
                  |
                  v
  STEP 6: PUBLISH
  ---------------------------------------------------------------
  Stored in Supabase (digests + stories tables)
  Auto-published via GitHub Actions cron
  Zero manual steps. Every week. Forever.

  ================================================================
  Total: ~41 LLM calls | Cost: ~$0.006/run | Fully autonomous
```

---

## See It Live

This agent powers **[The AI-Native Digest](https://theainativepm.com/digest)** -- a weekly AI newsletter.

- **1.2M+ views** on Threads in 30 days
- Auto-published every Friday at 6am
- Zero human curation since launch

Same pipeline. Same code. Same agent. The only difference is a tuned editorial prompt.

---

## Get Started in 2 Minutes (AI-First)

The fastest way: let your AI coding tool do everything.

```bash
git clone https://github.com/anmolgupta824/ai-newsletter-agent.git
cd ai-newsletter-agent
```

Then open in your preferred tool:

| Tool | Command |
|------|---------|
| **Claude Code** | `claude` then "Set up a healthcare newsletter" |
| **Cursor** | Cmd+L then "Set up a crypto newsletter" |
| **GitHub Copilot** | Chat then "Configure this for finance news" |
| **Gemini CLI** | `gemini` then "Build me a tech newsletter" |

The AI reads `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` and handles everything:
1. Asks your topic
2. Picks the right config
3. Sets up Supabase tables
4. Configures API keys
5. Runs a dry-run test
6. Sets up the weekly cron

**You don't need to read docs. The agent reads them for you.**

---

## Get Started (Manual)

<details>
<summary>Click to expand manual setup</summary>

1. Fork this repo
2. Copy `.env.example` to `.env.local`
3. Add your API keys:
   - `OPENROUTER_API_KEY` -- required ([get one free](https://openrouter.ai/keys))
   - `TAVILY_API_KEY` -- required, free tier ([tavily.com](https://tavily.com))
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` -- required ([supabase.com](https://supabase.com))
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

</details>

---

## Pick Your Niche

Ships with **6 production-ready configs**. Fork, pick one, run.

| Config | RSS Sources | Covers |
|--------|------------|--------|
| `ai.json` (default) | TechCrunch AI, Anthropic, OpenAI, Google AI, a16z | AI tools, LLMs, agents, launches |
| `crypto-fintech.json` | CoinDesk, The Block, Decrypt, CoinTelegraph, TechCrunch Fintech | Crypto, DeFi, Web3, payments, neobanks |
| `finance.json` | Bloomberg, Seeking Alpha, Motley Fool, MarketWatch, NYT Business | Markets, IPOs, earnings, macro |
| `healthcare.json` | STAT News, Fierce Healthcare, MedCity, Healthcare IT, Rock Health | Digital health, biotech, FDA, medtech |
| `tech.json` | The New Stack, InfoQ, DZone, TechCrunch | Cloud, infra, dev tools, open source |
| `product-management.json` | Lenny's, Product Talk, SVPG, Pragmatic Engineer, ProductPlan, Intercom | PM strategy, frameworks, career |

```bash
# Switch topics in one command
cp examples/configs/healthcare.json config/sources.json
npm run digest:generate -- --dry-run
```

**Don't see your niche?** Create a custom config. Add any RSS feed, any Tavily search query, any HN keywords.

---

## How the AI Scores Articles

Every article is evaluated on 5 criteria, scored 0-10 each (total 0-50):

| Criteria | What It Measures |
|----------|-----------------|
| **Relevance** | Does this match the newsletter's topic? |
| **Signal Strength** | Is this a real development or just noise? |
| **Freshness** | Published in the last 7 days? |
| **Credibility** | Is the source trustworthy? |
| **Engagement Potential** | Would readers care about this? |

**Threshold: 30+** to be a candidate. **Top 25** make the final cut. The rest are discarded.

---

## Supported Models

Works with **any model** via [OpenRouter](https://openrouter.ai). One API key, 100+ models.

| Provider | Model | Cost/run | Best For |
|----------|-------|----------|----------|
| OpenAI | gpt-4o-mini | ~$0.006 | Best value (recommended) |
| Meta | llama-3.1-8b | ~$0.002 | Cheapest |
| Google | gemini-pro | ~$0.005 | Good balance |
| Anthropic | claude-sonnet-4-5 | ~$0.01 | Best editorial quality |
| OpenAI | gpt-4o | ~$0.02 | Premium scoring |

Change models anytime in `config/scoring.json`. Mix and match -- use a cheap model for scoring, a premium model for the editorial.

---

## What It Costs

| Frequency | gpt-4o-mini | gpt-4o | claude-sonnet |
|-----------|-------------|--------|---------------|
| Weekly | ~$0.024/mo | ~$0.08/mo | ~$0.04/mo |
| Daily | ~$0.18/mo | ~$0.60/mo | ~$0.30/mo |

**Infrastructure: $0.** Supabase free tier (500MB) + GitHub Actions free tier (2000 min/mo) + OpenRouter pay-per-use.

You could run this for a year and spend less than a single coffee.

---

## CLI Commands

```bash
# Run the full pipeline
npm run digest:generate

# Preview without saving (safe to run anytime)
npm run digest:generate -- --dry-run

# Test a single source
npm run digest:generate -- --source hackernews

# Dry run with full AI summaries
npm run digest:generate -- --summarize

# Check if all sources are responding
npm run digest:health-check

# See recent newsletters and run history
npm run digest:status
```

---

## Make It Yours

### Change the Topic
```bash
cp examples/configs/finance.json config/sources.json
```

### Change the Voice
Edit `src/curation/editorial.ts`. The default prompt is generic. Replace it with your personality, opinions, and style. **This is the single biggest lever for making your newsletter unique.**

### Add a Source
Add to `config/sources.json`:
```json
{ "name": "My Source", "url": "https://example.com/feed", "source_name": "Example" }
```

### Tune the Scoring
Edit `config/scoring.json`:
- `CANDIDATE_THRESHOLD` -- min score to be a candidate (default: 30)
- `STORIES_PER_SECTION` -- stories per section (default: 5)
- `scoring_model` / `editorial_model` -- which LLMs to use

### Add a New Source Type
1. Create `src/sources/your-source.ts`
2. Extend `BaseSource`, implement `fetchStories()`
3. Add to `getAllSources()` in `src/index.ts`
4. Test: `npm run digest:generate -- --source your-source --dry-run`

---

## Works With Every AI Coding Tool

This repo ships with instruction files for all major AI coding platforms:

| File | Platform | What It Does |
|------|----------|-------------|
| `CLAUDE.md` | Claude Code | Full conversational setup guide |
| `AGENTS.md` | Codex, Copilot, Cursor, Windsurf, Amp, Devin, Replit | Same guide, universal format |
| `GEMINI.md` | Gemini CLI | Same guide, Gemini-optimized |

Open the repo in any tool. Say "set this up for crypto." It reads the instructions and does everything.

---

## Built-In Safety

| Guardrail | What It Does |
|-----------|-------------|
| **LLM call cap** | Max 50 calls per run. Hard limit. Won't exceed. |
| **Token budget** | Max 50K tokens per run. Protects your wallet. |
| **Fault isolation** | One source failing never kills the pipeline. The rest continue. |
| **Health check** | 2+ sources down = entire run skipped. No garbage output. |
| **Deduplication** | sha256 hash of url+title. No story appears twice, ever. |
| **Rate limiting** | Exponential backoff on 429/5xx. Respects API limits. |
| **Idempotent** | Run it twice, get the same result. Safe to retry. |

---

## Project Structure

```
ai-newsletter-agent/
  src/
    sources/              6 source scrapers
      hackernews.ts         Hacker News API (keyword + score filter)
      producthunt.ts        Product Hunt GraphQL (top launches)
      github-trending.ts    GitHub Trending (by topic)
      rss.ts                RSS feeds (configured in sources.json)
      tavily.ts             Tavily Search API (query-based)
      anthropic.ts          Custom HTML scraper (template)
    curation/             AI-powered processing
      score.ts              Scores articles 0-50, 5 criteria
      summarize.ts          Headlines + summaries + "why it matters"
      editorial.ts          Weekly editorial in your voice
    db/                   Supabase operations
    utils/                Logger, rate limiter, helpers
    index.ts              Pipeline orchestrator + CLI

  config/
    sources.json          Your RSS feeds, queries, keywords
    scoring.json          Models, thresholds, limits

  examples/configs/       6 niche configs ready to use
  migrations/             Supabase schema (one SQL file)
  .github/workflows/      Weekly cron (GitHub Actions)
```

---

## Star History

If this saved you time, gave you ideas, or you just think it's cool -- drop a star. It helps others find it.

[![Star this repo](https://img.shields.io/github/stars/anmolgupta824/ai-newsletter-agent?style=for-the-badge&color=yellow)](https://github.com/anmolgupta824/ai-newsletter-agent)

---

## Contributing

Found a bug? Want to add a source type? PRs welcome.

1. Fork the repo
2. Create a branch (`git checkout -b feature/reddit-source`)
3. Make your changes
4. Test: `npm run digest:generate -- --dry-run`
5. Open a PR

---

## License

MIT -- use it however you want. Commercial use, modifications, distribution, all good.

---

<p align="center">
  <b>Built by <a href="https://theainativepm.com">The AI-Native PM</a></b>
  <br/>
  <i>Breaking down the biggest AI stories every week.</i>
  <br/><br/>
  <a href="https://theainativepm.com/digest">Read the Digest</a> | <a href="https://threads.net/@anmolgupta_05">Follow on Threads</a>
</p>
