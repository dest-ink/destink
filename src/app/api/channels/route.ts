import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { publisherRegistry } from '@/lib/publishing/publisher-registry';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { getUserId } from '@/lib/auth-utils';

export const GET = auth(function GET(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const rows = await db.select().from(channels).where(eq(channels.userId, userId)).orderBy(desc(channels.createdAt));
      return NextResponse.json(rows);
    } catch (err) {
      const { message, status } = apiError('load channels', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});

export const POST = auth(function POST(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const body = await req.json();
      if (!body.name || !body.platform) {
        return NextResponse.json({ error: 'name and platform are required' }, { status: 400 });
      }
      if (!publisherRegistry.has(body.platform)) {
        const available = publisherRegistry.keys().join(', ');
        return NextResponse.json(
          { error: `Unknown platform '${body.platform}'. Available: ${available}` },
          { status: 400 },
        );
      }
      const [channel] = await db.insert(channels).values({
        userId,
        name: body.name,
        platform: body.platform,
        platformId: body.platformId ?? null,
        researchConfig: body.researchConfig ?? null,
        scheduleConfig: body.scheduleConfig ?? null,
      }).returning();
      return NextResponse.json(channel, { status: 201 });
    } catch (err) {
      const { message, status } = apiError('create channel', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
