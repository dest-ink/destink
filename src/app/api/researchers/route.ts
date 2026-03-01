import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { researchers, researcherChannels, researchRuns, channels } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';

export const GET = auth(function GET(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const rows = await db.select().from(researchers).orderBy(desc(researchers.createdAt));

      // Enrich with linked channels and last run info
      const enriched = await Promise.all(
        rows.map(async (r) => {
          const linkedChannels = await db
            .select({
              channelId: researcherChannels.channelId,
              channelName: channels.name,
              platform: channels.platform,
            })
            .from(researcherChannels)
            .innerJoin(channels, eq(channels.id, researcherChannels.channelId))
            .where(eq(researcherChannels.researcherId, r.id));

          const [lastRun] = await db
            .select({
              id: researchRuns.id,
              runAt: researchRuns.runAt,
              topicCount: sql<number>`jsonb_array_length(coalesce(${researchRuns.topicsFound}, '[]'::jsonb))`,
            })
            .from(researchRuns)
            .where(eq(researchRuns.researcherId, r.id))
            .orderBy(desc(researchRuns.runAt))
            .limit(1);

          return {
            ...r,
            channels: linkedChannels,
            lastRun: lastRun ?? null,
          };
        }),
      );

      return NextResponse.json(enriched);
    } catch (err) {
      const { message, status } = apiError('load researchers', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});

export const POST = auth(function POST(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const body = await req.json();
      if (!body.name || typeof body.name !== 'string') {
        return NextResponse.json({ error: 'name is required' }, { status: 400 });
      }

      const [researcher] = await db
        .insert(researchers)
        .values({
          name: body.name,
          topics: body.topics ?? [],
          keywords: body.keywords ?? [],
          sourceConfig: body.sourceConfig ?? {
            subreddits: [],
            substackFeeds: [],
            searchQueryTemplates: [],
            excludedDomains: [],
            contentTypeMix: { note: 70, article: 30 },
            maxDraftsPerRun: 3,
            scheduleHours: 6,
          },
        })
        .returning();

      // Link channels if provided
      const channelIds: string[] = body.channelIds ?? [];
      if (channelIds.length > 0) {
        await db.insert(researcherChannels).values(
          channelIds.map((channelId: string) => ({
            researcherId: researcher.id,
            channelId,
          })),
        );
      }

      return NextResponse.json(researcher, { status: 201 });
    } catch (err) {
      const { message, status } = apiError('create researcher', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
