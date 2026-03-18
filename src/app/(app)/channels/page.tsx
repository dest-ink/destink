import Link from 'next/link';
import { db } from '@/db/client';
import { channels } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { ChannelCard } from '@/components/channels/ChannelCard';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function ChannelsPage() {
  let rows: typeof channels.$inferSelect[] = [];
  let fetchError = false;
  try {
    rows = await db.select().from(channels).orderBy(desc(channels.updatedAt));
  } catch (e) {
    console.error('[ChannelsPage] DB fetch failed:', e);
    fetchError = true;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Channels</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {fetchError ? 'Could not load channels' : `${rows.length} ${rows.length === 1 ? 'channel' : 'channels'} configured`}
          </p>
        </div>
        <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/channels/new">+ New Channel</Link>
        </Button>
      </div>

      {/* DB error state */}
      {fetchError && (
        <div className="m-6 border border-destructive/30 bg-destructive/5 rounded-lg p-4 text-sm text-destructive">
          Failed to load channels — check that the database is reachable.
        </div>
      )}

      {/* Channel grid or empty state */}
      {!fetchError && rows.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <h2 className="text-lg font-semibold text-foreground mb-2">No channels yet</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Channels are where you publish content. Create one to get started.
            </p>
            <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/channels/new">Add your first channel</Link>
            </Button>
          </div>
        </div>
      )}

      {!fetchError && rows.length > 0 && (
        <div className="p-6 grid gap-3 sm:grid-cols-2">
          {rows.map(ch => (
            <ChannelCard key={ch.id} channel={ch} />
          ))}
        </div>
      )}
    </div>
  );
}
