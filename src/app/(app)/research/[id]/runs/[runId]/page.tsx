import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getUserId } from '@/lib/auth-utils';
import { db } from '@/db/client';
import { researchers, researchRuns, channels } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { RunDetail } from '@/components/research/RunDetail';
import type { ResearchSource, TopicRecommendation } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface RunDetailPageProps {
  params: Promise<{ id: string; runId: string }>;
}

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const session = await auth();
  const userId = await getUserId(session);
  if (!userId) redirect('/login');

  const { id, runId } = await params;

  const [researcher] = await db
    .select({ id: researchers.id, name: researchers.name })
    .from(researchers)
    .where(and(eq(researchers.id, id), eq(researchers.userId, userId)));
  if (!researcher) notFound();

  const [run] = await db
    .select({
      id: researchRuns.id,
      channelId: researchRuns.channelId,
      channelName: channels.name,
      platform: channels.platform,
      runAt: researchRuns.runAt,
      sourcesSearched: researchRuns.sourcesSearched,
      topicsFound: researchRuns.topicsFound,
      draftsGenerated: researchRuns.draftsGenerated,
      aiModel: researchRuns.aiModel,
    })
    .from(researchRuns)
    .innerJoin(channels, eq(channels.id, researchRuns.channelId))
    .where(and(eq(researchRuns.id, runId), eq(researchRuns.researcherId, id)));
  if (!run) notFound();

  const formattedDate = run.runAt.toLocaleDateString();

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2 mb-2">
          <Link href={`/research/${id}/runs`}>&larr; Back to runs</Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">
          {researcher.name} &mdash; Run {formattedDate}
        </h1>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <RunDetail
          run={{
            id: run.id,
            runAt: run.runAt.toISOString(),
            channelName: run.channelName,
            platform: run.platform,
            aiModel: run.aiModel,
            sourcesSearched: run.sourcesSearched as ResearchSource[] | null,
            topicsFound: run.topicsFound as TopicRecommendation[] | null,
            draftsGenerated: run.draftsGenerated as string[] | null,
            researcherId: id,
          }}
        />
      </div>
    </div>
  );
}
