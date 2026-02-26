import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { channels } from '@/db/schema';

const PLATFORM_STYLES: Record<string, { label: string; color: string }> = {
  linkedin: { label: 'LinkedIn', color: 'bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/20' },
  substack: { label: 'Substack', color: 'bg-[#FF6719]/10 text-[#FF6719] border-[#FF6719]/20' },
};

// Use schema's inferred row type so the prop stays in sync with the DB automatically
type ChannelRow = typeof channels.$inferSelect;

interface ChannelCardProps {
  channel: Pick<ChannelRow, 'id' | 'name' | 'platform' | 'personaPrompt' | 'updatedAt'>;
}

export function ChannelCard({ channel }: ChannelCardProps) {
  // Fallback for unknown platform values added to the DB before UI is updated
  const style = PLATFORM_STYLES[channel.platform] ?? { label: channel.platform, color: 'bg-muted text-muted-foreground border-border' };
  return (
    <Link href={`/channels/${channel.id}`}>
      <div className="group border border-border bg-card rounded-lg p-5 hover:border-primary/40 hover:bg-card/80 transition-all duration-200 cursor-pointer">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {channel.name}
            </h3>
            <p className="mt-1 text-xs font-mono text-muted-foreground">
              {channel.personaPrompt ? 'Voice configured' : 'No voice profile'}
            </p>
          </div>
          <Badge className={`shrink-0 border text-xs font-mono ${style.color}`} variant="outline">
            {style.label}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
