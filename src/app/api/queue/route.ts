import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { publishQueue, drafts, channels } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';

const VALID_STATUSES = ['queued', 'publishing', 'published', 'failed'] as const;
type QueueStatus = typeof VALID_STATUSES[number];

export const GET = auth(function GET(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const { searchParams } = new URL(req.url);
      const rawStatus = searchParams.get('status');
      // Validate status filter before passing to DB — rejects unknown values with 400
      if (rawStatus !== null && !VALID_STATUSES.includes(rawStatus as QueueStatus)) {
        return NextResponse.json(
          { error: `Invalid status '${rawStatus}'. Must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      const statusFilter = rawStatus as QueueStatus | null;

      const selectShape = {
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
      };

      // Apply where() before orderBy() to satisfy Drizzle's fluent builder type constraints
      const rows = await (statusFilter
        ? db
            .select(selectShape)
            .from(publishQueue)
            .innerJoin(drafts, eq(publishQueue.draftId, drafts.id))
            .innerJoin(channels, eq(publishQueue.channelId, channels.id))
            .where(eq(publishQueue.status, statusFilter))
            .orderBy(asc(publishQueue.scheduledFor))
        : db
            .select(selectShape)
            .from(publishQueue)
            .innerJoin(drafts, eq(publishQueue.draftId, drafts.id))
            .innerJoin(channels, eq(publishQueue.channelId, channels.id))
            .orderBy(asc(publishQueue.scheduledFor)));

      return NextResponse.json(rows);
    } catch (e) {
      console.error('[GET /api/queue] failed:', e);
      const { message, status } = apiError('load queue', e);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
