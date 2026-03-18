import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { publishQueue } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { publishSingleItem } from '@/lib/publishing/publish-single-item';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = auth(function POST(_req, ctx) {
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
          { error: `Cannot publish item with status '${item.status}' — only 'queued' items can be published` },
          { status: 409 }
        );
      }

      await db
        .update(publishQueue)
        .set({ status: 'publishing' })
        .where(eq(publishQueue.id, id));

      // Await the publish so we can return the final status to the client
      await publishSingleItem(id);

      // Read back the final status
      const [final] = await db
        .select()
        .from(publishQueue)
        .where(eq(publishQueue.id, id));

      return NextResponse.json(final);
    } catch (e) {
      console.error('[POST /api/queue/[id]/publish-now] failed:', e);
      const { message, status } = apiError('publish now', e);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
