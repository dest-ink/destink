import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { publishQueue } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DELETE = auth(function DELETE(_req, ctx) {
  if (!_req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    const { id } = await (ctx?.params as Promise<{ id: string }>);

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
          { error: `Cannot remove item with status '${item.status}' — only 'queued' items can be removed` },
          { status: 409 }
        );
      }

      await db.delete(publishQueue).where(eq(publishQueue.id, id));
      return NextResponse.json({ success: true });
    } catch (e) {
      console.error('[DELETE /api/queue/[id]] failed:', e);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  })();
});
