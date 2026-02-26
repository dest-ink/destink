import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { drafts } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
