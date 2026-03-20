import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { drafts, publishQueue, channels } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { getUserId } from '@/lib/auth-utils';

export const POST = auth(function POST(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    const userId = await getUserId(req.auth);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await (ctx?.params as Promise<{ id: string }>);

    try {
      // Verify draft belongs to user via channel ownership
      const [draftRecord] = await db.select({ id: drafts.id, channelId: drafts.channelId }).from(drafts).where(eq(drafts.id, id));
      if (!draftRecord) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const [channel] = await db.select({ id: channels.id }).from(channels).where(and(eq(channels.id, draftRecord.channelId), eq(channels.userId, userId)));
      if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const body = await req.json().catch(() => ({})) as { title?: string; scheduledFor?: string };
      const updates: Record<string, unknown> = { status: 'approved', updatedAt: new Date() };
      if (body.title) updates.title = body.title;

      const [draft] = await db
        .update(drafts)
        .set(updates)
        .where(eq(drafts.id, id))
        .returning();

      if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : new Date();

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
