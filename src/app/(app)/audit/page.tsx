import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getUserId } from '@/lib/auth-utils';
import { db } from '@/db/client';
import { aiAuditLog, channels } from '@/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { AuditSummaryCards } from '@/components/audit/AuditSummaryCards';
import { AuditTabs } from '@/components/audit/AuditTabs';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const session = await auth();
  const userId = await getUserId(session);
  if (!userId) redirect('/login');

  const [summary] = await db
    .select({
      totalCost: sql<string>`coalesce(sum(${aiAuditLog.costUsd}), '0')`,
      totalTokens: sql<number>`coalesce(sum(${aiAuditLog.promptTokens} + ${aiAuditLog.completionTokens}), 0)`,
      callCount: sql<number>`cast(count(*) as int)`,
    })
    .from(aiAuditLog)
    .innerJoin(channels, and(eq(aiAuditLog.channelId, channels.id), eq(channels.userId, userId)));

  const byChannelRaw = await db
    .select({
      channelId: aiAuditLog.channelId,
      channelName: channels.name,
      totalCost: sql<string>`coalesce(sum(${aiAuditLog.costUsd}), '0')`,
      totalTokens: sql<number>`coalesce(sum(${aiAuditLog.promptTokens} + ${aiAuditLog.completionTokens}), 0)`,
      callCount: sql<number>`cast(count(*) as int)`,
    })
    .from(aiAuditLog)
    .innerJoin(channels, and(eq(aiAuditLog.channelId, channels.id), eq(channels.userId, userId)))
    .groupBy(aiAuditLog.channelId, channels.name)
    .orderBy(sql`sum(${aiAuditLog.costUsd}) desc nulls last`);

  const byOperationRaw = await db
    .select({
      operation: aiAuditLog.operation,
      totalCost: sql<string>`coalesce(sum(${aiAuditLog.costUsd}), '0')`,
      totalTokens: sql<number>`coalesce(sum(${aiAuditLog.promptTokens} + ${aiAuditLog.completionTokens}), 0)`,
      callCount: sql<number>`cast(count(*) as int)`,
    })
    .from(aiAuditLog)
    .innerJoin(channels, and(eq(aiAuditLog.channelId, channels.id), eq(channels.userId, userId)))
    .groupBy(aiAuditLog.operation)
    .orderBy(sql`sum(${aiAuditLog.costUsd}) desc nulls last`);

  const parsedSummary = {
    totalCostUsd: parseFloat(summary.totalCost),
    totalTokens: Number(summary.totalTokens),
    callCount: Number(summary.callCount),
  };

  const parsedByChannel = byChannelRaw.map((row) => ({
    channelId: row.channelId,
    channelName: row.channelName ?? null,
    totalCostUsd: parseFloat(row.totalCost),
    totalTokens: Number(row.totalTokens),
    callCount: Number(row.callCount),
  }));

  const parsedByOperation = byOperationRaw.map((row) => ({
    operation: row.operation,
    totalCostUsd: parseFloat(row.totalCost),
    totalTokens: Number(row.totalTokens),
    callCount: Number(row.callCount),
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <h1 className="text-xl font-semibold text-foreground">AI Usage</h1>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <AuditSummaryCards summary={parsedSummary} />
        <AuditTabs byChannel={parsedByChannel} byOperation={parsedByOperation} />
      </div>
    </div>
  );
}
