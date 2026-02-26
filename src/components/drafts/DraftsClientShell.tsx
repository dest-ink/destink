'use client';

import { useState, useMemo } from 'react';
import { DraftCard, type DraftWithChannel } from './DraftCard';
import { DraftDetailPanel } from './DraftDetailPanel';
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
}

export function DraftsClientShell({ drafts, channelOptions }: DraftsClientShellProps) {
  const [selectedId, setSelectedId] = useState<string | null>(drafts[0]?.id ?? null);
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterContentType, setFilterContentType] = useState<string>('all');
  const [filterConfidence, setFilterConfidence] = useState<string>('all');

  const filtered = useMemo(() => {
    return drafts.filter(d => {
      if (filterChannel !== 'all' && d.channelId !== filterChannel) return false;
      if (filterContentType !== 'all' && d.contentType !== filterContentType) return false;
      if (filterConfidence === 'low' && typeof d.voiceConfidence === 'number' && d.voiceConfidence >= 60)
        return false;
      if (filterConfidence === 'high' && typeof d.voiceConfidence === 'number' && d.voiceConfidence < 60)
        return false;
      return true;
    });
  }, [drafts, filterChannel, filterContentType, filterConfidence]);

  const selectedDraft = filtered.find(d => d.id === selectedId) ?? filtered[0] ?? null;

  function handleActionComplete() {
    // After approve/reject/regenerate, clear selected so the panel closes gracefully
    setSelectedId(null);
  }

  return (
    <div className="flex h-full">
      {/* Left: list + filter bar */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
        {/* Filter bar */}
        <div className="px-4 py-3 border-b border-border flex flex-col gap-2 shrink-0">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Filters</p>
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
              <SelectItem value="high">{'High (\u226560%)'}</SelectItem>
              <SelectItem value="low">{'Low (<60%)'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Draft list */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {filtered.length === 0 && (
            <div className="py-12 text-center">
              <p className="font-mono text-3xl text-muted-foreground/20 mb-3">◇</p>
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
              <p className="font-mono text-4xl text-muted-foreground/20 mb-3">◇</p>
              <p className="text-sm text-muted-foreground">Select a draft to review</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
