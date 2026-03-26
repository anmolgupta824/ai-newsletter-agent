# AI Digest Agent — Architecture

## Pipeline Flow

```
┌─────────────────────────────────────────────────────────┐
│                   AI DIGEST AGENT                        │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐           │
│  │ Hacker   │   │ Product  │   │ GitHub   │           │
│  │ News API │   │ Hunt API │   │ Trending │           │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘           │
│       │              │              │                   │
│  ┌────┴─────┐   ┌────┴─────┐   ┌───┴──────┐           │
│  │ RSS      │   │ Tavily   │   │ Custom   │           │
│  │ Feeds    │   │ Search   │   │ Scraper  │           │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘           │
│       │              │              │                   │
│       └──────────────┼──────────────┘                   │
│                      ▼                                  │
│            ┌─────────────────┐                          │
│            │  90+ raw stories │                         │
│            └────────┬────────┘                          │
│                     ▼                                   │
│            ┌─────────────────┐                          │
│            │  DEDUP          │  hash-based               │
│            │  sha256(url+    │  no AI needed             │
│            │  title)[:16]    │                           │
│            └────────┬────────┘                          │
│                     ▼                                   │
│            ┌─────────────────┐                          │
│            │  🤖 AI SCORING  │  gpt-4o-mini             │
│            │  5 criteria     │  via OpenRouter           │
│            │  0-50 score     │  ~30 calls                │
│            └────────┬────────┘                          │
│                     ▼                                   │
│            ┌─────────────────┐                          │
│            │  Top 25 selected │                         │
│            │  5 per section   │                         │
│            └────────┬────────┘                          │
│                     ▼                                   │
│            ┌─────────────────┐                          │
│            │  🤖 SUMMARIZE   │  gpt-4o-mini             │
│            │  headline       │  via OpenRouter           │
│            │  summary        │  ~10 calls                │
│            │  why it matters │                           │
│            └────────┬────────┘                          │
│                     ▼                                   │
│            ┌─────────────────┐                          │
│            │  🤖 EDITORIAL   │  your chosen model        │
│            │  weekly take    │  via OpenRouter            │
│            │  600-1000 words │  1 call                    │
│            └────────┬────────┘                          │
│                     ▼                                   │
│            ┌─────────────────┐                          │
│            │  💾 SUPABASE    │  stores everything        │
│            │  digests table  │                           │
│            │  stories table  │                           │
│            └────────┬────────┘                          │
│                     ▼                                   │
│            ┌─────────────────┐                          │
│            │  ✅ PUBLISHED   │                          │
│            └─────────────────┘                          │
│                                                         │
│  🤖 = AI used (3 steps, ~41 calls, ~$0.006/run)        │
└─────────────────────────────────────────────────────────┘
```

## Where AI Is Used

| Step | Model | Calls | Purpose |
|------|-------|-------|---------|
| Scoring | gpt-4o-mini | ~30 | Rate 90+ articles on 5 criteria (0-50) |
| Summarization | gpt-4o-mini | ~10 | Write headline + summary + "why it matters" |
| Editorial | configurable | 1 | Write the weekly take |

**Total: ~41 calls, ~$0.006/run**

## Data Flow

```
Source APIs → NormalizedStory[] → ScoredStory[] → Summarized → digest_stories table
                                                             → digests table (editorial)
```

## Fault Isolation

Each source runs independently. If one fails, the pipeline continues with the remaining 5.
If 3+ sources fail, the run is skipped and logged.

## Dedup

Stories are deduped by `sha256(normalized_url + "|" + title.toLowerCase())[:16]`.
Same story from different sources → kept once. Same story in different weeks → kept both.
