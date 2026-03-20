import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { researchers, researcherChannels, researchRuns, channels } from '@/db/schema';
import { eq, sql, desc, and } from 'drizzle-orm';
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
      const [researcher] = await db
        .select()
        .from(researchers)
        .where(and(eq(researchers.id, id), eq(researchers.userId, userId)));
      if (!researcher) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const linkedChannels = await db
        .select({
          channelId: researcherChannels.channelId,
          channelName: channels.name,
          platform: channels.platform,
        })
        .from(researcherChannels)
        .innerJoin(channels, eq(channels.id, researcherChannels.channelId))
        .where(eq(researcherChannels.researcherId, id));

      const [lastRun] = await db
        .select({
          id: researchRuns.id,
          runAt: researchRuns.runAt,
          topicCount: sql<number>`jsonb_array_length(coalesce(${researchRuns.topicsFound}, '[]'::jsonb))`,
        })
        .from(researchRuns)
        .where(eq(researchRuns.researcherId, id))
        .orderBy(desc(researchRuns.runAt))
        .limit(1);

      return NextResponse.json({
        ...researcher,
        channels: linkedChannels,
        lastRun: lastRun ?? null,
      });
    } catch (err) {
      const { message, status } = apiError('load researcher', err);
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
      const body = await req.json();

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if ('name' in body) updates.name = body.name;
      if ('topics' in body) updates.topics = body.topics;
      if ('keywords' in body) updates.keywords = body.keywords;
      if ('sourceConfig' in body) updates.sourceConfig = body.sourceConfig;
      if ('maxDraftsPerRun' in body) updates.maxDraftsPerRun = body.maxDraftsPerRun;
      if ('shortFormPercent' in body) updates.shortFormPercent = body.shortFormPercent;
      if ('autoDraft' in body) updates.autoDraft = body.autoDraft;

      const [updated] = await db
        .update(researchers)
        .set(updates)
        .where(and(eq(researchers.id, id), eq(researchers.userId, userId)))
        .returning();
      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      // Update channel assignments if provided
      if ('channelIds' in body) {
        // Remove existing links and re-create
        await db
          .delete(researcherChannels)
          .where(eq(researcherChannels.researcherId, id));

        const channelIds: string[] = body.channelIds ?? [];
        if (channelIds.length > 0) {
          await db.insert(researcherChannels).values(
            channelIds.map((channelId: string) => ({
              researcherId: id,
              channelId,
            })),
          );
        }
      }

      return NextResponse.json(updated);
    } catch (err) {
      const { message, status } = apiError('update researcher', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});

export const DELETE = auth(function DELETE(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const userId = await getUserId(req.auth);
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { id } = await (ctx?.params as Promise<{ id: string }>);

      // Verify ownership before deleting
      const [existing] = await db
        .select({ id: researchers.id })
        .from(researchers)
        .where(and(eq(researchers.id, id), eq(researchers.userId, userId)));
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      // Nullify researcherId on existing runs before deleting
      await db
        .update(researchRuns)
        .set({ researcherId: null })
        .where(eq(researchRuns.researcherId, id));

      // Delete the researcher (cascades researcher_channels via FK)
      await db.delete(researchers).where(eq(researchers.id, id));
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      const { message, status } = apiError('delete researcher', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
