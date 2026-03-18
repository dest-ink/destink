import Link from 'next/link';
import { db } from '@/db/client';
import { researchers, researcherChannels, researchRuns, channels } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { ResearcherCard } from '@/components/research/ResearcherCard';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function ResearchPage() {
  let rows: Awaited<ReturnType<typeof loadResearchers>> = [];
  let fetchError = false;

  try {
    rows = await loadResearchers();
  } catch (e) {
    console.error('[ResearchPage] DB fetch failed:', e);
    fetchError = true;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Research</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {fetchError
              ? 'Could not load researchers'
              : `${rows.length} ${rows.length === 1 ? 'researcher' : 'researchers'} configured`}
          </p>
        </div>
        <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/research/new">+ New Researcher</Link>
        </Button>
      </div>

      {/* DB error state */}
      {fetchError && (
        <div className="m-6 border border-destructive/30 bg-destructive/5 rounded-lg p-4 text-sm text-destructive">
          Failed to load researchers — check that the database is reachable.
        </div>
      )}

      {/* Empty state */}
      {!fetchError && rows.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <h2 className="text-lg font-semibold text-foreground mb-2">No researchers yet</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Researchers gather sources and rank topics for your channels.
              Create one to get started.
            </p>
            <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/research/new">Create your first researcher</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Researcher cards */}
      {!fetchError && rows.length > 0 && (
        <div className="p-6 grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <ResearcherCard key={r.id} researcher={r} />
          ))}
        </div>
      )}
    </div>
  );
}

async function loadResearchers() {
  const rows = await db.select().from(researchers).orderBy(desc(researchers.createdAt));

  return Promise.all(
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
        topics: r.topics as string[],
        channels: linkedChannels,
        lastRun: lastRun
          ? { id: lastRun.id, runAt: lastRun.runAt.toISOString(), topicCount: Number(lastRun.topicCount) }
          : null,
      };
    }),
  );
}
