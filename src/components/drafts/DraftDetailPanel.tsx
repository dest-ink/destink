'use client';

import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Check, X, Send, Sparkles } from 'lucide-react';
import { DraftActions } from './DraftActions';
import type { DraftWithChannel } from './DraftCard';
import { VoiceConfidenceBadge } from './VoiceConfidenceBadge';
import { HeadlinePicker } from './HeadlinePicker';
import { SourcesSection } from './SourcesSection';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface DraftDetailPanelProps {
  draft: DraftWithChannel;
  onActionComplete?: () => void;
}

export function DraftDetailPanel({ draft, onActionComplete }: DraftDetailPanelProps) {
  const router = useRouter();
  const [activeHeadline, setActiveHeadline] = useState<number>(0);

  // Editable content state
  const [editingField, setEditingField] = useState<'hook' | 'body' | 'cta' | null>(null);
  const [editHook, setEditHook] = useState(draft.hook ?? '');
  const [editBody, setEditBody] = useState(draft.body ?? '');
  const [editCta, setEditCta] = useState(draft.cta ?? '');
  const [saving, setSaving] = useState(false);

  // AI chat state
  const [aiMessage, setAiMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Current content (editable values take priority)
  const currentHook = editHook;
  const currentBody = editBody;
  const currentCta = editCta;

  const headlines = Array.isArray(draft.headlineOptions) && draft.headlineOptions.length > 0
    ? draft.headlineOptions
    : draft.title
    ? [draft.title]
    : [];

  const selectedTitle = headlines[activeHeadline] ?? draft.title ?? '';

  const displayBody = useMemo(() => {
    if (!currentBody || !selectedTitle) return currentBody;
    return currentBody.replace(/^##\s+.+$/m, `## ${selectedTitle}`);
  }, [currentBody, selectedTitle]);

  const sources = Array.isArray(draft.researchSources) ? draft.researchSources : [];

  // Word count
  const wordCount = [currentHook, currentBody, currentCta]
    .filter(Boolean)
    .join(' ')
    .split(/\s+/)
    .filter(w => w.length > 0).length;

  // ── Save manual edit ──────────────────────────────────────────────────

  const handleSaveEdit = async (field: 'hook' | 'body' | 'cta') => {
    setSaving(true);
    try {
      const value = field === 'hook' ? editHook : field === 'body' ? editBody : editCta;
      const res = await fetch(`/api/drafts/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        toast.error('Failed to save changes');
        return;
      }
      toast.success('Saved');
      setEditingField(null);
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = (field: 'hook' | 'body' | 'cta') => {
    if (field === 'hook') setEditHook(draft.hook ?? '');
    if (field === 'body') setEditBody(draft.body ?? '');
    if (field === 'cta') setEditCta(draft.cta ?? '');
    setEditingField(null);
  };

  // ── AI chat ───────────────────────────────────────────────────────────

  const handleAISubmit = async () => {
    if (!aiMessage.trim() || aiLoading) return;

    setAiLoading(true);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/ai-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: aiMessage.trim(),
          hook: currentHook,
          draftBody: currentBody,
          cta: currentCta,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as { error?: string }).error || 'AI edit failed');
        return;
      }

      const { edits } = await res.json() as { edits: { hook?: string; body?: string; cta?: string } };

      // Apply edits to local state
      if (edits.hook) setEditHook(edits.hook);
      if (edits.body) setEditBody(edits.body);
      if (edits.cta) setEditCta(edits.cta);

      toast.success('Draft updated by AI');
      setAiMessage('');
    } catch {
      toast.error('Failed to connect');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAIKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAISubmit();
    }
  };

  // ── Editable section renderer ─────────────────────────────────────────

  function EditableSection({
    label,
    field,
    value,
    onChange,
    className = '',
  }: {
    label: string;
    field: 'hook' | 'body' | 'cta';
    value: string;
    onChange: (v: string) => void;
    className?: string;
  }) {
    const isEditing = editingField === field;

    return (
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            {label}
          </h3>
          {!isEditing ? (
            <button
              onClick={() => setEditingField(field)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
              aria-label={`Edit ${label}`}
            >
              <Pencil className="w-3 h-3" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleSaveEdit(field)}
                disabled={saving}
                className="text-green-500 hover:text-green-400 transition-colors p-1 rounded"
                aria-label="Save"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleCancelEdit(field)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                aria-label="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        {isEditing ? (
          <Textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            className={`text-sm leading-relaxed resize-none bg-card border-border min-h-[100px] ${className}`}
            autoFocus
          />
        ) : (
          <div
            className={`text-sm text-foreground leading-relaxed whitespace-pre-wrap cursor-pointer hover:bg-accent/30 rounded-md px-2 py-1.5 -mx-2 transition-colors ${className}`}
            onClick={() => setEditingField(field)}
          >
            {value || <span className="text-muted-foreground italic">Empty</span>}
          </div>
        )}
      </section>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Panel header with actions */}
      <div className="px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Draft Review
            </p>
            <p className="text-sm text-muted-foreground">{draft.channelName}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground tabular-nums px-2 py-0.5 rounded bg-secondary">
              {wordCount.toLocaleString()} words
            </span>
            {typeof draft.voiceConfidence === 'number' && (
              <VoiceConfidenceBadge score={draft.voiceConfidence} />
            )}
          </div>
        </div>
        {/* Actions in header */}
        <DraftActions draft={draft} selectedTitle={selectedTitle} onActionComplete={onActionComplete} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5 min-h-0">
        {/* Headline picker */}
        {headlines.length > 1 && (
          <HeadlinePicker
            headlines={headlines}
            activeIndex={activeHeadline}
            onSelect={setActiveHeadline}
          />
        )}

        {/* Hook */}
        {(currentHook || editingField === 'hook') && (
          <EditableSection label="Hook" field="hook" value={currentHook} onChange={setEditHook} />
        )}

        {/* Body */}
        {(displayBody || editingField === 'body') && (
          <EditableSection
            label="Body"
            field="body"
            value={editingField === 'body' ? editBody : (displayBody ?? '')}
            onChange={setEditBody}
            className={editingField === 'body' ? 'min-h-[300px]' : ''}
          />
        )}

        {/* CTA */}
        {(currentCta || editingField === 'cta') && (
          <EditableSection label="CTA" field="cta" value={currentCta} onChange={setEditCta} />
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <SourcesSection sources={sources} />
        )}
      </div>

      {/* AI chat input pinned to bottom */}
      <div className="px-5 py-3 border-t border-border bg-background shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={inputRef}
              value={aiMessage}
              onChange={e => setAiMessage(e.target.value)}
              onKeyDown={handleAIKeyDown}
              placeholder="Ask AI to edit this draft..."
              className="text-sm resize-none min-h-[40px] max-h-[120px] pr-10 bg-card border-border"
              rows={1}
              disabled={aiLoading}
            />
            <button
              onClick={handleAISubmit}
              disabled={aiLoading || !aiMessage.trim()}
              className="absolute right-2 bottom-2 text-primary hover:text-primary/80 disabled:text-muted-foreground/30 transition-colors"
              aria-label="Send to AI"
            >
              {aiLoading ? (
                <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin inline-block" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          <Sparkles className="w-3 h-3 inline mr-0.5" />
          AI will edit the draft based on your instructions. Press Enter to send.
        </p>
      </div>
    </div>
  );
}
