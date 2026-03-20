import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { drafts, channels } from '@/db/schema';
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

    // Verify draft belongs to user via channel ownership
    const [draftRecord] = await db.select({ id: drafts.id, channelId: drafts.channelId }).from(drafts).where(eq(drafts.id, id));
    if (!draftRecord) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const [channel] = await db.select({ id: channels.id }).from(channels).where(and(eq(channels.id, draftRecord.channelId), eq(channels.userId, userId)));
    if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let reason: string | undefined;
    try {
      const body = await req.json() as { reason?: unknown };
      if (typeof body.reason === 'string') reason = body.reason;
    } catch {
      // reason is optional — missing body is fine
    }

    try {
      const [draft] = await db
        .update(drafts)
        .set({ status: 'rejected', rejectionReason: reason ?? null, updatedAt: new Date() })
        .where(eq(drafts.id, id))
        .returning();

      if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(draft);
    } catch (err) {
      console.error('[POST /api/drafts/[id]/reject]', err);
      const { message, status } = apiError('reject draft', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
