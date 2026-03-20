import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getUserId } from '@/lib/auth-utils';
import { db } from '@/db/client';
import { channels } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { NewResearcherClient } from '@/components/research/NewResearcherClient';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ channelId?: string }>;
}

export default async function NewResearcherPage({ searchParams }: Props) {
  const session = await auth();
  const userId = await getUserId(session);
  if (!userId) redirect('/login');

  const { channelId } = await searchParams;

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
        <h1 className="text-xl font-semibold text-foreground">New Researcher</h1>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <NewResearcherClient
          allChannels={allChannels}
          channelId={channelId}
        />
      </div>
    </div>
  );
}
