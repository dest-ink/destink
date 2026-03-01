import Link from 'next/link';
import { ChannelCostSummary, type CostSummary } from '@/components/channels/ChannelCostSummary';

interface LastResearchRun {
  runAt: string;
  topicCount: number;
}

interface OverviewTabProps {
  costSummary: CostSummary;
  hasVoice: boolean;
  lastResearchRun: LastResearchRun | null;
}

export function OverviewTab({
  costSummary,
  hasVoice,
  lastResearchRun,
}: OverviewTabProps) {
  return (
    <div className="space-y-4">
      <ChannelCostSummary costSummary={costSummary} />

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Voice</span>
          {hasVoice ? (
            <span className="text-sm text-green-600 font-medium">Voice configured</span>
          ) : (
            <span className="text-sm text-amber-500">No voice profile</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Research</span>
          {lastResearchRun ? (
            <span className="text-sm text-foreground">
              {lastResearchRun.topicCount} topics found &middot;{' '}
              {new Date(lastResearchRun.runAt).toLocaleDateString()}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">No runs yet</span>
          )}
        </div>
      </div>

      <Link
        href="/research"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
      >
        Manage researchers &rarr;
      </Link>
    </div>
  );
}
