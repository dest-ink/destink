import { DollarSign, Zap, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AuditSummaryCardsProps {
  summary: {
    totalCostUsd: number;
    totalTokens: number;
    callCount: number;
  };
}

export function AuditSummaryCards({ summary }: AuditSummaryCardsProps) {
  const formattedCost = `$${summary.totalCostUsd.toFixed(2)}`;
  const formattedTokens = summary.totalTokens.toLocaleString();
  const formattedCalls = summary.callCount.toLocaleString();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formattedCost}</p>
          <p className="text-xs text-muted-foreground mt-1">USD</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Zap className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formattedTokens}</p>
          <p className="text-xs text-muted-foreground mt-1">prompt + completion</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formattedCalls}</p>
          <p className="text-xs text-muted-foreground mt-1">AI API calls</p>
        </CardContent>
      </Card>
    </div>
  );
}
