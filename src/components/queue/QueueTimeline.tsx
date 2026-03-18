'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QueueItem } from './QueueItem';
import type { QueueItemData } from './QueueItem';
import { Button } from '@/components/ui/button';

interface GroupedItems {
  label: string;
  items: QueueItemData[];
}

interface QueueTimelineProps {
  groups: GroupedItems[];
}

export function QueueTimeline({ groups: initialGroups }: QueueTimelineProps) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);

  function handleRemoved(id: string) {
    setGroups(prev =>
      prev
        .map(g => ({ ...g, items: g.items.filter(item => item.id !== id) }))
        .filter(g => g.items.length > 0)
    );
  }

  function handlePublishedNow(id: string) {
    // The API now awaits publish, so refresh to get the final status
    router.refresh();
  }

  function handleRetried(id: string) {
    // Optimistically update status to 'queued' and clear error.
    // retryCount is intentionally NOT incremented here — the server increments it atomically
    // via SQL and owns the source of truth. The displayed count will reconcile on next reload.
    setGroups(prev =>
      prev.map(g => ({
        ...g,
        items: g.items.map(item =>
          item.id === id
            ? { ...item, status: 'queued' as const, errorMessage: null }
            : item
        ),
      }))
    );
  }

  if (groups.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg py-20 text-center">
        <h2 className="text-lg font-semibold text-foreground mb-2">Nothing in the queue</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Approved drafts are scheduled for publication here. Approve a draft to add it to the queue.
        </p>
        <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/drafts">Review drafts</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map(group => (
        <section key={group.label}>
          {/* Date group header */}
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-widest">
              {group.label}
            </h2>
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-mono text-muted-foreground/50">{group.items.length}</span>
          </div>
          {/* Items */}
          <div className="flex flex-col gap-2">
            {group.items.map(item => (
              <QueueItem
                key={item.id}
                item={item}
                onRemoved={handleRemoved}
                onRetried={handleRetried}
                onPublishedNow={handlePublishedNow}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
