import { db } from '@/db/client';
import { aiAuditLog, channels } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { AuditSummaryCards } from '@/components/audit/AuditSummaryCards';
import { AuditTabs } from '@/components/audit/AuditTabs';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const [summary] = await db
    .select({
      totalCost: sql<string>`coalesce(sum(${aiAuditLog.costUsd}), '0')`,
      totalTokens: sql<number>`coalesce(sum(${aiAuditLog.promptTokens} + ${aiAuditLog.completionTokens}), 0)`,
      callCount: sql<number>`cast(count(*) as int)`,
    })
    .from(aiAuditLog);

  const byChannelRaw = await db
    .select({
      channelId: aiAuditLog.channelId,
      channelName: channels.name,
      totalCost: sql<string>`coalesce(sum(${aiAuditLog.costUsd}), '0')`,
      totalTokens: sql<number>`coalesce(sum(${aiAuditLog.promptTokens} + ${aiAuditLog.completionTokens}), 0)`,
      callCount: sql<number>`cast(count(*) as int)`,
    })
    .from(aiAuditLog)
    .leftJoin(channels, eq(aiAuditLog.channelId, channels.id))
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
