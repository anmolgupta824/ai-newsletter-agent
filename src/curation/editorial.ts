import { getOpenRouterClient } from './client.js';
import { buildEditorialPrompt } from './prompt.js';
import { ScoredStory } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getScoringConfig(): { editorial_model: string } {
  try {
    return JSON.parse(readFileSync(join(__dirname, '../../config/scoring.json'), 'utf-8'));
  } catch {
    return { editorial_model: 'openai/gpt-4o-mini' };
  }
}

// --- Quality validation ---

function validateEditorial(text: string): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Word count
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 400) reasons.push(`Too short: ${wordCount} words (min 400)`);
  if (wordCount > 1500) reasons.push(`Too long: ${wordCount} words (max 1500)`);

  // Required sections (matches placeholder prompt structure)
  for (const emoji of ['🔥', '🚀', '👀', '💬', '😂']) {
    if (!text.includes(emoji)) reasons.push(`Missing section: ${emoji}`);
  }

  // Bad openings (check first 120 chars)
  const firstLine = text.slice(0, 120).toLowerCase();
  for (const bad of ['this week', 'welcome', 'in this edition']) {
    if (firstLine.includes(bad)) reasons.push(`Bad opening: starts with "${bad}"`);
  }

  return { valid: reasons.length === 0, reasons };
}

// --- Main ---

/**
 * Generate the weekly editorial for a digest issue.
 * Uses the model configured in config/scoring.json (editorial_model field).
 */
export async function generateEditorial(
  stories: ScoredStory[],
): Promise<string | null> {
  const selected = stories.filter(s => s.ai_selected);
  if (selected.length === 0) {
    logger.warn('No ai_selected stories — skipping editorial generation');
    return null;
  }

  const storyInputs = selected.map(s => ({
    headline: s.headline ?? s.title,
    summary: s.summary ?? s.raw_summary ?? '',
    why_it_matters: s.why_it_matters ?? null,
    category: s.category,
    source_name: s.source_name,
    og_image_url: s.og_image_url ?? null,
    ai_score: s.ai_score ?? null,
    url: s.url ?? '',
  }));

  const allCandidates = stories
    .filter(s => (s.ai_score ?? 0) >= 30)
    .map(s => ({
      headline: s.headline ?? s.title,
      category: s.category,
      source_name: s.source_name,
      ai_score: s.ai_score ?? null,
      url: s.url ?? '',
    }));

  const { editorial_model: modelId } = getScoringConfig();
  const client = getOpenRouterClient();
  const { system, user } = buildEditorialPrompt(storyInputs, allCandidates);

  const callLLM = async (messages: Array<{ role: string; content: string }>) => {
    const response = await client.chat.completions.create({
      model: modelId,
      max_tokens: 2000,
      temperature: 0.8,
      messages: messages as Parameters<typeof client.chat.completions.create>[0]['messages'],
    });
    return response.choices[0]?.message?.content?.trim() ?? '';
  };

  try {
    const editorial = await callLLM([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);

    if (editorial.length < 200) {
      logger.warn('Editorial too short', { model: modelId, length: editorial.length });
      return null;
    }

    logger.info('Editorial generated', { model: modelId, length: editorial.length });

    // Validate quality — retry once if it fails
    const validation = validateEditorial(editorial);
    if (!validation.valid) {
      logger.warn('Editorial failed quality checks — retrying once', { reasons: validation.reasons });

      const retryPrompt = `Your editorial failed quality checks:\n${validation.reasons.map(r => `- ${r}`).join('\n')}\n\nRewrite it. Follow the required section structure exactly.`;
      const retried = await callLLM([
        { role: 'system', content: system },
        { role: 'user', content: user },
        { role: 'assistant', content: editorial },
        { role: 'user', content: retryPrompt },
      ]);

      if (retried.length > 200) {
        logger.info('Retry editorial accepted', { model: modelId, length: retried.length });
        return retried;
      }
    }

    return editorial;
  } catch (err) {
    logger.warn('Editorial generation failed', { model: modelId, error: String(err) });
    return null;
  }
}
