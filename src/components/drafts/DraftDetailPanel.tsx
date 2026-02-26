'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DraftActions } from './DraftActions';
import type { DraftWithChannel } from './DraftCard';

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
      {/* Panel header */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">
          Draft Review
        </p>
        <p className="text-sm text-muted-foreground">
          {draft.channelName}
          {typeof draft.voiceConfidence === 'number' && (
            <span
              className={`ml-2 font-mono text-xs ${
                draft.voiceConfidence < 60 ? 'text-yellow-400' : 'text-muted-foreground'
              }`}
            >
              Voice {draft.voiceConfidence}%
            </span>
          )}
        </p>
      </div>

      <div className="flex-1 px-5 py-4 flex flex-col gap-5 min-h-0">
        {/* Headline options */}
        {headlines.length > 0 && (
          <section>
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">
              Headlines
            </h3>
            <div className="flex flex-col gap-1.5">
              {headlines.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveHeadline(i)}
                  className={[
                    'w-full text-left rounded-md px-3 py-2 text-sm transition-colors border',
                    i === activeHeadline
                      ? 'border-primary/50 bg-primary/5 text-foreground'
                      : 'border-transparent hover:border-border hover:bg-secondary text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                >
                  <span className="font-mono text-xs text-primary/60 mr-2">{i + 1}.</span>
                  {h}
                </button>
              ))}
            </div>
          </section>
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

        {/* Source links */}
        {sources.length > 0 && (
          <section>
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">
              Sources
            </h3>
            <div className="flex flex-col gap-1.5">
              {sources.map((src, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Badge
                    className="shrink-0 mt-0.5 border text-[10px] font-mono capitalize bg-secondary text-muted-foreground border-border"
                    variant="outline"
                  >
                    {src.source}
                  </Badge>
                  <div className="min-w-0">
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline truncate block"
                    >
                      {src.title || src.url}
                    </a>
                    {src.summary && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-2">{src.summary}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Actions pinned to bottom */}
      <div className="px-5 py-4 border-t border-border shrink-0">
        <DraftActions draft={draft} onActionComplete={onActionComplete} />
      </div>
    </div>
  );
}
