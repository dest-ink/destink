import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getUserId } from '@/lib/auth-utils';
import { db } from '@/db/client';
import { researchers, researcherChannels, channels, researchRuns, drafts, automationSchedules } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { PipelineDetail } from '@/components/pipeline/PipelineDetail';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ researcherId: string }>;
}

export default async function PipelineDetailPage({ params }: Props) {
  const session = await auth();
  const userId = await getUserId(session);
  if (!userId) redirect('/login');

  const { researcherId } = await params;

  // Fetch researcher
  const [researcher] = await db.select().from(researchers).where(and(eq(researchers.id, researcherId), eq(researchers.userId, userId)));
  if (!researcher) notFound();

  // Fetch linked channel
  const [link] = await db
    .select({ channelId: researcherChannels.channelId })
    .from(researcherChannels)
    .where(eq(researcherChannels.researcherId, researcherId))
    .limit(1);

  let channel = null;
  if (link) {
    const [ch] = await db.select().from(channels).where(eq(channels.id, link.channelId));
    if (ch) {
      channel = {
        id: ch.id,
        name: ch.name,
        platform: ch.platform,
        platformId: ch.platformId,
        hasVoice: !!ch.personaPrompt,
        hasCredentials: !!ch.credentials,
        personaPrompt: ch.personaPrompt,
      };
    }
  }

  // Fetch schedule
  const [schedule] = await db
    .select()
    .from(automationSchedules)
    .where(eq(automationSchedules.researcherId, researcherId))
    .orderBy(desc(automationSchedules.createdAt))
    .limit(1);

  // Fetch recent runs (last 5)
  const runs = await db
    .select({
      id: researchRuns.id,
      runAt: researchRuns.runAt,
      topicCount: sql<number>`jsonb_array_length(coalesce(${researchRuns.topicsFound}, '[]'::jsonb))`,
      sourceCount: sql<number>`jsonb_array_length(coalesce(${researchRuns.sourcesSearched}, '[]'::jsonb))`,
      draftsGenerated: researchRuns.draftsGenerated,
      channelId: researchRuns.channelId,
    })
    .from(researchRuns)
    .where(eq(researchRuns.researcherId, researcherId))
    .orderBy(desc(researchRuns.runAt))
    .limit(5);

  // Fetch drafts for this channel (recent 20)
  let channelDrafts: { id: string; title: string | null; status: string; contentType: string; createdAt: string; voiceConfidence: number | null }[] = [];
  let pendingDraftCount = 0;
  if (channel) {
    const draftRows = await db
      .select({
        id: drafts.id,
        title: drafts.title,
        status: drafts.status,
        contentType: drafts.contentType,
        createdAt: drafts.createdAt,
        voiceConfidence: drafts.voiceConfidence,
      })
      .from(drafts)
      .where(eq(drafts.channelId, channel.id))
      .orderBy(desc(drafts.createdAt))
      .limit(20);

    channelDrafts = draftRows.map(d => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
    }));
    pendingDraftCount = draftRows.filter(d => d.status === 'pending_review').length;
  }

  const serializedRuns = runs.map(r => ({
    id: r.id,
    runAt: r.runAt.toISOString(),
    topicCount: Number(r.topicCount),
    sourceCount: Number(r.sourceCount),
    draftsGenerated: r.draftsGenerated as string[] | null,
    channelId: r.channelId,
  }));

  return (
    <PipelineDetail
      researcher={{
        id: researcher.id,
        name: researcher.name,
        topics: researcher.topics as string[],
        keywords: researcher.keywords as string[],
        sourceConfig: researcher.sourceConfig as { subreddits: string[]; substackFeeds: string[]; searchQueryTemplates: string[]; excludedDomains: string[] },
        autoDraft: researcher.autoDraft,
        shortFormPercent: researcher.shortFormPercent,
        maxDraftsPerRun: researcher.maxDraftsPerRun,
      }}
      channel={channel}
      schedule={schedule ? {
        cronExpression: schedule.cronExpression,
        enabled: schedule.enabled,
        nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
      } : null}
      runs={serializedRuns}
      drafts={channelDrafts}
      pendingDraftCount={pendingDraftCount}
    />
  );
}
