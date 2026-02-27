import { db } from '@/db/client';
import { publishQueue, drafts, channels } from '@/db/schema';
import { eq, lte, and } from 'drizzle-orm';
import { publishToSubstack } from '@/lib/publishing/substack';
import { publishToLinkedIn } from '@/lib/publishing/linkedin';

export function getRetryDelay(retryCount: number): number {
  const delays = [5, 15, 45];
  return (delays[retryCount - 1] ?? 45) * 60 * 1000;
}

/**
 * Processes all publish queue items that are due now.
 * Dispatches to the appropriate platform publisher, handles per-item errors
 * with exponential back-off retry (max 3 attempts: 5/15/45 min delays),
 * and updates queue + draft status rows.
 *
 * Safe to call from a one-shot CronJob script or a long-running daemon.
 * Contains no in-process scheduling or concurrency locking — callers are
 * responsible for at-most-one concurrent execution (e.g. Kubernetes
 * concurrencyPolicy: Forbid, or an in-process isProcessing flag).
 */
export async function runPublishQueue(): Promise<void> {
  const now = new Date();
  const items = await db
    .select({
      queue: publishQueue,
      draft: drafts,
      channel: channels,
    })
    .from(publishQueue)
    .innerJoin(drafts, eq(publishQueue.draftId, drafts.id))
    .innerJoin(channels, eq(publishQueue.channelId, channels.id))
    .where(
      and(
        lte(publishQueue.scheduledFor, now),
        eq(publishQueue.status, 'queued'),
      ),
    );

  for (const item of items) {
    await db
      .update(publishQueue)
      .set({ status: 'publishing' })
      .where(eq(publishQueue.id, item.queue.id));

    try {
      let platformResponse: unknown;

      if (item.channel.platform === 'substack') {
        platformResponse = await publishToSubstack(item.draft, item.channel);
      } else if (item.channel.platform === 'linkedin') {
        platformResponse = await publishToLinkedIn(item.draft, item.channel);
      } else {
        throw new Error(`Unknown platform '${item.channel.platform}'`);
      }

      await db
        .update(publishQueue)
        .set({ status: 'published', publishedAt: new Date(), platformResponse })
        .where(eq(publishQueue.id, item.queue.id));

      await db
        .update(drafts)
        .set({ status: 'published' })
        .where(eq(drafts.id, item.draft.id));

      console.log(`[queue-runner] Published ${item.draft.title} to ${item.channel.platform}`);
    } catch (err) {
      const retryCount = (item.queue.retryCount ?? 0) + 1;
      const maxRetries = 3;

      try {
        if (retryCount > maxRetries) {
          await db
            .update(publishQueue)
            .set({ status: 'failed', retryCount, errorMessage: String(err) })
            .where(eq(publishQueue.id, item.queue.id));
          console.error(`[queue-runner] Permanently failed: ${item.draft.title}`, err);
        } else {
          const delay = getRetryDelay(retryCount);
          const nextAttempt = new Date(Date.now() + delay);
          await db
            .update(publishQueue)
            .set({
              status: 'queued',
              retryCount,
              scheduledFor: nextAttempt,
              errorMessage: String(err),
            })
            .where(eq(publishQueue.id, item.queue.id));
          console.warn(
            `[queue-runner] Will retry ${item.draft.title} at ${nextAttempt.toISOString()}`,
          );
        }
      } catch (dbErr) {
        // If the retry/fail update itself fails, the item stays stuck in 'publishing'.
        // A future recovery query should reset 'publishing' items older than a timeout window.
        console.error(
          '[queue-runner] Failed to update retry state; item may be stuck:',
          item.queue.id,
          dbErr,
        );
      }
    }
  }
}
