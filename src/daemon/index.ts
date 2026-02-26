import { schedule } from 'node-cron';
import { db } from '@/db/client';
import { publishQueue, drafts, channels } from '@/db/schema';
import { eq, lte, and } from 'drizzle-orm';
import { publishToSubstack } from '@/lib/publishing/substack';
import { publishToLinkedIn } from '@/lib/publishing/linkedin';

export function getRetryDelay(retryCount: number): number {
  const delays = [5, 15, 45];
  return (delays[retryCount - 1] ?? 45) * 60 * 1000;
}

// Module-level lock: prevents overlapping runs within the same process.
// This daemon is designed to run as a single Kubernetes CronJob instance
// (concurrencyPolicy: Forbid), so in-process locking is sufficient.
let isProcessing = false;

async function processPublishQueue() {
  if (isProcessing) {
    console.warn('[daemon] Previous run still in progress — skipping this tick');
    return;
  }
  isProcessing = true;

  try {
    const now = new Date();
    const items = await db.select({
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
        eq(publishQueue.status, 'queued')
      )
    );

    for (const item of items) {
      await db.update(publishQueue)
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

        await db.update(publishQueue)
          .set({ status: 'published', publishedAt: new Date(), platformResponse })
          .where(eq(publishQueue.id, item.queue.id));

        await db.update(drafts)
          .set({ status: 'published' })
          .where(eq(drafts.id, item.draft.id));

        console.log(`[daemon] Published ${item.draft.title} to ${item.channel.platform}`);

      } catch (err) {
        const retryCount = (item.queue.retryCount ?? 0) + 1;
        const maxRetries = 3;

        try {
          if (retryCount > maxRetries) {
            await db.update(publishQueue)
              .set({ status: 'failed', retryCount, errorMessage: String(err) })
              .where(eq(publishQueue.id, item.queue.id));
            console.error(`[daemon] Permanently failed: ${item.draft.title}`, err);
          } else {
            const delay = getRetryDelay(retryCount);
            const nextAttempt = new Date(Date.now() + delay);
            await db.update(publishQueue)
              .set({ status: 'queued', retryCount, scheduledFor: nextAttempt, errorMessage: String(err) })
              .where(eq(publishQueue.id, item.queue.id));
            console.warn(`[daemon] Will retry ${item.draft.title} at ${nextAttempt.toISOString()}`);
          }
        } catch (dbErr) {
          // If the retry/fail update itself fails, the item stays stuck in 'publishing'.
          // A future recovery query should reset items in 'publishing' older than a timeout window.
          console.error('[daemon] Failed to update retry state; item may be stuck in publishing:', item.queue.id, dbErr);
        }
      }
    }
  } finally {
    isProcessing = false;
  }
}

// Run publish check every minute
schedule('* * * * *', () => {
  processPublishQueue().catch(console.error);
});

console.log('[daemon] Publish loop started — checking queue every minute');
