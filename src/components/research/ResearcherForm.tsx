'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TagInput } from '@/components/ui/tag-input';
import { Slider } from '@/components/ui/slider';
import type { ResearchSourceConfig } from '@/db/schema';

const DEFAULT_SOURCE_CONFIG: ResearchSourceConfig = {
  subreddits: [],
  substackFeeds: [],
  searchQueryTemplates: [],
  excludedDomains: [],
};

interface Channel {
  id: string;
  name: string;
  platform: string;
}

interface ResearcherFormProps {
  /** If provided, we're editing. If not, we're creating. */
  researcher?: {
    id: string;
    name: string;
    topics: string[];
    keywords: string[];
    sourceConfig: ResearchSourceConfig;
    maxDraftsPerRun: number;
    shortFormPercent: number;
  };
  /** Currently linked channel IDs (for edit mode) */
  linkedChannelIds?: string[];
  /** All available channels for multi-select */
  allChannels: Channel[];
}

export function ResearcherForm({ researcher, linkedChannelIds, allChannels }: ResearcherFormProps) {
  const router = useRouter();
  const isEdit = !!researcher;

  const [name, setName] = useState(researcher?.name ?? '');
  const [topics, setTopics] = useState<string[]>(researcher?.topics ?? []);
  const [keywords, setKeywords] = useState<string[]>(researcher?.keywords ?? []);
  const [sourceConfig, setSourceConfig] = useState<ResearchSourceConfig>(
    researcher?.sourceConfig ?? DEFAULT_SOURCE_CONFIG,
  );
  const [maxDraftsPerRun, setMaxDraftsPerRun] = useState<number>(
    researcher?.maxDraftsPerRun ?? 3,
  );
  const [shortFormPercent, setShortFormPercent] = useState<number>(
    researcher?.shortFormPercent ?? 70,
  );
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>(
    linkedChannelIds ?? [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateSource = <K extends keyof ResearchSourceConfig>(
    key: K,
    value: ResearchSourceConfig[K],
  ) => {
    setSourceConfig((prev) => ({ ...prev, [key]: value }));
  };

  const toggleChannel = (channelId: string) => {
    setSelectedChannelIds((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId],
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (topics.length === 0) {
      setError('At least one topic is required');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      name: name.trim(),
      topics,
      keywords,
      maxDraftsPerRun,
      shortFormPercent,
      sourceConfig: {
        ...sourceConfig,
        searchQueryTemplates: sourceConfig.searchQueryTemplates.filter(Boolean),
      },
      channelIds: selectedChannelIds,
    };

    try {
      const url = isEdit ? `/api/researchers/${researcher.id}` : '/api/researchers';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as { error?: string }).error || 'Failed to save';
        setError(msg);
        toast.error(msg);
        return;
      }

      const result = await res.json();
      toast.success(isEdit ? 'Researcher updated' : 'Researcher created');
      router.push(`/research/${isEdit ? researcher.id : result.id}`);
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
    <div className="space-y-6">

      {/* Section 1: Research Identity */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Research Identity</h3>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. AI Industry Research"
            className="bg-card border-border"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Topics</Label>
          <TagInput value={topics} onChange={setTopics} label="topic" />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Keywords</Label>
          <TagInput value={keywords} onChange={setKeywords} label="keyword" />
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Section 2: Sources */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Sources</h3>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Subreddits</Label>
          <TagInput
            value={sourceConfig.subreddits}
            onChange={(v) => updateSource('subreddits', v)}
            label="subreddit"
            placeholder="e.g. r/MachineLearning"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Substack Feeds</Label>
          <TagInput
            value={sourceConfig.substackFeeds}
            onChange={(v) => updateSource('substackFeeds', v)}
            label="feed"
            placeholder="e.g. stratechery.substack.com"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Excluded Domains</Label>
          <TagInput
            value={sourceConfig.excludedDomains}
            onChange={(v) => updateSource('excludedDomains', v)}
            label="domain"
            placeholder="e.g. pinterest.com"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Search Query Templates</Label>
          <p className="text-xs text-muted-foreground">
            One per line. Use {'{topic}'} as placeholder.
          </p>
          <Textarea
            value={sourceConfig.searchQueryTemplates.join('\n')}
            onChange={(e) =>
              updateSource('searchQueryTemplates', e.target.value.split('\n'))
            }
            placeholder={"latest news about {topic}\n{topic} trends 2026"}
            className="min-h-[72px] bg-card border-border font-mono text-sm"
          />
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Section 3: Draft Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Draft Settings</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Short-form</span>
            <span className="text-sm font-medium text-muted-foreground">
              {shortFormPercent}% / {100 - shortFormPercent}%
            </span>
            <span className="text-sm font-medium text-foreground">Long-form</span>
          </div>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[shortFormPercent]}
            onValueChange={([v]) => setShortFormPercent(v)}
          />
          <p className="text-xs text-muted-foreground">
            Short-form keeps you visible with quick takes. Long-form builds authority with in-depth pieces.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Max Drafts per Run</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={maxDraftsPerRun}
            onChange={(e) => setMaxDraftsPerRun(Number(e.target.value))}
            className="bg-card border-border w-24"
          />
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Section 4: Channels */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Channels</h3>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Research results will be applied to selected channels.
          </p>
          {allChannels.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No channels available. Create a channel first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-1">
              {allChannels.map((ch) => {
                const selected = selectedChannelIds.includes(ch.id);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChannel(ch.id)}
                    className={[
                      'px-3 py-1.5 text-xs rounded-md border transition-colors',
                      selected
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-card text-muted-foreground border-border hover:border-primary/20',
                    ].join(' ')}
                  >
                    {ch.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleSubmit}
        disabled={loading}
        size="sm"
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {loading ? 'Saving...' : isEdit ? 'Save Researcher' : 'Create Researcher'}
      </Button>
    </div>
  );
}
