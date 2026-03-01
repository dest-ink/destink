import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

const PLATFORM_STYLES: Record<string, { label: string; color: string }> = {
  linkedin: { label: 'LinkedIn', color: 'bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/20' },
  substack: { label: 'Substack', color: 'bg-[#FF6719]/10 text-[#FF6719] border-[#FF6719]/20' },
};

interface LinkedChannel {
  channelId: string;
  channelName: string;
  platform: string;
}

interface LastRun {
  id: string;
  runAt: string;
  topicCount: number;
}

interface ResearcherCardProps {
  researcher: {
    id: string;
    name: string;
    topics: string[];
    channels: LinkedChannel[];
    lastRun: LastRun | null;
  };
}

export function ResearcherCard({ researcher }: ResearcherCardProps) {
  return (
    <Link href={`/research/${researcher.id}`}>
      <div className="group border border-border bg-card rounded-lg p-5 hover:border-primary/40 hover:bg-card/80 transition-all duration-200 cursor-pointer">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {researcher.name}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {researcher.topics.length > 0
                ? researcher.topics.slice(0, 3).join(', ') + (researcher.topics.length > 3 ? ` +${researcher.topics.length - 3} more` : '')
                : 'No topics configured'}
            </p>
          </div>
        </div>

        {/* Channel badges */}
        {researcher.channels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {researcher.channels.map((ch) => {
              const style = PLATFORM_STYLES[ch.platform] ?? {
                label: ch.platform,
                color: 'bg-muted text-muted-foreground border-border',
              };
              return (
                <Badge
                  key={ch.channelId}
                  className={`border text-[10px] font-mono ${style.color}`}
                  variant="outline"
                >
                  {ch.channelName}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Last run info */}
        <p className="mt-3 text-[11px] font-mono text-muted-foreground">
          {researcher.lastRun
            ? `Last run: ${new Date(researcher.lastRun.runAt).toLocaleDateString()} — ${researcher.lastRun.topicCount} topics`
            : 'Never run'}
        </p>
      </div>
    </Link>
  );
}
