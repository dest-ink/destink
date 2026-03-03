import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { researchers, researchRuns, channels } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { ResearchRunPanel } from '@/components/research/ResearchRunPanel';
import { RunsList } from '@/components/research/RunsList';

export const dynamic = 'force-dynamic';

interface RunsPageProps {
  params: Promise<{ id: string }>;
}

export default async function RunsPage({ params }: RunsPageProps) {
  const { id } = await params;

  const [researcher] = await db
    .select({ id: researchers.id, name: researchers.name })
    .from(researchers)
    .where(eq(researchers.id, id));
  if (!researcher) notFound();

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
      draftsGenerated: researchRuns.draftsGenerated,
    })
    .from(researchRuns)
    .innerJoin(channels, eq(channels.id, researchRuns.channelId))
    .where(eq(researchRuns.researcherId, id))
    .orderBy(desc(researchRuns.runAt));

  const serializedRuns = runs.map((r) => ({
    ...r,
    runAt: r.runAt.toISOString(),
    topicCount: Number(r.topicCount),
    sourceCount: Number(r.sourceCount),
    draftsGenerated: r.draftsGenerated as string[] | null,
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2 mb-2">
          <Link href={`/research/${id}`}>&larr; Back to {researcher.name}</Link>
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{researcher.name} &mdash; Runs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {serializedRuns.length} {serializedRuns.length === 1 ? 'run' : 'runs'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* Run Research panel */}
        <div className="border border-border rounded-lg p-5 bg-card">
          <h2 className="text-sm font-medium text-foreground mb-3">Run Research</h2>
          <ResearchRunPanel researcherId={id} />
        </div>

        {/* Runs list */}
        <div>
          <h2 className="text-sm font-medium text-foreground mb-3">Past Runs</h2>
          <RunsList runs={serializedRuns} researcherId={id} />
        </div>
      </div>
    </div>
  );
}
