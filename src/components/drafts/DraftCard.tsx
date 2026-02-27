'use client';

import { Badge } from '@/components/ui/badge';
import type { drafts, channels } from '@/db/schema';

type DraftRow = typeof drafts.$inferSelect;
type ChannelRow = typeof channels.$inferSelect;

const PLATFORM_STYLES: Record<string, { label: string; color: string }> = {
  linkedin: { label: 'LinkedIn', color: 'bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/20' },
  substack: { label: 'Substack', color: 'bg-[#FF6719]/10 text-[#FF6719] border-[#FF6719]/20' },
};

const CONTENT_TYPE_STYLES: Record<string, string> = {
  note: 'bg-secondary text-secondary-foreground border-border',
  article: 'bg-primary/10 text-primary border-primary/20',
};

export interface DraftWithChannel extends DraftRow {
  channelName: string;
  channelPlatform: ChannelRow['platform'];
}

interface DraftCardProps {
  draft: DraftWithChannel;
  isActive: boolean;
  onClick: () => void;
}

export function DraftCard({ draft, isActive, onClick }: DraftCardProps) {
  const platformStyle = PLATFORM_STYLES[draft.channelPlatform] ?? {
    label: draft.channelPlatform,
    color: 'bg-muted text-muted-foreground border-border',
  };
  const contentTypeStyle = CONTENT_TYPE_STYLES[draft.contentType] ?? 'bg-muted text-muted-foreground border-border';
  const isLowConfidence = typeof draft.voiceConfidence === 'number' && draft.voiceConfidence < 60;

  const hookPreview = draft.hook
    ? draft.hook.length > 120
      ? draft.hook.slice(0, 120) + '…'
      : draft.hook
    : draft.title
    ? draft.title.length > 120
      ? draft.title.slice(0, 120) + '…'
      : draft.title
    : 'No preview available';

  const formattedDate = draft.createdAt
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
        new Date(draft.createdAt)
      )
    : '—';

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full text-left border rounded-lg p-4 transition-all duration-150 cursor-pointer group',
        isActive
          ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/30'
          : 'border-border bg-card hover:border-primary/30 hover:bg-card/80',
      ].join(' ')}
    >
      {/* Top row: channel + platform badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-muted-foreground truncate">{draft.channelName}</span>
        <Badge className={`shrink-0 border text-xs font-mono ${platformStyle.color}`} variant="outline">
          {platformStyle.label}
        </Badge>
      </div>

      {/* Middle: hook preview */}
      <p className="text-sm text-foreground leading-snug line-clamp-3 mb-3">{hookPreview}</p>

      {/* Bottom row: content type badge, confidence, date */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={`border text-xs font-mono capitalize ${contentTypeStyle}`} variant="outline">
            {draft.contentType}
          </Badge>
          {isLowConfidence && (
            <Badge
              className="border text-xs font-mono bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
              variant="outline"
            >
              Low confidence
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {typeof draft.voiceConfidence === 'number' && (
            <span
              className={`font-mono text-xs ${
                isLowConfidence ? 'text-yellow-400' : 'text-muted-foreground'
              }`}
            >
              {draft.voiceConfidence}%
            </span>
          )}
          <span className="font-mono text-xs text-muted-foreground/60">{formattedDate}</span>
        </div>
      </div>
    </button>
  );
}
