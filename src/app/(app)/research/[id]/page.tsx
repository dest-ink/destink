import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { researchers, researcherChannels, channels } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { ResearcherForm } from '@/components/research/ResearcherForm';
import type { ResearchSourceConfig } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface ResearcherDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ResearcherDetailPage({ params }: ResearcherDetailPageProps) {
  const { id } = await params;

  const [researcher] = await db
    .select()
    .from(researchers)
    .where(eq(researchers.id, id));
  if (!researcher) notFound();

  const linkedChannelIds = (
    await db
      .select({ channelId: researcherChannels.channelId })
      .from(researcherChannels)
      .where(eq(researcherChannels.researcherId, id))
  ).map((r) => r.channelId);

  const allChannels = await db
    .select({ id: channels.id, name: channels.name, platform: channels.platform })
    .from(channels)
    .orderBy(desc(channels.createdAt));

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2 mb-2">
          <Link href="/research">&larr; Back to research</Link>
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{researcher.name}</h1>
          <Button asChild variant="outline" size="sm">
            <Link href={`/research/${id}/runs`}>View Runs</Link>
          </Button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {/* Edit form */}
        <ResearcherForm
          researcher={{
            id: researcher.id,
            name: researcher.name,
            topics: researcher.topics as string[],
            keywords: researcher.keywords as string[],
            sourceConfig: researcher.sourceConfig as ResearchSourceConfig,
          }}
          linkedChannelIds={linkedChannelIds}
          allChannels={allChannels}
        />
      </div>
    </div>
  );
}
