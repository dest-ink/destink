import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { researchRuns, channels } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';

export const GET = auth(function GET(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const { id } = await (ctx?.params as Promise<{ id: string }>);

      const runs = await db
        .select({
          id: researchRuns.id,
          channelId: researchRuns.channelId,
          channelName: channels.name,
          platform: channels.platform,
          runAt: researchRuns.runAt,
          topicCount: sql<number>`jsonb_array_length(coalesce(${researchRuns.topicsFound}, '[]'::jsonb))`,
          sourceCount: sql<number>`jsonb_array_length(coalesce(${researchRuns.sourcesSearched}, '[]'::jsonb))`,
          aiModel: researchRuns.aiModel,
        })
        .from(researchRuns)
        .innerJoin(channels, eq(channels.id, researchRuns.channelId))
        .where(eq(researchRuns.researcherId, id))
        .orderBy(desc(researchRuns.runAt));

      return NextResponse.json(
        runs.map((r) => ({
          ...r,
          topicCount: Number(r.topicCount),
          sourceCount: Number(r.sourceCount),
        })),
      );
    } catch (err) {
      const { message, status } = apiError('list research runs', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
