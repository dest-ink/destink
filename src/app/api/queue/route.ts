import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { publishQueue, drafts, channels } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');

    const query = db
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
        // Draft fields
        draftTitle: drafts.title,
        draftHook: drafts.hook,
        draftContentType: drafts.contentType,
        // Channel fields
        channelName: channels.name,
        channelPlatform: channels.platform,
      })
      .from(publishQueue)
      .innerJoin(drafts, eq(publishQueue.draftId, drafts.id))
      .innerJoin(channels, eq(publishQueue.channelId, channels.id))
      .orderBy(asc(publishQueue.scheduledFor));

    let rows;
    if (statusFilter) {
      rows = await query.where(
        eq(publishQueue.status, statusFilter as 'queued' | 'publishing' | 'published' | 'failed')
      );
    } else {
      rows = await query;
    }

    return NextResponse.json(rows);
  } catch (e) {
    console.error('[GET /api/queue] failed:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }

    // Only allow deletion if item is still queued
    const [item] = await db
      .select({ id: publishQueue.id, status: publishQueue.status })
      .from(publishQueue)
      .where(eq(publishQueue.id, id));

    if (!item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    if (item.status !== 'queued') {
      return NextResponse.json(
        { error: `Cannot remove item with status '${item.status}' — only 'queued' items can be removed` },
        { status: 409 }
      );
    }

    await db.delete(publishQueue).where(eq(publishQueue.id, id));
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[DELETE /api/queue] failed:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
