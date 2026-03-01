import { db } from '@/db/client';
import { publishQueue, drafts, channels } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { publisherRegistry, initPublisherRegistry } from '@/lib/publishing/publisher-registry';
import { getRetryDelay } from '@/lib/publishing/queue-runner';

/**
 * Publishes a single queue item by ID.
 *
 * Designed for fire-and-forget use from the publish-now API route.
 * Uses the same retry logic as runPublishQueue():
 * - Exponential back-off (5/15/45 min, max 3 retries)
 * - On permanent failure, sets status to 'failed'
 *
 * Assumes the item is already in 'publishing' status (set by the API route
 * before calling this function).
 */
export async function publishSingleItem(queueItemId: string): Promise<void> {
  if (publisherRegistry.keys().length === 0) {
    await initPublisherRegistry();
  }

  const [item] = await db
    .select({
      queue: publishQueue,
      draft: drafts,
      channel: channels,
    })
    .from(publishQueue)
    .innerJoin(drafts, eq(publishQueue.draftId, drafts.id))
    .innerJoin(channels, eq(publishQueue.channelId, channels.id))
    .where(eq(publishQueue.id, queueItemId));

  if (!item) {
    console.error(`[publish-single] Queue item ${queueItemId} not found`);
    return;
  }

  try {
    const provider = publisherRegistry.get(item.channel.platform);
    if (!provider) {
      throw new Error(`No publisher registered for platform '${item.channel.platform}'`);
    }

    const platformResponse = await provider.publish(item.draft, item.channel);

    await db
      .update(publishQueue)
      .set({ status: 'published', publishedAt: new Date(), platformResponse })
      .where(eq(publishQueue.id, item.queue.id));

    await db
      .update(drafts)
      .set({ status: 'published' })
      .where(eq(drafts.id, item.draft.id));

    console.log(`[publish-single] Published ${item.draft.title} to ${item.channel.platform}`);
  } catch (err) {
    const retryCount = (item.queue.retryCount ?? 0) + 1;
    const maxRetries = 3;

    if (retryCount > maxRetries) {
      await db
        .update(publishQueue)
        .set({ status: 'failed', retryCount, errorMessage: String(err) })
        .where(eq(publishQueue.id, item.queue.id));
      console.error(`[publish-single] Permanently failed: ${item.draft.title}`, err);
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
        `[publish-single] Will retry ${item.draft.title} at ${nextAttempt.toISOString()}`,
      );
    }
  }
}
