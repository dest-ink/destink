import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getUserId } from '@/lib/auth-utils';
import { db } from '@/db/client';
import { publishQueue, drafts, channels } from '@/db/schema';
import { asc, eq, and } from 'drizzle-orm';
import { QueueTimeline } from '@/components/queue/QueueTimeline';
import type { QueueItemData } from '@/components/queue/QueueItem';

export const dynamic = 'force-dynamic';

// ─── Date bucket helpers ────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getBucket(scheduledFor: Date, now: Date): string {
  const todayStart = startOfDay(now);
  const itemStart = startOfDay(scheduledFor);
  const diffDays = Math.round((itemStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Past';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 6) return 'This Week';
  return 'Later';
}

const BUCKET_ORDER = ['Today', 'Tomorrow', 'This Week', 'Later', 'Past'];

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function QueuePage() {
  const session = await auth();
  const userId = await getUserId(session);
  if (!userId) redirect('/login');

  let rows: QueueItemData[] = [];
  let fetchError = false;

  try {
    const result = await db
      .select({
        id: publishQueue.id,
        draftId: publishQueue.draftId,
        channelId: publishQueue.channelId,
        scheduledFor: publishQueue.scheduledFor,
        publishedAt: publishQueue.publishedAt,
        status: publishQueue.status,
        retryCount: publishQueue.retryCount,
        errorMessage: publishQueue.errorMessage,
        createdAt: publishQueue.createdAt,
        draftTitle: drafts.title,
        draftHook: drafts.hook,
        draftContentType: drafts.contentType,
        channelName: channels.name,
        channelPlatform: channels.platform,
      })
      .from(publishQueue)
      .innerJoin(drafts, eq(publishQueue.draftId, drafts.id))
      .innerJoin(channels, eq(publishQueue.channelId, channels.id))
      .where(eq(channels.userId, userId))
      .orderBy(asc(publishQueue.scheduledFor));

    rows = result as QueueItemData[];
  } catch (e) {
    console.error('[QueuePage] DB fetch failed:', e);
    fetchError = true;
  }

  // Group items into date buckets
  const now = new Date();
  const bucketMap = new Map<string, QueueItemData[]>();

  for (const item of rows) {
    const bucket = getBucket(new Date(item.scheduledFor), now);
    if (!bucketMap.has(bucket)) {
      bucketMap.set(bucket, []);
    }
    bucketMap.get(bucket)!.push(item);
  }

  // Build ordered groups (skip empty buckets).
  // 'Past' items are reversed so the most recent failures appear first.
  const groups = BUCKET_ORDER
    .filter(label => bucketMap.has(label))
    .map(label => ({
      label,
      items: label === 'Past'
        ? [...bucketMap.get(label)!].reverse()
        : bucketMap.get(label)!,
    }));

  const totalCount = rows.length;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <h1 className="text-xl font-semibold text-foreground">Publish Queue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {fetchError
            ? 'Could not load queue'
            : `${totalCount} ${totalCount === 1 ? 'item' : 'items'} scheduled`}
        </p>
      </div>

      {/* DB error state */}
      {fetchError && (
        <div className="m-6 border border-destructive/30 bg-destructive/5 rounded-lg p-4 text-sm text-destructive">
          Failed to load queue — check that the database is reachable.
        </div>
      )}

      {/* Timeline (handles empty state internally) */}
      {!fetchError && (
        <div className="flex-1 p-6 overflow-y-auto">
          <QueueTimeline groups={groups} />
        </div>
      )}
    </div>
  );
}
