import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getUserId } from '@/lib/auth-utils';
import { db } from '@/db/client';
import { drafts, channels } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { eq, desc, and } from 'drizzle-orm';
import { DraftsClientShell } from '@/components/drafts/DraftsClientShell';
import type { DraftWithChannel } from '@/components/drafts/DraftCard';

export const dynamic = 'force-dynamic';

interface DraftsPageProps {
  searchParams: Promise<{ channel?: string }>;
}

export default async function DraftsPage({ searchParams }: DraftsPageProps) {
  const session = await auth();
  const userId = await getUserId(session);
  if (!userId) redirect('/login');

  const { channel: filterChannelId } = await searchParams;

  let rows: DraftWithChannel[] = [];
  let channelOptions: { id: string; name: string }[] = [];
  let fetchError = false;

  try {
    // Join drafts with channels to get channel name and platform
    const result = await db
      .select({
        id: drafts.id,
        channelId: drafts.channelId,
        researchRunId: drafts.researchRunId,
        contentType: drafts.contentType,
        title: drafts.title,
        headlineOptions: drafts.headlineOptions,
        hook: drafts.hook,
        body: drafts.body,
        cta: drafts.cta,
        voiceConfidence: drafts.voiceConfidence,
        researchSources: drafts.researchSources,
        aiModel: drafts.aiModel,
        promptTokens: drafts.promptTokens,
        completionTokens: drafts.completionTokens,
        status: drafts.status,
        rejectionReason: drafts.rejectionReason,
        regenerationNote: drafts.regenerationNote,
        createdAt: drafts.createdAt,
        updatedAt: drafts.updatedAt,
        channelName: channels.name,
        channelPlatform: channels.platform,
      })
      .from(drafts)
      .innerJoin(channels, eq(drafts.channelId, channels.id))
      .where(and(eq(drafts.status, 'pending_review'), eq(channels.userId, userId)))
      .orderBy(desc(drafts.createdAt));

    rows = result as DraftWithChannel[];

    // Build unique channel options for the filter
    const seen = new Set<string>();
    for (const r of rows) {
      if (!seen.has(r.channelId)) {
        seen.add(r.channelId);
        channelOptions.push({ id: r.channelId, name: r.channelName });
      }
    }
  } catch (e) {
    console.error('[DraftsPage] DB fetch failed:', e);
    fetchError = true;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <h1 className="text-xl font-semibold text-foreground">Drafts</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {fetchError
            ? 'Could not load drafts'
            : `${rows.length} ${rows.length === 1 ? 'draft' : 'drafts'} pending review`}
        </p>
      </div>

      {/* DB error state */}
      {fetchError && (
        <div className="m-6 border border-destructive/30 bg-destructive/5 rounded-lg p-4 text-sm text-destructive">
          Failed to load drafts — check that the database is reachable.
        </div>
      )}

      {/* Empty state */}
      {!fetchError && rows.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <h2 className="text-lg font-semibold text-foreground mb-2">No drafts yet</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Drafts are generated from research on your channels. Run research on a channel to create your first draft.
            </p>
            <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/channels">Go to channels</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Main shell with filter bar + cards + detail panel */}
      {!fetchError && rows.length > 0 && (
        <div className="flex-1 min-h-0">
          <DraftsClientShell drafts={rows} channelOptions={channelOptions} initialChannelFilter={filterChannelId} />
        </div>
      )}
    </div>
  );
}
