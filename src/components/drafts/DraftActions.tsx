'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { drafts } from '@/db/schema';

type DraftRow = typeof drafts.$inferSelect;

interface DraftActionsProps {
  draft: Pick<DraftRow, 'id' | 'channelId' | 'contentType' | 'title' | 'researchSources'>;
  onActionComplete?: () => void;
}

type ActionState = 'idle' | 'rejecting' | 'regenerating';

export function DraftActions({ draft, onActionComplete }: DraftActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [rejectReason, setRejectReason] = useState('');
  const [regenNote, setRegenNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setError(null);
    const res = await fetch(`/api/drafts/${draft.id}/approve`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? 'Failed to approve draft');
      return;
    }
    startTransition(() => {
      router.refresh();
    });
    onActionComplete?.();
  }

  async function handleReject() {
    setError(null);
    const res = await fetch(`/api/drafts/${draft.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? 'Failed to reject draft');
      return;
    }
    startTransition(() => {
      router.refresh();
    });
    onActionComplete?.();
  }

  async function handleRegenerate() {
    setError(null);
    const topicTitle = draft.title ?? 'Untitled';
    const topicAngle = regenNote.trim() || 'Same angle as original';
    const res = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: draft.channelId,
        contentType: draft.contentType,
        topicTitle,
        topicAngle,
        sources: draft.researchSources ?? [],
        regenerationNote: regenNote.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? 'Failed to regenerate draft');
      return;
    }
    startTransition(() => {
      router.refresh();
    });
    onActionComplete?.();
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-xs text-destructive font-mono border border-destructive/20 bg-destructive/5 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* Reject inline form */}
      {actionState === 'rejecting' && (
        <div className="flex flex-col gap-2">
          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            className="text-sm min-h-[72px] resize-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={handleReject}
              className="flex-1"
            >
              {isPending ? 'Rejecting…' : 'Confirm Reject'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => { setActionState('idle'); setRejectReason(''); setError(null); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Regenerate inline form */}
      {actionState === 'regenerating' && (
        <div className="flex flex-col gap-2">
          <Textarea
            placeholder="Revision note — what should change? (optional)"
            value={regenNote}
            onChange={e => setRegenNote(e.target.value)}
            className="text-sm min-h-[72px] resize-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={isPending}
              onClick={handleRegenerate}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isPending ? 'Generating…' : 'Regenerate'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => { setActionState('idle'); setRegenNote(''); setError(null); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Main action buttons */}
      {actionState === 'idle' && (
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            disabled={isPending}
            onClick={handleApprove}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isPending ? 'Approving…' : 'Approve'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => setActionState('rejecting')}
          >
            Reject
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => setActionState('regenerating')}
          >
            Regenerate
          </Button>
        </div>
      )}
    </div>
  );
}
