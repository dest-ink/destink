import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { drafts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';

export const POST = auth(function POST(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    const { id } = await (ctx?.params as Promise<{ id: string }>);

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
