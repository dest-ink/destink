import Link from 'next/link';
import { db } from '@/db/client';
import { channels, researchers } from '@/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const allChannels = await db.select({ id: channels.id, name: channels.name, platform: channels.platform })
    .from(channels).orderBy(desc(channels.createdAt));
  const allResearchers = await db.select({ id: researchers.id, name: researchers.name })
    .from(researchers).orderBy(desc(researchers.createdAt));

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage channels, researchers, and AI usage.</p>
        </div>

        {/* Channels */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Channels</h2>
            <Link href="/channels/new" className="text-xs text-primary hover:underline">+ New channel</Link>
          </div>
          <div className="space-y-2">
            {allChannels.map(ch => (
              <Link
                key={ch.id}
                href={`/channels/${ch.id}`}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card hover:border-primary/20 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{ch.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{ch.platform}</span>
              </Link>
            ))}
            {allChannels.length === 0 && (
              <p className="text-sm text-muted-foreground">No channels configured.</p>
            )}
          </div>
        </div>

        {/* Researchers */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Researchers</h2>
            <Link href="/research/new" className="text-xs text-primary hover:underline">+ New researcher</Link>
          </div>
          <div className="space-y-2">
            {allResearchers.map(r => (
              <Link
                key={r.id}
                href={`/research/${r.id}`}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card hover:border-primary/20 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{r.name}</span>
              </Link>
            ))}
            {allResearchers.length === 0 && (
              <p className="text-sm text-muted-foreground">No researchers configured.</p>
            )}
          </div>
        </div>

        {/* AI Usage */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">AI Usage</h2>
          <Link
            href="/audit"
            className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card hover:border-primary/20 transition-colors"
          >
            <span className="text-sm text-foreground">View AI usage & costs</span>
            <span className="text-xs text-muted-foreground">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
