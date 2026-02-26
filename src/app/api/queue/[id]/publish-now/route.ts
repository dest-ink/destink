import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { publishQueue } from '@/db/schema';
import { eq } from 'drizzle-orm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Stub: marks the item as 'publishing'. Actual publisher integration is wired in Tasks 7.1/7.2.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id format' }, { status: 400 });
  }

  try {
    const [item] = await db
      .select({ id: publishQueue.id, status: publishQueue.status })
      .from(publishQueue)
      .where(eq(publishQueue.id, id));

    if (!item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    if (item.status !== 'queued') {
      return NextResponse.json(
        { error: `Cannot publish item with status '${item.status}' — only 'queued' items can be published` },
        { status: 409 }
      );
    }

    const [updated] = await db
      .update(publishQueue)
      .set({ status: 'publishing' })
      .where(eq(publishQueue.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (e) {
    console.error('[POST /api/queue/[id]/publish-now] failed:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
