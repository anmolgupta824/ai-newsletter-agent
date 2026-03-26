import { getSupabaseClient } from './client.js';
import { ScoredStory } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Get the Monday of the current week as YYYY-MM-DD.
 */
export function getWeekOf(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diff = (day === 0 ? -6 : 1) - day; // back to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

/**
 * Get or create a digest record for the given week.
 * Returns the digest id and issue_number.
 */
export async function getOrCreateDigest(weekOf: string): Promise<{ id: string; issue_number: number }> {
  const db = getSupabaseClient();

  // Check if a digest already exists for this week (any status)
  const { data: existing } = await db
    .from('digests')
    .select('id, issue_number')
    .eq('week_of', weekOf)
    .maybeSingle();

  if (existing) {
    return { id: existing.id as string, issue_number: existing.issue_number as number };
  }

  // Get next issue number
  const { data: maxRow } = await db
    .from('digests')
    .select('issue_number')
    .order('issue_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextIssueNumber = ((maxRow?.issue_number as number | null) ?? 0) + 1;

  const { data: created, error } = await db
    .from('digests')
    .insert({ issue_number: nextIssueNumber, week_of: weekOf, status: 'generating' })
    .select('id, issue_number')
    .single();

  if (error || !created) {
    throw new Error(`Failed to create digest: ${error?.message ?? 'unknown error'}`);
  }

  logger.info(`Created digest #${nextIssueNumber}`, { week_of: weekOf, id: created.id });
  return { id: created.id as string, issue_number: created.issue_number as number };
}

/**
 * Get content_hashes already stored for this week (for dedup).
 */
export async function getExistingHashes(weekOf: string): Promise<Set<string>> {
  const db = getSupabaseClient();

  const { data } = await db
    .from('digest_stories')
    .select('content_hash')
    .eq('week_of', weekOf);

  const hashes = new Set<string>();
  for (const row of data ?? []) {
    if (row.content_hash) hashes.add(row.content_hash as string);
  }
  return hashes;
}

/**
 * Store scored stories to Supabase.
 * Skips stories whose content_hash already exists for this week.
 * Returns count of inserted stories.
 */
export async function storeStories(
  stories: ScoredStory[],
  digestId: string,
  weekOf: string
): Promise<number> {
  const db = getSupabaseClient();

  if (stories.length === 0) return 0;

  const rows = stories.map(story => ({
    digest_id: digestId,
    category: story.category,
    headline: story.headline ?? story.title,
    summary: story.summary ?? story.raw_summary ?? '',
    why_it_matters: story.why_it_matters ?? null,
    raw_summary: story.raw_summary ?? null,
    source_url: story.url,
    source_name: story.source_name,
    og_image_url: story.og_image_url ?? null,
    source_favicon_url: story.source_favicon_url,
    engagement_stats: story.engagement_stats,
    ai_score: story.ai_score,
    score_breakdown: story.score_breakdown,
    ai_selected: story.ai_selected,
    user_selected: story.ai_selected ? true : null,
    status: story.ai_selected ? 'published' : 'candidate',
    published_at: story.published_at,
    week_of: weekOf,
    content_hash: story.content_hash,
  }));

  // Upsert — conflict on (content_hash, week_of) → update score/summary if story re-scraped
  const { data, error } = await db
    .from('digest_stories')
    .upsert(rows, { onConflict: 'content_hash,week_of', ignoreDuplicates: false })
    .select('id');

  if (error) {
    throw new Error(`Failed to store stories: ${error.message}`);
  }

  return data?.length ?? 0;
}

/**
 * Save generated editorial to the digest record.
 */
export async function saveEditorial(digestId: string, editorial: string): Promise<void> {
  const db = getSupabaseClient();
  const { error } = await db
    .from('digests')
    .update({ editorial })
    .eq('id', digestId);
  if (error) {
    logger.warn('Failed to save editorial', { error: error.message });
  }
}

/**
 * Set digest status to 'published' with current timestamp.
 * Called automatically at end of pipeline — no human review needed.
 */
export async function publishDigest(digestId: string): Promise<void> {
  const db = getSupabaseClient();
  const { error } = await db
    .from('digests')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', digestId);
  if (error) {
    throw new Error(`Failed to publish digest: ${error.message}`);
  }
  logger.info('Digest published', { digestId });
}

/**
 * Log a pipeline run to digest_run_logs.
 */
export async function logRun(params: {
  run_type: string;
  status: string;
  sources_available: number;
  stories_collected: number;
  tokens_used: number;
  cost_estimate: number;
  error_message?: string;
}): Promise<void> {
  const db = getSupabaseClient();

  const { error } = await db.from('digest_run_logs').insert({
    run_type: params.run_type,
    status: params.status,
    sources_available: params.sources_available,
    stories_collected: params.stories_collected,
    tokens_used: params.tokens_used,
    cost_estimate: params.cost_estimate,
    error_message: params.error_message ?? null,
  });

  if (error) {
    logger.warn('Failed to log run', { error: error.message });
  }
}

/**
 * Get recent run logs for --status display.
 */
export async function getRecentRunLogs(limit = 10): Promise<Record<string, unknown>[]> {
  const db = getSupabaseClient();

  const { data } = await db
    .from('digest_run_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as Record<string, unknown>[];
}

/**
 * Get recent digest summary for --status display.
 */
export async function getDigestStats(): Promise<{
  total_digests: number;
  published: number;
  draft: number;
  total_stories: number;
  latest_issue?: number;
}> {
  const db = getSupabaseClient();

  const [digestsRes, storiesRes] = await Promise.all([
    db.from('digests').select('issue_number, status'),
    db.from('digest_stories').select('id', { count: 'exact', head: true }),
  ]);

  const digests = digestsRes.data ?? [];
  const published = digests.filter(d => d.status === 'published').length;
  const draft = digests.filter(d => d.status === 'draft').length;
  const maxIssue = digests.reduce((max, d) => Math.max(max, d.issue_number as number), 0);

  return {
    total_digests: digests.length,
    published,
    draft,
    total_stories: storiesRes.count ?? 0,
    latest_issue: maxIssue > 0 ? maxIssue : undefined,
  };
}
