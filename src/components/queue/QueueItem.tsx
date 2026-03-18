'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PLATFORM_STYLES: Record<string, { label: string; color: string }> = {
  linkedin: { label: 'LinkedIn', color: 'bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/20' },
  substack: { label: 'Substack', color: 'bg-[#FF6719]/10 text-[#FF6719] border-[#FF6719]/20' },
};

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  queued: { label: 'Queued', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  publishing: { label: 'Publishing', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  published: { label: 'Published', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  failed: { label: 'Failed', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

export interface QueueItemData {
  id: string;
  draftId: string;
  channelId: string;
  scheduledFor: Date | string;
  publishedAt: Date | string | null;
  status: 'queued' | 'publishing' | 'published' | 'failed';
  retryCount: number;
  errorMessage: string | null;
  createdAt: Date | string;
  draftTitle: string | null;
  draftHook: string | null;
  draftContentType: 'note' | 'article';
  channelName: string;
  channelPlatform: 'linkedin' | 'substack';
}

interface QueueItemProps {
  item: QueueItemData;
  onRemoved: (id: string) => void;
  onRetried: (id: string) => void;
  onPublishedNow?: (id: string) => void;
}

function toLocalDatetimeValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

export function QueueItem({ item, onRemoved, onRetried, onPublishedNow }: QueueItemProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [newDateTime, setNewDateTime] = useState('');
  const [displayScheduledFor, setDisplayScheduledFor] = useState(item.scheduledFor);

  const platformStyle = PLATFORM_STYLES[item.channelPlatform] ?? {
    label: item.channelPlatform,
    color: 'bg-muted text-muted-foreground border-border',
  };
  const statusStyle = STATUS_STYLES[item.status] ?? {
    label: item.status,
    color: 'bg-muted text-muted-foreground border-border',
  };

  const displayTitle = item.draftTitle || item.draftHook || 'Untitled draft';
  const scheduledDate = new Date(displayScheduledFor);
  const scheduledTime = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const scheduledDateStr = scheduledDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

  async function handleRemove() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/queue/${item.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        const msg = data.error ?? 'Failed to remove item';
        setError(msg);
        toast.error(msg);
      } else {
        onRemoved(item.id);
      }
    } catch {
      const msg = 'Network error — please try again';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublishNow() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/queue/${item.id}/publish-now`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        const msg = data.error ?? 'Failed to publish';
        setError(msg);
        toast.error(msg);
      } else {
        toast.success('Published');
        onPublishedNow?.(item.id);
      }
    } catch {
      const msg = 'Network error — please try again';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/queue/${item.id}/retry`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        const msg = data.error ?? 'Failed to retry item';
        setError(msg);
        toast.error(msg);
      } else {
        onRetried(item.id);
      }
    } catch {
      const msg = 'Network error — please try again';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function startReschedule() {
    setNewDateTime(toLocalDatetimeValue(scheduledDate));
    setRescheduling(true);
  }

  async function handleReschedule() {
    if (!newDateTime) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/queue/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: new Date(newDateTime).toISOString() }),
      });
      if (!res.ok) {
        const data = await res.json();
        const msg = data.error ?? 'Failed to reschedule';
        setError(msg);
        toast.error(msg);
      } else {
        setDisplayScheduledFor(new Date(newDateTime).toISOString());
        setRescheduling(false);
        toast.success('Rescheduled');
      }
    } catch {
      const msg = 'Network error — please try again';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-border bg-card rounded-lg p-4 flex flex-col gap-3">
      {/* Top row: time + status */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {item.status === 'queued' && !rescheduling ? (
            <button
              onClick={startReschedule}
              className="font-mono text-xs text-muted-foreground tabular-nums hover:text-foreground hover:underline transition-colors"
              title="Click to reschedule"
            >
              {scheduledDateStr}, {scheduledTime}
            </button>
          ) : (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {scheduledDateStr}, {scheduledTime}
            </span>
          )}
        </div>
        <Badge className={`border text-xs font-mono shrink-0 ${statusStyle.color}`} variant="outline">
          {statusStyle.label}
        </Badge>
      </div>

      {/* Reschedule inline form */}
      {rescheduling && (
        <div className="flex items-center gap-2">
          <Input
            type="datetime-local"
            value={newDateTime}
            onChange={e => setNewDateTime(e.target.value)}
            className="h-8 text-xs font-mono w-auto"
          />
          <Button size="sm" className="h-7 px-3 text-xs" onClick={handleReschedule} disabled={loading}>
            {loading ? '...' : 'Save'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs"
            onClick={() => setRescheduling(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Channel name + platform */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground truncate">{item.channelName}</span>
            <Badge className={`border text-xs font-mono shrink-0 ${platformStyle.color}`} variant="outline">
              {platformStyle.label}
            </Badge>
          </div>
          {/* Draft title */}
          <p className="text-sm font-medium text-foreground truncate">{displayTitle}</p>
          {/* Content type */}
          <p className="text-xs font-mono text-muted-foreground/60 mt-0.5 capitalize">{item.draftContentType}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {item.status === 'queued' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePublishNow}
                disabled={loading}
                className="text-xs h-7 px-2 text-muted-foreground hover:text-primary hover:border-primary/50"
              >
                {loading ? '…' : 'Publish Now'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={loading}
                className="text-xs h-7 px-2 text-muted-foreground hover:text-destructive hover:border-destructive/50"
              >
                Remove
              </Button>
            </>
          )}
          {item.status === 'failed' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={loading}
              className="text-xs h-7 px-2 text-muted-foreground hover:text-primary hover:border-primary/50"
            >
              {loading ? '…' : 'Retry'}
            </Button>
          )}
        </div>
      </div>

      {/* Failed error message */}
      {item.status === 'failed' && item.errorMessage && (
        <div className="bg-destructive/5 border border-destructive/20 rounded px-3 py-2">
          <p className="text-xs text-destructive font-mono leading-relaxed">{item.errorMessage}</p>
          {item.retryCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">Retry attempts: {item.retryCount}</p>
          )}
        </div>
      )}

      {/* Inline action error */}
      {error && (
        <p className="text-xs text-destructive font-mono">{error}</p>
      )}
    </div>
  );
}
