'use client';

import { useState, useMemo } from 'react';
import { DraftCard, type DraftWithChannel } from './DraftCard';
import { DraftDetailPanel } from './DraftDetailPanel';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DraftsClientShellProps {
  drafts: DraftWithChannel[];
  channelOptions: { id: string; name: string }[];
  initialChannelFilter?: string;
}

export function DraftsClientShell({ drafts, channelOptions, initialChannelFilter }: DraftsClientShellProps) {
  const [selectedId, setSelectedId] = useState<string | null>(drafts[0]?.id ?? null);
  const [filterChannel, setFilterChannel] = useState<string>(initialChannelFilter ?? 'all');
  const [filterContentType, setFilterContentType] = useState<string>('all');
  const [filterConfidence, setFilterConfidence] = useState<string>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // On mobile: null = show list, string = show detail
  const [mobileDetailId, setMobileDetailId] = useState<string | null>(null);

  const activeFilterCount = [filterChannel, filterContentType, filterConfidence].filter(v => v !== 'all').length;

  const filtered = useMemo(() => {
    return drafts.filter(d => {
      if (filterChannel !== 'all' && d.channelId !== filterChannel) return false;
      if (filterContentType !== 'all' && d.contentType !== filterContentType) return false;
      if (filterConfidence === 'low') {
        // Exclude drafts with no score, or score ≥ 60
        if (typeof d.voiceConfidence !== 'number' || d.voiceConfidence >= 60) return false;
      }
      if (filterConfidence === 'high') {
        // Exclude drafts with no score, or score < 60
        if (typeof d.voiceConfidence !== 'number' || d.voiceConfidence < 60) return false;
      }
      return true;
    });
  }, [drafts, filterChannel, filterContentType, filterConfidence]);

  // After an action, router.refresh() removes the actioned draft from `filtered`.
  // At that point filtered.find returns undefined and the panel shows the empty state.
  // We intentionally do NOT fall back to filtered[0] here — auto-selecting the next draft
  // after an action would confuse the user into thinking it was also actioned.
  const selectedDraft = (selectedId ? filtered.find(d => d.id === selectedId) : null) ?? null;
  const mobileDetailDraft = (mobileDetailId ? filtered.find(d => d.id === mobileDetailId) : null) ?? null;

  function handleActionComplete() {
    // Don't eagerly clear selectedId — let router.refresh() remove the draft from the list,
    // which will cause selectedDraft to become null naturally on the next render.
  }

  function handleMobileSelect(id: string) {
    setSelectedId(id);
    setMobileDetailId(id);
  }

  const filterBar = (
    <>
      <Select value={filterChannel} onValueChange={setFilterChannel}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="All channels" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All channels</SelectItem>
          {channelOptions.map(ch => (
            <SelectItem key={ch.id} value={ch.id}>
              {ch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filterContentType} onValueChange={setFilterContentType}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="note">Note</SelectItem>
          <SelectItem value="article">Article</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filterConfidence} onValueChange={setFilterConfidence}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Voice confidence" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All confidence</SelectItem>
          <SelectItem value="high">{'\u226560% confidence'}</SelectItem>
          <SelectItem value="low">{'<60% confidence'}</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <>
      {/* ── Desktop layout (md+) ── */}
      <div className="hidden md:flex h-full">
        {/* Left: list + filter bar */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col">
          {/* Filter bar */}
          <div className="px-4 py-3 border-b border-border flex flex-col gap-2 shrink-0">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Filters</p>
            {filterBar}
          </div>

          {/* Draft list */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {filtered.length === 0 && (
              <div className="py-12 text-center">
                <p className="font-mono text-3xl text-muted-foreground/20 mb-3">&#9671;</p>
                <p className="text-sm text-muted-foreground">No drafts match the current filters.</p>
              </div>
            )}
            {filtered.map(draft => (
              <DraftCard
                key={draft.id}
                draft={draft}
                isActive={draft.id === selectedDraft?.id}
                onClick={() => setSelectedId(draft.id)}
              />
            ))}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 min-w-0">
          {selectedDraft ? (
            <DraftDetailPanel
              key={selectedDraft.id}
              draft={selectedDraft}
              onActionComplete={handleActionComplete}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <p className="font-mono text-4xl text-muted-foreground/20 mb-3">&#9671;</p>
                <p className="text-sm text-muted-foreground">Select a draft to review</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile layout (<md) ── */}
      <div className="flex flex-col h-full md:hidden">
        {mobileDetailDraft ? (
          /* Detail view */
          <div className="flex flex-col h-full">
            <button
              onClick={() => setMobileDetailId(null)}
              className="flex items-center gap-1.5 px-4 py-3 text-sm text-muted-foreground hover:text-foreground border-b border-border shrink-0 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to drafts
            </button>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <DraftDetailPanel
                key={mobileDetailDraft.id}
                draft={mobileDetailDraft}
                onActionComplete={() => { handleActionComplete(); setMobileDetailId(null); }}
              />
            </div>
          </div>
        ) : (
          /* List view */
          <>
            {/* Collapsible filters */}
            <div className="border-b border-border shrink-0">
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-mono text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="text-[10px] font-sans font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full normal-case tracking-normal">
                      {activeFilterCount}
                    </span>
                  )}
                </span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {filtersOpen && (
                <div className="px-4 pb-3 flex flex-col gap-2">
                  {filterBar}
                </div>
              )}
            </div>

            {/* Draft list */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {filtered.length === 0 && (
                <div className="py-12 text-center">
                  <p className="font-mono text-3xl text-muted-foreground/20 mb-3">&#9671;</p>
                  <p className="text-sm text-muted-foreground">No drafts match the current filters.</p>
                </div>
              )}
              {filtered.map(draft => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  isActive={draft.id === mobileDetailId}
                  onClick={() => handleMobileSelect(draft.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
