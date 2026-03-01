'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface ChannelBreakdown {
  channelId: string | null;
  channelName: string | null;
  totalCostUsd: number;
  totalTokens: number;
  callCount: number;
}

interface OperationBreakdown {
  operation: string;
  totalCostUsd: number;
  totalTokens: number;
  callCount: number;
}

interface AuditTabsProps {
  byChannel: ChannelBreakdown[];
  byOperation: OperationBreakdown[];
}

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function humanizeOperation(operation: string): string {
  return operation
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function AuditTabs({ byChannel, byOperation }: AuditTabsProps) {
  return (
    <Tabs defaultValue="channel">
      <TabsList>
        <TabsTrigger value="channel">By Channel</TabsTrigger>
        <TabsTrigger value="operation">By Operation</TabsTrigger>
      </TabsList>

      <TabsContent value="channel">
        {byChannel.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No data yet</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                    Channel Name
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                    Total Cost
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                    Total Tokens
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                    API Calls
                  </th>
                </tr>
              </thead>
              <tbody>
                {byChannel.map((row, i) => (
                  <tr key={row.channelId ?? `unattributed-${i}`} className="border-t border-border">
                    <td className="py-3 px-4 font-medium">
                      {row.channelName ?? 'Unattributed'}
                    </td>
                    <td className="py-3 px-4 tabular-nums">{formatCost(row.totalCostUsd)}</td>
                    <td className="py-3 px-4 tabular-nums">{formatNumber(row.totalTokens)}</td>
                    <td className="py-3 px-4 tabular-nums">{formatNumber(row.callCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="operation">
        {byOperation.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No data yet</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                    Operation
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                    Total Cost
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                    Total Tokens
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                    API Calls
                  </th>
                </tr>
              </thead>
              <tbody>
                {byOperation.map((row) => (
                  <tr key={row.operation} className="border-t border-border">
                    <td className="py-3 px-4 font-medium">
                      {humanizeOperation(row.operation)}
                    </td>
                    <td className="py-3 px-4 tabular-nums">{formatCost(row.totalCostUsd)}</td>
                    <td className="py-3 px-4 tabular-nums">{formatNumber(row.totalTokens)}</td>
                    <td className="py-3 px-4 tabular-nums">{formatNumber(row.callCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
