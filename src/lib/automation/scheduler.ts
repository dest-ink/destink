/**
 * Automation scheduler — polls automationSchedules for due runs.
 *
 * Called by the daemon every minute. Finds enabled schedules where
 * nextRunAt <= now, runs research for each, optionally generates drafts,
 * and advances nextRunAt to the next occurrence.
 */

import { db } from '@/db/client';
import { automationSchedules, researchers } from '@/db/schema';
import { eq, and, lte, isNotNull } from 'drizzle-orm';
import { runResearchForResearcher } from '@/lib/research/engine';
import { generateDraftsForRun } from '@/lib/generation/batch';
import { getNextRunAt } from '@/lib/cron-utils';
import type { TopicRecommendation } from '@/db/schema';
import { researchRuns } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function runDueAutomations(): Promise<void> {
  const now = new Date();

  // Find all enabled schedules that are due
  const dueSchedules = await db
    .select()
    .from(automationSchedules)
    .where(
      and(
        eq(automationSchedules.enabled, true),
        isNotNull(automationSchedules.nextRunAt),
        lte(automationSchedules.nextRunAt, now),
      ),
    );

  if (dueSchedules.length === 0) return;

  console.log(`[automation] ${dueSchedules.length} schedule(s) due`);

  for (const schedule of dueSchedules) {
    try {
      console.log(
        `[automation] Running schedule "${schedule.name ?? schedule.id}" for researcher ${schedule.researcherId}`,
      );

      // Run research
      await runResearchForResearcher(schedule.researcherId);

      // If autoDraft is enabled on this schedule (or inherited from researcher), generate drafts
      const shouldAutoDraft = await resolveAutoDraft(schedule);
      if (shouldAutoDraft) {
        const maxDrafts = await resolveMaxDrafts(schedule);
        await autoDraftLatestRun(schedule.researcherId, maxDrafts);
      }

      // Advance nextRunAt
      const nextRun = getNextRunAt(schedule.cronExpression, now);
      await db
        .update(automationSchedules)
        .set({ nextRunAt: nextRun, updatedAt: new Date() })
        .where(eq(automationSchedules.id, schedule.id));

      console.log(
        `[automation] Schedule "${schedule.name ?? schedule.id}" complete. Next run: ${nextRun?.toISOString() ?? 'none'}`,
      );
    } catch (err) {
      console.error(
        `[automation] Schedule "${schedule.name ?? schedule.id}" failed:`,
        err instanceof Error ? err.message : err,
      );
      // Don't stop other schedules — continue to next
    }
  }
}

/**
 * Resolve whether auto-draft is enabled for a schedule.
 * Schedule-level setting overrides researcher default.
 */
async function resolveAutoDraft(schedule: typeof automationSchedules.$inferSelect): Promise<boolean> {
  if (schedule.autoDraft !== null) return schedule.autoDraft;
  const [researcher] = await db
    .select({ autoDraft: researchers.autoDraft })
    .from(researchers)
    .where(eq(researchers.id, schedule.researcherId));
  return researcher?.autoDraft ?? false;
}

/**
 * Resolve max drafts per run for a schedule.
 * Schedule-level setting overrides researcher default.
 */
async function resolveMaxDrafts(schedule: typeof automationSchedules.$inferSelect): Promise<number> {
  if (schedule.maxDraftsPerRun !== null) return schedule.maxDraftsPerRun;
  const [researcher] = await db
    .select({ maxDraftsPerRun: researchers.maxDraftsPerRun })
    .from(researchers)
    .where(eq(researchers.id, schedule.researcherId));
  return researcher?.maxDraftsPerRun ?? 3;
}

/**
 * Generate drafts for the most recent research run of a researcher.
 */
async function autoDraftLatestRun(researcherId: string, maxDrafts: number): Promise<void> {
  // Get the researcher's shortFormPercent
  const [researcher] = await db
    .select({ shortFormPercent: researchers.shortFormPercent })
    .from(researchers)
    .where(eq(researchers.id, researcherId));
  if (!researcher) return;

  // Find the most recent run for this researcher
  const [latestRun] = await db
    .select()
    .from(researchRuns)
    .where(eq(researchRuns.researcherId, researcherId))
    .orderBy(desc(researchRuns.runAt))
    .limit(1);

  if (!latestRun || !latestRun.topicsFound) return;

  const topics = latestRun.topicsFound as TopicRecommendation[];
  if (topics.length === 0) return;

  console.log(`[automation] Auto-drafting up to ${maxDrafts} drafts for run ${latestRun.id}`);
  await generateDraftsForRun(
    latestRun.id,
    latestRun.channelId,
    topics,
    maxDrafts,
    researcher.shortFormPercent,
  );
}
