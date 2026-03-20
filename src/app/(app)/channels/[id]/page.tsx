import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getUserId } from '@/lib/auth-utils';
import { db } from '@/db/client';
import { channels, aiAuditLog, researchRuns } from '@/db/schema';
import { eq, sql, desc, and } from 'drizzle-orm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChannelTabs } from '@/components/channels/ChannelTabs';
import { DeleteResourceButton } from '@/components/ui/delete-resource-button';

export const dynamic = 'force-dynamic';

const PLATFORM_STYLES: Record<string, { label: string; color: string }> = {
  linkedin: { label: 'LinkedIn', color: 'bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/20' },
  substack: { label: 'Substack', color: 'bg-[#FF6719]/10 text-[#FF6719] border-[#FF6719]/20' },
};

interface ChannelDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChannelDetailPage({ params }: ChannelDetailPageProps) {
  const session = await auth();
  const userId = await getUserId(session);
  if (!userId) redirect('/login');

  const { id } = await params;

  const [channel] = await db.select().from(channels).where(and(eq(channels.id, id), eq(channels.userId, userId)));
  if (!channel) notFound();

  const [costResult] = await db
    .select({
      totalCost: sql<string>`coalesce(sum(${aiAuditLog.costUsd}), '0')`,
      totalPromptTokens: sql<number>`coalesce(sum(${aiAuditLog.promptTokens}), 0)`,
      totalCompletionTokens: sql<number>`coalesce(sum(${aiAuditLog.completionTokens}), 0)`,
      operationCount: sql<number>`count(*)`,
    })
    .from(aiAuditLog)
    .where(eq(aiAuditLog.channelId, id));

  const costSummary = {
    totalCostUsd: parseFloat(costResult.totalCost),
    totalPromptTokens: Number(costResult.totalPromptTokens),
    totalCompletionTokens: Number(costResult.totalCompletionTokens),
    operationCount: Number(costResult.operationCount),
  };

  // Fetch last research run for status display
  const [lastRun] = await db
    .select({
      runAt: researchRuns.runAt,
      topicsFound: researchRuns.topicsFound,
    })
    .from(researchRuns)
    .where(eq(researchRuns.channelId, id))
    .orderBy(desc(researchRuns.runAt))
    .limit(1);

  const lastResearchRun = lastRun
    ? { runAt: lastRun.runAt.toISOString(), topicCount: lastRun.topicsFound?.length ?? 0 }
    : null;

  const platformStyle = PLATFORM_STYLES[channel.platform] ?? {
    label: channel.platform,
    color: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2 mb-2">
          <Link href="/settings">&larr; Back to Settings</Link>
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{channel.name}</h1>
            <Badge className={`border text-xs font-mono ${platformStyle.color}`} variant="outline">
              {platformStyle.label}
            </Badge>
          </div>
          <DeleteResourceButton
            resourceName={channel.name}
            deleteUrl={`/api/channels/${channel.id}`}
            redirectTo="/settings"
            description="This will permanently delete this channel along with all its drafts, voice profiles, and publish queue items. This action cannot be undone."
          />
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <ChannelTabs
          channelId={channel.id}
          platform={channel.platform}
          channelData={{ platformId: channel.platformId, name: channel.name }}
          costSummary={costSummary}
          personaPrompt={channel.personaPrompt}
          lastResearchRun={lastResearchRun}
        />
      </div>
    </div>
  );
}
