import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { researchers, researcherChannels, channels, voiceProfiles, researchRuns, drafts, automationSchedules } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';

export const GET = auth(function GET(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const allResearchers = await db.select().from(researchers).orderBy(desc(researchers.createdAt));

      const pipelines = await Promise.all(
        allResearchers.map(async (r) => {
          // Get linked channel
          const [link] = await db
            .select({ channelId: researcherChannels.channelId })
            .from(researcherChannels)
            .where(eq(researcherChannels.researcherId, r.id))
            .limit(1);

          let channel = null;
          if (link) {
            const [ch] = await db.select().from(channels).where(eq(channels.id, link.channelId));
            if (ch) {
              // Check voice profile exists
              const [voice] = await db
                .select({ id: voiceProfiles.id })
                .from(voiceProfiles)
                .where(eq(voiceProfiles.channelId, ch.id))
                .limit(1);

              channel = {
                id: ch.id,
                name: ch.name,
                platform: ch.platform,
                hasVoice: !!ch.personaPrompt,
                hasCredentials: !!ch.credentials,
              };
            }
          }

          // Get schedule
          const [schedule] = await db
            .select({
              cronExpression: automationSchedules.cronExpression,
              enabled: automationSchedules.enabled,
              nextRunAt: automationSchedules.nextRunAt,
            })
            .from(automationSchedules)
            .where(eq(automationSchedules.researcherId, r.id))
            .orderBy(desc(automationSchedules.createdAt))
            .limit(1);

          // Get last run
          const [lastRun] = await db
            .select({
              id: researchRuns.id,
              runAt: researchRuns.runAt,
              topicCount: sql<number>`jsonb_array_length(coalesce(${researchRuns.topicsFound}, '[]'::jsonb))`,
              sourceCount: sql<number>`jsonb_array_length(coalesce(${researchRuns.sourcesSearched}, '[]'::jsonb))`,
              draftsGenerated: researchRuns.draftsGenerated,
            })
            .from(researchRuns)
            .where(eq(researchRuns.researcherId, r.id))
            .orderBy(desc(researchRuns.runAt))
            .limit(1);

          // Count pending drafts for this channel
          let pendingDraftCount = 0;
          if (channel) {
            const [count] = await db
              .select({ count: sql<number>`count(*)` })
              .from(drafts)
              .where(and(eq(drafts.channelId, channel.id), eq(drafts.status, 'pending_review')));
            pendingDraftCount = Number(count?.count ?? 0);
          }

          return {
            researcherId: r.id,
            researcherName: r.name,
            topics: r.topics as string[],
            autoDraft: r.autoDraft,
            channel,
            schedule: schedule ? {
              cronExpression: schedule.cronExpression,
              enabled: schedule.enabled,
              nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
            } : null,
            lastRun: lastRun ? {
              id: lastRun.id,
              runAt: lastRun.runAt.toISOString(),
              topicCount: Number(lastRun.topicCount),
              sourceCount: Number(lastRun.sourceCount),
              draftsGenerated: lastRun.draftsGenerated as string[] | null,
            } : null,
            pendingDraftCount,
          };
        }),
      );

      return NextResponse.json(pipelines);
    } catch (err) {
      const { message, status } = apiError('load dashboard', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
