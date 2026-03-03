'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

const PLATFORM_STYLES: Record<string, { label: string; color: string }> = {
  linkedin: { label: 'LinkedIn', color: 'bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/20' },
  substack: { label: 'Substack', color: 'bg-[#FF6719]/10 text-[#FF6719] border-[#FF6719]/20' },
};

interface Run {
  id: string;
  channelId: string;
  channelName: string;
  platform: string;
  runAt: string;
  topicCount: number;
  sourceCount: number;
  aiModel: string | null;
  draftsGenerated: string[] | null;
}

interface RunsListProps {
  runs: Run[];
  researcherId: string;
}

export function RunsList({ runs, researcherId }: RunsListProps) {
  if (runs.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-muted-foreground">
          No runs yet. Start your first research run above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const style = PLATFORM_STYLES[run.platform] ?? {
          label: run.platform,
          color: 'bg-muted text-muted-foreground border-border',
        };

        return (
          <Link
            key={run.id}
            href={`/research/${researcherId}/runs/${run.id}`}
            className="block border border-border bg-card rounded-lg p-4 hover:border-primary/40 hover:bg-card/80 transition-all duration-200"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono text-muted-foreground shrink-0">
                  {new Date(run.runAt).toLocaleDateString()}{' '}
                  {new Date(run.runAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <Badge
                  className={`border text-[10px] font-mono shrink-0 ${style.color}`}
                  variant="outline"
                >
                  {run.channelName}
                </Badge>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {run.sourceCount} source{run.sourceCount !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-muted-foreground">
                  {run.topicCount} topic{run.topicCount !== 1 ? 's' : ''}
                </span>
                {run.draftsGenerated && run.draftsGenerated.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono text-green-600 border-green-500/20 bg-green-500/10"
                  >
                    {run.draftsGenerated.length} draft{run.draftsGenerated.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                <span className="text-muted-foreground/40">&rarr;</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
