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
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
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
        <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-4 text-sm text-destructive">
          Failed to load channels — check that the database is reachable.
        </div>
      )}

      {/* Channel grid or empty state */}
      {!fetchError && rows.length === 0 && (
        <div className="border border-dashed border-border rounded-lg py-20 text-center">
          <p className="font-mono text-4xl text-muted-foreground/30 mb-4">◈</p>
          <h2 className="text-base font-medium text-muted-foreground mb-1">No channels yet</h2>
          <p className="text-sm text-muted-foreground/60 mb-6">
            Add a LinkedIn profile or Substack publication to get started.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/channels/new">Create your first channel</Link>
          </Button>
        </div>
      )}

      {!fetchError && rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(ch => (
            <ChannelCard key={ch.id} channel={ch} />
          ))}
        </div>
      )}
    </div>
  );
}
