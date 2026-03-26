# Sample Output

This is an example of what the pipeline produces after a full run with a tuned editorial prompt.
The pipeline collects 90+ articles, scores them, selects the top 25, and writes the editorial.

---

## Dry Run Preview (--dry-run)

```
============================================================
  AI Digest Agent — Dry Run Preview
============================================================

  Sources:
    OK    hackernews  34 stories  (1.2s)
    OK    producthunt  18 stories  (2.1s)
    OK    github  20 stories  (0.8s)
    OK    rss  22 stories  (3.4s)
    OK    tavily  12 stories  (4.2s)
    OK    anthropic  8 stories  (1.1s)

  Candidates (score >= 30): 31
  Auto-selected (top 5/section): 20

  Top 10 stories:
    ⭐ [47/50] [top_story  ] OpenAI acquires Rockset for real-time analytics
    ⭐ [45/50] [launch     ] Cursor hits $500M ARR, announces enterprise tier
    ⭐ [43/50] [stat       ] Anthropic: Claude usage up 3x in 90 days
    ⭐ [42/50] [pm_corner  ] Lenny's Survey: Top PMs spend 40% on discovery
    ⭐ [41/50] [launch     ] Microsoft AutoGen 2.0: multi-agent framework
    ⭐ [40/50] [top_story  ] Google Gemini 1.5 Pro context: 1M tokens, free tier
    ⭐ [38/50] [launch     ] Firecrawl v2: LLM-ready web scraping API
    ⭐ [37/50] [stat       ] GitHub Copilot: 1.8M paid users, $100M ARR
      [36/50] [launch     ] LangChain releases LangGraph Studio
      [35/50] [pm_corner  ] How Figma defines PM levels: complete breakdown

============================================================
```

---

## Editorial Output (sample — with a tuned prompt)

The editorial your pipeline generates depends entirely on the prompt in `src/curation/editorial.ts`.
The included placeholder prompt produces a basic but functional editorial.

A well-tuned editorial looks like this:

---

### 🔥 The Big One

**Everyone's making AI startup lists. Nobody's making AI startups.**

Four separate "top generative AI startups" lists dropped this week. GreyB picked 10, Seedtable found 69, eWeek crowned 75. Meanwhile, the one company actually *shipping* something — **OpenCode** — got less coverage than any of them.

- **What happened** — Four major ranking lists published in 7 days. Zero of the "top" companies announced a meaningful product this week.
- **Why now** — We're in the hype cycle peak. Analysts need content. Startups need PR. Lists are the path of least resistance for both.
- **What this means for you** — If your go-to-market strategy involves getting on lists, you're optimizing for the wrong metric. Shipping beats ranking.

---

### 🚀 What Launched

- **OpenCode** open-source coding agent, gaining GitHub velocity fast (HN, 892 pts)
- **AWS Generative AI Accelerator** 8-week hybrid program for agentic AI startups
- **Firecrawl v2** web scraping API with LLM-ready output
- **AutoGen 2.0** Microsoft multi-agent framework, now with visual workflow builder

---

### 👀 Three Signals

→ **Cursor's $500M ARR is a benchmark, not a ceiling.** If you're building dev tooling without a paid tier, this is your data point.

→ **The "AI checkout" experiment is over.** Walmart published the data: 3x worse conversion when you replace the buy button with a chat interface. Build AI *behind* the experience, not on top of it.

→ **Context windows are about to make RAG optional.** Gemini 1.5 Pro at 1M tokens changes the architecture conversation — check your assumptions before building another vector pipeline.

---

### 💬 Final Note

The companies worth watching this week weren't the ones getting listed — they were the ones shipping. OpenCode launched quietly and gained more GitHub stars in 72 hours than most "top AI startups" have in a year. Next Monday, check who shipped something, not who ranked somewhere.

---

### 😂 Joke of the Week

> "My product roadmap has three states: 'This Quarter', 'Next Quarter', and 'AI will handle it.'"
> — Your Digest Team

---

## Supabase Output

After a full run, your Supabase database contains:

**`digests` table:**
```json
{
  "id": "uuid",
  "issue_number": 1,
  "week_of": "2026-03-23",
  "status": "published",
  "published_at": "2026-03-28T06:00:00Z"
}
```

**`digest_stories` table (per story):**
```json
{
  "digest_id": "uuid",
  "category": "launch",
  "headline": "Cursor Hits $500M ARR Before Most SaaS Hits $5M",
  "summary": "Cursor announced $500M ARR this week...",
  "pm_takeaway": "If you're building dev tooling without a paid tier, this is your benchmark.",
  "source_url": "https://cursor.sh/blog/...",
  "source_name": "Cursor Blog",
  "og_image_url": "https://...",
  "ai_score": 45,
  "score_breakdown": { "relevance": 10, "signal": 9, "freshness": 9, "credibility": 9, "engagement": 8 },
  "ai_selected": true,
  "status": "published",
  "week_of": "2026-03-23",
  "content_hash": "a3f7b1c2d4e5f6a7"
}
```
