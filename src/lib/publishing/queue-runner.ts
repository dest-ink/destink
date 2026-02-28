import { db } from '@/db/client';
import { publishQueue, drafts, channels } from '@/db/schema';
import { eq, lte, and, lt } from 'drizzle-orm';
import { publisherRegistry } from '@/lib/publishing/publisher-registry';

export function getRetryDelay(retryCount: number): number {
  const delays = [5, 15, 45];
  return (delays[retryCount - 1] ?? 45) * 60 * 1000;
}

/**
 * Resets queue items stuck in 'publishing' status back to 'queued'.
 *
 * Detection uses createdAt (not a processing-start timestamp, which doesn't exist
 * on the publishQueue table). This is a conservative heuristic: items created more
 * than 15 minutes ago AND still in 'publishing' are assumed stuck. In practice,
 * publishes complete in seconds, so this threshold is safe.
 *
 * If a processingStartedAt column is added in the future, switch detection to
 * use that column for more precise stuck-item identification.
 *
 * User decision: no retry limit tracking for recovery — items reset indefinitely.
 */
export async function recoverStuckItems(): Promise<void> {
  const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);

  const stuck = await db
    .select({ id: publishQueue.id })
    .from(publishQueue)
    .where(
      and(
        eq(publishQueue.status, 'publishing'),
        lt(publishQueue.createdAt, cutoff),
      ),
    );

  for (const item of stuck) {
    await db
      .update(publishQueue)
      .set({ status: 'queued' })
      .where(eq(publishQueue.id, item.id));
    console.warn(`[queue-runner] Recovered stuck item ${item.id} — reset to queued`);
  }
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

      const provider = publisherRegistry.get(item.channel.platform);
      if (!provider) {
        throw new Error(`No publisher registered for platform '${item.channel.platform}'`);
      }
      platformResponse = await provider.publish(item.draft, item.channel);

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
