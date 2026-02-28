export interface CostSummary {
  totalCostUsd: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  operationCount: number;
}

interface ChannelCostSummaryProps {
  costSummary: CostSummary;
}

export function ChannelCostSummary({ costSummary }: ChannelCostSummaryProps) {
  const { totalCostUsd, totalPromptTokens, totalCompletionTokens, operationCount } = costSummary;
  const totalTokens = totalPromptTokens + totalCompletionTokens;

  if (totalCostUsd === 0 && operationCount === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-1">AI Usage</h3>
        <p className="text-sm text-muted-foreground">No AI usage yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-medium text-foreground mb-3">AI Usage</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Total cost</p>
          <p className="font-mono text-sm font-semibold text-foreground">
            ${totalCostUsd.toFixed(4)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Total tokens</p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {totalTokens.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Operations</p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {operationCount.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
