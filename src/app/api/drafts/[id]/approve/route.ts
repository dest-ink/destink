import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { drafts, publishQueue } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [draft] = await db
      .update(drafts)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(eq(drafts.id, id))
      .returning();

    if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Schedule immediately — Task 6.1 will replace this with a proper scheduling algorithm
    const scheduledFor = new Date();

    const [queueItem] = await db
      .insert(publishQueue)
      .values({
        draftId: draft.id,
        channelId: draft.channelId,
        scheduledFor,
        status: 'queued',
      })
      .returning();

    return NextResponse.json({ draft, queueItem });
  } catch (err) {
    console.error('[POST /api/drafts/[id]/approve]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
