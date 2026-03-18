import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { publishQueue } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH — reschedule a queued item to a new date/time.
 */
export const PATCH = auth(function PATCH(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    const { id } = await (ctx?.params as Promise<{ id: string }>);

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id format' }, { status: 400 });
    }

    try {
      const body = await req.json();
      const { scheduledFor } = body as { scheduledFor?: string };

      if (!scheduledFor) {
        return NextResponse.json({ error: 'scheduledFor is required' }, { status: 400 });
      }

      const newDate = new Date(scheduledFor);
      if (isNaN(newDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
      }

      const [item] = await db
        .select({ id: publishQueue.id, status: publishQueue.status })
        .from(publishQueue)
        .where(eq(publishQueue.id, id));

      if (!item) {
        return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
      }

      if (item.status !== 'queued') {
        return NextResponse.json(
          { error: `Cannot reschedule item with status '${item.status}'` },
          { status: 409 },
        );
      }

      const [updated] = await db
        .update(publishQueue)
        .set({ scheduledFor: newDate })
        .where(eq(publishQueue.id, id))
        .returning();

      return NextResponse.json(updated);
    } catch (e) {
      console.error('[PATCH /api/queue/[id]] failed:', e);
      const { message, status } = apiError('reschedule queue item', e);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});

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
      const { message, status } = apiError('remove from queue', e);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
