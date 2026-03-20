import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getUserId } from '@/lib/auth-utils';
import { db } from '@/db/client';
import { researchers, researcherChannels, channels } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { ResearcherForm } from '@/components/research/ResearcherForm';
import type { ResearchSourceConfig } from '@/db/schema';
import { DeleteResourceButton } from '@/components/ui/delete-resource-button';

export const dynamic = 'force-dynamic';

interface ResearcherDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ResearcherDetailPage({ params }: ResearcherDetailPageProps) {
  const session = await auth();
  const userId = await getUserId(session);
  if (!userId) redirect('/login');

  const { id } = await params;

  const [researcher] = await db
    .select()
    .from(researchers)
    .where(and(eq(researchers.id, id), eq(researchers.userId, userId)));
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
    .where(eq(channels.userId, userId))
    .orderBy(desc(channels.createdAt));

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2 mb-2">
          <Link href="/settings">&larr; Back to Settings</Link>
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{researcher.name}</h1>
            <Button asChild variant="outline" size="sm">
              <Link href={`/research/${id}/runs`}>View Runs</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/research/${id}/automation`}>Automation</Link>
            </Button>
          </div>
          <DeleteResourceButton
            resourceName={researcher.name}
            deleteUrl={`/api/researchers/${researcher.id}`}
            redirectTo="/settings"
            description="This will permanently delete this researcher and its automation schedules. Research run history will be preserved. This action cannot be undone."
          />
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
            maxDraftsPerRun: researcher.maxDraftsPerRun,
            shortFormPercent: researcher.shortFormPercent,
            autoDraft: researcher.autoDraft,
          }}
          linkedChannelIds={linkedChannelIds}
          allChannels={allChannels}
        />
      </div>
    </div>
  );
}
