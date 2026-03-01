'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ChannelCostSummary, type CostSummary } from '@/components/channels/ChannelCostSummary';

interface LastResearchRun {
  runAt: string;
  topicCount: number;
}

interface OverviewTabProps {
  channelId: string;
  costSummary: CostSummary;
  hasVoice: boolean;
  hasResearchConfig: boolean;
  lastResearchRun: LastResearchRun | null;
}

export function OverviewTab({
  channelId,
  costSummary,
  hasVoice,
  hasResearchConfig,
  lastResearchRun,
}: OverviewTabProps) {
  const [runningResearch, setRunningResearch] = useState(false);

  const handleRunResearch = async () => {
    setRunningResearch(true);
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) {
        toast.error('Failed to start research');
        return;
      }
      toast.success('Research started — results will appear in drafts');
    } catch {
      toast.error('Something went wrong');
    } finally {
      setRunningResearch(false);
    }
  };

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
          ) : hasResearchConfig ? (
            <span className="text-sm text-muted-foreground">No runs yet</span>
          ) : (
            <span className="text-sm text-amber-500">Not configured</span>
          )}
        </div>
      </div>

      <Button
        size="sm"
        disabled={!hasResearchConfig || runningResearch}
        onClick={handleRunResearch}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {runningResearch ? 'Starting...' : 'Run Research Now'}
      </Button>
    </div>
  );
}
