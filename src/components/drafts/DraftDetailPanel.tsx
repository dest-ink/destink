'use client';

import { useState } from 'react';
import { DraftActions } from './DraftActions';
import type { DraftWithChannel } from './DraftCard';
import { VoiceConfidenceBadge } from './VoiceConfidenceBadge';
import { HeadlinePicker } from './HeadlinePicker';
import { SourcesSection } from './SourcesSection';

interface DraftDetailPanelProps {
  draft: DraftWithChannel;
  onActionComplete?: () => void;
}

export function DraftDetailPanel({ draft, onActionComplete }: DraftDetailPanelProps) {
  const [activeHeadline, setActiveHeadline] = useState<number>(0);

  const headlines = Array.isArray(draft.headlineOptions) && draft.headlineOptions.length > 0
    ? draft.headlineOptions
    : draft.title
    ? [draft.title]
    : [];

  const sources = Array.isArray(draft.researchSources) ? draft.researchSources : [];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Panel header with voice confidence badge */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">
          Draft Review
        </p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{draft.channelName}</p>
          {typeof draft.voiceConfidence === 'number' && (
            <VoiceConfidenceBadge score={draft.voiceConfidence} />
          )}
        </div>
      </div>

      <div className="flex-1 px-5 py-4 flex flex-col gap-5 min-h-0">
        {/* Headline picker */}
        {headlines.length > 0 && (
          <HeadlinePicker
            headlines={headlines}
            activeIndex={activeHeadline}
            onSelect={setActiveHeadline}
          />
        )}

        {/* Hook */}
        {draft.hook && (
          <section>
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">
              Hook
            </h3>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{draft.hook}</p>
          </section>
        )}

        {/* Body */}
        {draft.body && (
          <section>
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">
              Body
            </h3>
            <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{draft.body}</div>
          </section>
        )}

        {/* CTA */}
        {draft.cta && (
          <section>
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">
              CTA
            </h3>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap border-l-2 border-primary/40 pl-3 italic">
              {draft.cta}
            </p>
          </section>
        )}

        {/* Collapsible sources section */}
        {sources.length > 0 && (
          <SourcesSection sources={sources} />
        )}
      </div>

      {/* Actions pinned to bottom */}
      <div className="px-5 py-4 border-t border-border shrink-0">
        <DraftActions draft={draft} onActionComplete={onActionComplete} />
      </div>
    </div>
  );
}
