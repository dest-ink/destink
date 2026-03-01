'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TagInput } from '@/components/ui/tag-input';
import type { ResearchConfig } from '@/db/schema';

const DEFAULT_CONFIG: ResearchConfig = {
  topics: [],
  keywords: [],
  subreddits: [],
  substackFeeds: [],
  searchQueryTemplates: [],
  excludedDomains: [],
  contentTypeMix: { note: 70, article: 30 },
  maxDraftsPerRun: 3,
  scheduleHours: 6,
};

interface ResearchConfigFormProps {
  channelId: string;
  config: ResearchConfig | null;
}

export function ResearchConfigForm({ channelId, config }: ResearchConfigFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ResearchConfig>(config ?? DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = <K extends keyof ResearchConfig>(key: K, value: ResearchConfig[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (form.topics.length === 0) {
      setError('At least one topic is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/channels/${channelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchConfig: form }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as { error?: string }).error || 'Failed to save';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Research config saved');
      router.refresh();
    } catch {
      const msg = 'Something went wrong';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Topics</Label>
        <TagInput value={form.topics} onChange={v => update('topics', v)} label="topic" />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Keywords</Label>
        <TagInput value={form.keywords} onChange={v => update('keywords', v)} label="keyword" />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Subreddits</Label>
        <TagInput value={form.subreddits} onChange={v => update('subreddits', v)} label="subreddit" placeholder="e.g. r/MachineLearning" />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Substack Feeds</Label>
        <TagInput value={form.substackFeeds} onChange={v => update('substackFeeds', v)} label="feed" placeholder="e.g. stratechery.substack.com" />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Excluded Domains</Label>
        <TagInput value={form.excludedDomains} onChange={v => update('excludedDomains', v)} label="domain" placeholder="e.g. pinterest.com" />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Search Query Templates</Label>
        <p className="text-xs text-muted-foreground">One per line. Use {'{topic}'} as placeholder.</p>
        <Textarea
          value={form.searchQueryTemplates.join('\n')}
          onChange={e => update('searchQueryTemplates', e.target.value.split('\n').filter(Boolean))}
          placeholder={"latest news about {topic}\n{topic} trends 2026"}
          className="min-h-[72px] bg-card border-border font-mono text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Note %</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={form.contentTypeMix.note}
            onChange={e => {
              const note = Number(e.target.value);
              update('contentTypeMix', { note, article: 100 - note });
            }}
            className="bg-card border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Max Drafts/Run</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={form.maxDraftsPerRun}
            onChange={e => update('maxDraftsPerRun', Number(e.target.value))}
            className="bg-card border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Schedule (hours)</Label>
          <Input
            type="number"
            min={1}
            max={168}
            value={form.scheduleHours}
            onChange={e => update('scheduleHours', Number(e.target.value))}
            className="bg-card border-border"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleSave}
        disabled={loading}
        size="sm"
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {loading ? 'Saving...' : 'Save Research Config'}
      </Button>
    </div>
  );
}
