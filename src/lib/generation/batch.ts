import { randomUUID } from 'crypto';
import { db } from '@/db/client';
import { drafts, channels, researchRuns, draftPreferences } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateDraft } from '@/lib/generation/generator';
import type { TopicRecommendation } from '@/db/schema';
import type { OnProgress } from '@/lib/research/progress';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContentTypeAssignment {
  topic: TopicRecommendation;
  contentType: 'note' | 'article';
}

export interface DraftBatchResult {
  generatedIds: string[];
  failedCount: number;
}

// ─── Pure functions ───────────────────────────────────────────────────────────

/**
 * Deterministically assigns content types to a batch of topics.
 *
 * - Sorts topics by relevanceScore descending, then slices to `count`.
 * - noteCount = Math.round((shortFormPercent / 100) * count)
 * - First `noteCount` slots get 'note', remaining get 'article'.
 * - Tie-breaking: Math.round favors short-form (e.g. 50% of 3 = round(1.5) = 2 notes).
 */
export function assignContentTypes(
  topics: TopicRecommendation[],
  count: number,
  shortFormPercent: number
): ContentTypeAssignment[] {
  const sorted = [...topics].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const sliced = sorted.slice(0, count);
  const noteCount = Math.round((shortFormPercent / 100) * sliced.length);

  return sliced.map((topic, index) => ({
    topic,
    contentType: index < noteCount ? 'note' : 'article',
  }));
}

// ─── Batch generation ─────────────────────────────────────────────────────────

/**
 * Generates drafts for a single channel from the topics of a research run.
 *
 * - Loads channel persona from DB.
 * - Loads recent draft titles for the channel (last 10) to seed dedup.
 * - Skips topics whose titles match existing draft titles (case-insensitive).
 * - Continues past individual generation failures (partial failure tolerance).
 * - Updates researchRuns.draftsGenerated with generated draft IDs.
 */
export async function generateDraftsForRun(
  runId: string,
  channelId: string,
  topics: TopicRecommendation[],
  maxDraftsPerRun: number,
  shortFormPercent: number,
  onProgress?: OnProgress
): Promise<DraftBatchResult> {
  // Load channel for persona prompt and platform
  const [channel] = await db
    .select({ personaPrompt: channels.personaPrompt, platform: channels.platform })
    .from(channels)
    .where(eq(channels.id, channelId));

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  // Load writing style preferences
  const [stylePrefs] = await db.select().from(draftPreferences)
    .where(eq(draftPreferences.channelId, channelId));

  // Load recent draft titles for dedup
  const recentDrafts = await db
    .select({ title: drafts.title })
    .from(drafts)
    .where(eq(drafts.channelId, channelId))
    .orderBy(desc(drafts.createdAt))
    .limit(10);

  const existingTitles = new Set(
    recentDrafts.map((d) => (d.title ?? '').toLowerCase()).filter(Boolean)
  );

  // Also collect recent titles for context (voice consistency)
  const recentTitles = recentDrafts.map((d) => d.title ?? '').filter(Boolean);

  // Assign content types deterministically
  const assignments = assignContentTypes(topics, maxDraftsPerRun, shortFormPercent);
  const total = assignments.length;

  const generatedIds: string[] = [];
  let failedCount = 0;

  for (let i = 0; i < assignments.length; i++) {
    const { topic, contentType } = assignments[i];
    const index = i + 1; // 1-based for display

    // Skip if title already exists in this channel (case-insensitive)
    if (existingTitles.has(topic.title.toLowerCase())) {
      onProgress?.({ type: 'draft-skipped', title: topic.title, reason: 'duplicate title' });
      continue;
    }

    onProgress?.({ type: 'draft-start', index, total, title: topic.title });

    try {
      const draftId = randomUUID();

      const generated = await generateDraft(
        {
          contentType,
          personaPrompt: channel.personaPrompt ?? '',
          topicTitle: topic.title,
          topicAngle: topic.angle,
          sources: topic.sources,
          recentTitles,
          platform: channel.platform as 'linkedin' | 'substack',
          writingStyle: contentType === 'note'
            ? (stylePrefs?.noteStyle ?? undefined)
            : (stylePrefs?.articleStyle ?? undefined),
        },
        channelId,
        draftId
      );

      await db.insert(drafts).values({
        id: draftId,
        channelId,
        researchRunId: runId,
        contentType,
        title: generated.headlineOptions[0] ?? null,
        headlineOptions: generated.headlineOptions,
        hook: generated.hook,
        body: generated.body,
        cta: generated.cta,
        voiceConfidence: generated.voiceConfidence,
        researchSources: topic.sources,
        aiModel: 'claude-sonnet-4-6',
        status: 'pending_review',
      });

      generatedIds.push(draftId);

      // Add to dedup set to prevent intra-batch duplicates
      existingTitles.add(topic.title.toLowerCase());

      onProgress?.({ type: 'draft-complete', index, total, title: topic.title, draftId });
    } catch (err) {
      failedCount++;
      const error = err instanceof Error ? err.message : String(err);
      onProgress?.({ type: 'draft-error', index, total, title: topic.title, error });
    }
  }

  // Update draftsGenerated on the research run if any were created
  if (generatedIds.length > 0) {
    await db
      .update(researchRuns)
      .set({ draftsGenerated: generatedIds })
      .where(eq(researchRuns.id, runId));
  }

  onProgress?.({
    type: 'drafts-done',
    generated: generatedIds.length,
    failed: failedCount,
    draftIds: generatedIds,
  });

  return { generatedIds, failedCount };
}
