# AI Digest Agent — Gemini CLI Instructions

This file is for Gemini CLI. See CLAUDE.md for full project context.

## Quick Reference

**Run pipeline:** `npm run digest:generate`
**Dry run (no DB):** `npm run digest:generate -- --dry-run`
**Single source:** `npm run digest:generate -- --source hackernews`
**Health check:** `npm run digest:health-check`

## What to Customize

1. **Editorial voice:** `src/curation/prompt.ts` → `buildEditorialPrompt()`
2. **Sources:** `config/sources.json` → add RSS feeds or Tavily queries
3. **Scoring:** `config/scoring.json` → change thresholds or model

## Database Setup

Run `migrations/001-create-tables.sql` in Supabase Studio before first use.

## Environment

Copy `.env.example` to `.env.local`. Required keys:
- `OPENROUTER_API_KEY`
- `TAVILY_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
