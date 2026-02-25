import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [channel] = await db.select().from(channels).where(eq(channels.id, id));
  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(channel);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  // Only allow updating safe fields — credentials updated via dedicated auth routes
  const { name, researchConfig, scheduleConfig, personaPrompt } = body;
  const [updated] = await db.update(channels)
    .set({ name, researchConfig, scheduleConfig, personaPrompt, updatedAt: new Date() })
    .where(eq(channels.id, id))
    .returning();
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(channels).where(eq(channels.id, id));
  return new NextResponse(null, { status: 204 });
}
