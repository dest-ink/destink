import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels, draftPreferences } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { getUserId } from '@/lib/auth-utils';

export const GET = auth(function GET(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { id } = await (ctx?.params as Promise<{ id: string }>);

      const [channel] = await db.select({ id: channels.id }).from(channels)
        .where(and(eq(channels.id, id), eq(channels.userId, userId)));
      if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const [prefs] = await db.select().from(draftPreferences)
        .where(eq(draftPreferences.channelId, id));

      return NextResponse.json(prefs ?? { channelId: id, noteStyle: null, articleStyle: null });
    } catch (err) {
      const { message, status } = apiError('load draft preferences', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});

export const PUT = auth(function PUT(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { id } = await (ctx?.params as Promise<{ id: string }>);

      const [channel] = await db.select({ id: channels.id }).from(channels)
        .where(and(eq(channels.id, id), eq(channels.userId, userId)));
      if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const body = await req.json();
      const { noteStyle, articleStyle } = body;

      const [existing] = await db.select({ id: draftPreferences.id }).from(draftPreferences)
        .where(eq(draftPreferences.channelId, id));

      let result;
      if (existing) {
        [result] = await db.update(draftPreferences)
          .set({ noteStyle, articleStyle, updatedAt: new Date() })
          .where(eq(draftPreferences.channelId, id))
          .returning();
      } else {
        [result] = await db.insert(draftPreferences)
          .values({ channelId: id, noteStyle, articleStyle })
          .returning();
      }

      return NextResponse.json(result);
    } catch (err) {
      const { message, status } = apiError('save draft preferences', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
