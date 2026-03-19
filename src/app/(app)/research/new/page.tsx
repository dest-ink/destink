import Link from 'next/link';
import { db } from '@/db/client';
import { channels } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { ResearcherForm } from '@/components/research/ResearcherForm';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ channelId?: string }>;
}

export default async function NewResearcherPage({ searchParams }: Props) {
  const { channelId } = await searchParams;

  const allChannels = await db
    .select({ id: channels.id, name: channels.name, platform: channels.platform })
    .from(channels)
    .orderBy(desc(channels.createdAt));

  // Pre-select channel if channelId is provided via query param
  const preSelectedChannelIds = channelId && allChannels.some(ch => ch.id === channelId)
    ? [channelId]
    : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2 mb-2">
          <Link href="/settings">&larr; Back to Settings</Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">New Researcher</h1>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <ResearcherForm allChannels={allChannels} linkedChannelIds={preSelectedChannelIds} />
      </div>
    </div>
  );
}
