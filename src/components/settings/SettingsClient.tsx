'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Channel {
  id: string;
  name: string;
  platform: string;
}

interface Researcher {
  id: string;
  name: string;
}

interface SettingsClientProps {
  initialChannels: Channel[];
  initialResearchers: Researcher[];
}

export function SettingsClient({ initialChannels, initialResearchers }: SettingsClientProps) {
  const router = useRouter();
  const [channels, setChannels] = useState(initialChannels);
  const [researchers, setResearchers] = useState(initialResearchers);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDeleteChannel = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will also delete all drafts, voice profiles, and publish queue items for this channel.`)) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/channels/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error ?? 'Failed to delete channel');
        return;
      }
      toast.success(`Deleted "${name}"`);
      setChannels(prev => prev.filter(c => c.id !== id));
      router.refresh();
    } catch {
      toast.error('Failed to delete channel');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteResearcher = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will also delete automation schedules linked to this researcher.`)) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/researchers/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error ?? 'Failed to delete researcher');
        return;
      }
      toast.success(`Deleted "${name}"`);
      setResearchers(prev => prev.filter(r => r.id !== id));
      router.refresh();
    } catch {
      toast.error('Failed to delete researcher');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage channels, researchers, and AI usage.</p>
        </div>

        {/* Channels */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Channels</h2>
            <Link href="/channels/new" className="text-xs text-primary hover:underline">+ New channel</Link>
          </div>
          <div className="space-y-2">
            {channels.map(ch => (
              <div
                key={ch.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card group hover:border-primary/20 transition-colors"
              >
                <Link href={`/channels/${ch.id}`} className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{ch.name}</span>
                  <span className="text-xs text-muted-foreground capitalize ml-2">{ch.platform}</span>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteChannel(ch.id, ch.name)}
                  disabled={deleting === ch.id}
                  className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                  aria-label={`Delete ${ch.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            {channels.length === 0 && (
              <p className="text-sm text-muted-foreground">No channels configured.</p>
            )}
          </div>
        </div>

        {/* Researchers */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Researchers</h2>
            <Link href="/research/new" className="text-xs text-primary hover:underline">+ New researcher</Link>
          </div>
          <div className="space-y-2">
            {researchers.map(r => (
              <div
                key={r.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card group hover:border-primary/20 transition-colors"
              >
                <Link href={`/research/${r.id}`} className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{r.name}</span>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteResearcher(r.id, r.name)}
                  disabled={deleting === r.id}
                  className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                  aria-label={`Delete ${r.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            {researchers.length === 0 && (
              <p className="text-sm text-muted-foreground">No researchers configured.</p>
            )}
          </div>
        </div>

        {/* AI Usage */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">AI Usage</h2>
          <Link
            href="/audit"
            className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card hover:border-primary/20 transition-colors"
          >
            <span className="text-sm text-foreground">View AI usage & costs</span>
            <span className="text-xs text-muted-foreground">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
