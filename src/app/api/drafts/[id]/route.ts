import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { drafts, channels } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { getUserId } from '@/lib/auth-utils';

export const PATCH = auth(function PATCH(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { id } = await (ctx?.params as Promise<{ id: string }>);

      // Verify draft belongs to user via channel ownership
      const [draft] = await db.select({ id: drafts.id, channelId: drafts.channelId }).from(drafts).where(eq(drafts.id, id));
      if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      const [channel] = await db.select({ id: channels.id }).from(channels).where(and(eq(channels.id, draft.channelId), eq(channels.userId, userId)));
      if (!channel) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

      const body = await req.json();

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if ('hook' in body) updates.hook = body.hook;
      if ('body' in body) updates.body = body.body;
      if ('cta' in body) updates.cta = body.cta;
      if ('title' in body) updates.title = body.title;

      const [updated] = await db.update(drafts)
        .set(updates)
        .where(eq(drafts.id, id))
        .returning();

      if (!updated) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      return NextResponse.json(updated);
    } catch (err) {
      const { message, status } = apiError('update draft', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
