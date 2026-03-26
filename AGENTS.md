# AI Digest Agent — Instructions for AI Coding Assistants

This file is for AI coding tools: OpenAI Codex, GitHub Copilot, Cursor, Windsurf, Amp, Devin, Replit Agent.

See CLAUDE.md for the full context. Key points for agents:

## Project

Automated weekly digest pipeline. Collects AI news → scores with AI → selects top 25 → writes editorial → stores in Supabase.

## Entry Point

`src/index.ts` — CLI with `--dry-run`, `--source`, `--health-check`, `--status` flags.

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/curation/prompt.ts` | All AI prompts — editorial customization goes here |
| `config/scoring.json` | Thresholds and model selection |
| `config/sources.json` | RSS feeds and search queries |
| `migrations/001-create-tables.sql` | Full Supabase schema |

## Adding a Source

Extend `BaseSource` in `src/sources/base-source.ts`. Implement:
- `fetchStories(): Promise<NormalizedStory[]>` — return normalized stories
- `healthCheck(): Promise<boolean>` — return true if source is reachable
- `readonly sourceName: SourceName` — source identifier

Register in `getAllSources()` in `src/index.ts`.

## Story Interface

```typescript
interface NormalizedStory {
  url: string;
  title: string;
  raw_summary?: string;
  source_name: string;
  source_domain: string;
  source_favicon_url: string;
  og_image_url?: string;
  engagement_stats: Record<string, number>;
  published_at: string;        // ISO 8601
  content_hash: string;        // sha256(url+title)[:16]
}
```

## Editing the Editorial Prompt

`buildEditorialPrompt()` in `src/curation/prompt.ts` returns `{ system: string, user: string }`.
Replace the placeholder with a prompt that defines your voice, required sections, and tone examples.

## Environment

Uses `dotenv` — reads from `.env.local` locally, GitHub Actions secrets in CI.
Copy `.env.example` to `.env.local` and fill in credentials.

## Testing

Always test with `--dry-run` first. No DB writes, shows scoring output.
Use `--source <name>` to test a single source.
