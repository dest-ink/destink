import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';

export const GET = auth(function GET(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const { id } = await (ctx?.params as Promise<{ id: string }>);
      const [channel] = await db.select().from(channels).where(eq(channels.id, id));
      if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(channel);
    } catch {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  })();
});

export const PATCH = auth(function PATCH(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const { id } = await (ctx?.params as Promise<{ id: string }>);
      const body = await req.json();
      // Build partial update — only include fields explicitly present in the request body.
      // Credentials are never updatable here; they have their own auth routes.
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if ('name' in body) updates.name = body.name;
      if ('researchConfig' in body) updates.researchConfig = body.researchConfig;
      if ('scheduleConfig' in body) updates.scheduleConfig = body.scheduleConfig;
      if ('personaPrompt' in body) updates.personaPrompt = body.personaPrompt;

      const [updated] = await db.update(channels)
        .set(updates)
        .where(eq(channels.id, id))
        .returning();
      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(updated);
    } catch {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  })();
});

export const DELETE = auth(function DELETE(_req, ctx) {
  if (!_req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const { id } = await (ctx?.params as Promise<{ id: string }>);
      await db.delete(channels).where(eq(channels.id, id));
      return new NextResponse(null, { status: 204 });
    } catch {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  })();
});
