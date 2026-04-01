import { NormalizedStory } from '../types/index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load topic and audience from config/sources.json.
 * These drive ALL prompts — change the config, change the newsletter.
 */
function getNewsletterConfig(): { topic: string; audience: string } {
  try {
    const config = JSON.parse(readFileSync(join(__dirname, '../../config/sources.json'), 'utf-8'));
    return {
      topic: config.topic ?? 'Technology',
      audience: config.audience ?? 'tech professionals and enthusiasts',
    };
  } catch {
    return { topic: 'Technology', audience: 'tech professionals and enthusiasts' };
  }
}

/**
 * Build the batch scoring prompt.
 * Sends all stories in one call — returns structured JSON scores.
 */
export function buildScoringPrompt(stories: NormalizedStory[]): string {
  const { topic, audience } = getNewsletterConfig();

  const storyList = stories.map((s, i) => ({
    index: i,
    title: s.title,
    url: s.url,
    source: s.source_name,
    engagement: s.engagement_stats,
    published: s.published_at.slice(0, 10),
    snippet: s.raw_summary?.slice(0, 150) ?? '',
  }));

  return `You are the editor of a weekly ${topic} newsletter for ${audience}.

Score each article for inclusion in this week's newsletter.

## Scoring criteria (each 0-10, total 0-50):
1. **Relevance** — Is it directly about ${topic}? (core topic = 10, tangential = 3, unrelated = 0)
2. **Signal** — Is it actionable? Can a reader DO something with this? (launch = high, opinion piece = low)
3. **Freshness** — Published this week? (7 days = 10, older = lower)
4. **Credibility** — Known source, official blog, or well-sourced? (major publication = 10, random blog = 3)
5. **Engagement** — Community-validated? (HN 100+ points, PH 200+ upvotes = high)

## Category assignment (pick one):
- **top_story** — A single concrete event: a major product launch, funding round, acquisition, or breakthrough. Must be a specific action by a specific company. NOT a listicle, ranking, or trend piece.
- **launch** — New tool, open-source repo, product update, SDK release, API launch
- **deep_dive** — Analysis, insights, frameworks, research findings, expert perspectives relevant to ${topic}
- **stat** — Quantitative insight: growth stats, survey data, market numbers, benchmark results

## Threshold: Score 30+ enters candidate pool. Score 35+ = pre-selected.

## Stories to score:
${JSON.stringify(storyList, null, 2)}

## Response format (JSON array, one entry per story, same order as input):
[
  {
    "index": 0,
    "relevance": 9,
    "signal": 8,
    "freshness": 10,
    "credibility": 9,
    "engagement": 7,
    "total": 43,
    "category": "launch"
  }
]

Return ONLY the JSON array. No explanation.`;
}

/**
 * Build the summarize prompt for a single story.
 */
export function buildSummarizePrompt(story: NormalizedStory, category: string): string {
  const { topic, audience } = getNewsletterConfig();

  return `You are the editor of a weekly ${topic} newsletter for ${audience}.

Write a newsletter entry for this ${category} story.

## Story:
Title: ${story.title}
Source: ${story.source_name}
URL: ${story.url}
Snippet: ${story.raw_summary?.slice(0, 500) ?? '(no snippet)'}
Engagement: ${JSON.stringify(story.engagement_stats)}

## Write:
1. **Headline** — max 10 words, punchy, specific. Not the original title — rewrite it.

2. **Summary** — 2-3 sentences. What launched? What changed? What's the number?

3. **Why it matters** — 1-2 sentences. Be specific and opinionated.
   - Name a specific company, number, or action — no generic claims
   - Write like a smart friend texting you, not a press release

4. **Category** — confirm: ${category} (change if wrong)

## Response format (JSON):
{
  "headline": "...",
  "summary": "...",
  "why_it_matters": "...",
  "category": "${category}"
}

Return ONLY the JSON. No explanation.`;
}

/**
 * Build the editorial prompt.
 *
 * THIS IS A PLACEHOLDER — replace it with your own voice and personality.
 *
 * The editorial is the most important part of your newsletter. It's what makes
 * readers feel like they're getting YOUR take, not just a list of links.
 *
 * See examples/sample-output.md for what a tuned editorial looks like.
 * See docs/flow-diagram.md for where this fits in the pipeline.
 *
 * Tips for writing your editorial prompt:
 * - Define a persona with strong opinions and a specific audience
 * - Give it a required section structure (headlines, bullets, etc.)
 * - Include tone examples (good vs bad openings, good vs bad analysis)
 * - Add a few-shot example of the exact quality you want
 * - Specify word count (800-1200 words works well)
 *
 * The included prompt below is intentionally minimal.
 * It works, but it won't have YOUR voice. Customize it.
 */
export function buildEditorialPrompt(
  selectedStories: Array<{
    headline: string;
    summary: string;
    why_it_matters: string | null;
    category: string;
    source_name: string;
    og_image_url: string | null;
    ai_score: number | null;
    url: string;
  }>,
  allCandidates?: Array<{
    headline: string;
    category: string;
    source_name: string;
    ai_score: number | null;
    url: string;
  }>,
): { system: string; user: string } {
  const { topic, audience } = getNewsletterConfig();

  const storyList = selectedStories.map((s, i) => `
[${i}] ${s.headline}
Source: ${s.source_name} | Score: ${s.ai_score ?? 0}/50 | Category: ${s.category}
Summary: ${s.summary}
Why it matters: ${s.why_it_matters ?? ''}
`).join('\n---\n');

  const system = `You are the editor of a weekly ${topic} newsletter.
Your readers are ${audience}.
Write in a clear, opinionated voice. Be specific. Use real numbers and company names.
Short paragraphs. Strong opinions. No filler.

TODO: Replace this prompt with your own voice and personality.
See src/curation/prompt.ts for instructions.`;

  const user = `Here are this week's top ${topic} stories:

${storyList}

Write a weekly editorial (600-1000 words) covering the most important stories.

Structure:
### The Big One
The single most important story. What happened, why it matters, what readers should do.

### What Launched
Bullet list of notable launches this week.
- **Product name** — what it does in <10 words [story_id: n]

### Three Signals
Three forward-looking observations based on this week's stories.
> **Bold signal.** 1 sentence max.

### Final Note
2-3 sentences. Your closing thought for the week.

### Joke of the Week
One short ${topic}-related joke.
> "The joke."
> — Your Newsletter Team

Be specific. Name companies and numbers. No generic takes.`;

  return { system, user };
}
