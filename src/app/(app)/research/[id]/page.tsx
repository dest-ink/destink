import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { researchers, researcherChannels, channels } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { ResearcherForm } from '@/components/research/ResearcherForm';
import { ResearchRunPanel } from '@/components/research/ResearchRunPanel';
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
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
          <Link href="/research">&larr; Back to research</Link>
        </Button>
      </div>

      <h1 className="text-xl font-semibold text-foreground mb-8">{researcher.name}</h1>

      {/* Run Research panel */}
      <div className="mb-8 border border-border rounded-lg p-5 bg-card">
        <h2 className="text-sm font-medium text-foreground mb-3">Run Research</h2>
        <ResearchRunPanel researcherId={id} />
      </div>

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
  );
}
