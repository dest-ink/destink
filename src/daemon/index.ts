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

async function processPublishQueue() {
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

      if (retryCount >= maxRetries) {
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
    }
  }
}

// Run publish check every minute
schedule('* * * * *', () => {
  processPublishQueue().catch(console.error);
});

console.log('[daemon] Publish loop started — checking queue every minute');
