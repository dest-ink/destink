import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { publishQueue } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [item] = await db
      .select({ id: publishQueue.id, status: publishQueue.status })
      .from(publishQueue)
      .where(eq(publishQueue.id, id));

    if (!item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    if (item.status !== 'failed') {
      return NextResponse.json(
        { error: `Cannot retry item with status '${item.status}' — only 'failed' items can be retried` },
        { status: 409 }
      );
    }

    const [updated] = await db
      .update(publishQueue)
      .set({
        status: 'queued',
        errorMessage: null,
        retryCount: sql`${publishQueue.retryCount} + 1`,
      })
      .where(eq(publishQueue.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (e) {
    console.error('[POST /api/queue/[id]/retry] failed:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
