import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { drafts, publishQueue } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';

export const POST = auth(function POST(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    const { id } = await (ctx?.params as Promise<{ id: string }>);

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
      const { message, status } = apiError('approve draft', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
