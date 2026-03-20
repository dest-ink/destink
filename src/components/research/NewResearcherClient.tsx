'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Zap, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ResearcherForm } from './ResearcherForm';

interface Channel {
  id: string;
  name: string;
  platform: string;
}

interface NewResearcherClientProps {
  allChannels: Channel[];
  channelId?: string;
}

export function NewResearcherClient({ allChannels, channelId }: NewResearcherClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'ai' | 'manual'>(channelId ? 'ai' : 'manual');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [channelInfo, setChannelInfo] = useState<{ channelName: string; platform: string } | null>(null);

  const linkedChannel = channelId ? allChannels.find(ch => ch.id === channelId) : null;

  // Load suggested prompt when in AI mode with a channelId
  useEffect(() => {
    if (!channelId || mode !== 'ai') return;

    setPromptLoading(true);
    fetch(`/api/channels/${channelId}/suggest-researcher`)
      .then(r => r.json())
      .then(data => {
        if (data.suggestedPrompt) setPrompt(data.suggestedPrompt);
        if (data.channelName) setChannelInfo({ channelName: data.channelName, platform: data.platform });
      })
      .catch(() => {})
      .finally(() => setPromptLoading(false));
  }, [channelId, mode]);

  const handleAISubmit = async () => {
    if (prompt.trim().length < 10) {
      toast.error('Please provide a more detailed description (at least a sentence).');
      return;
    }

    setLoading(true);
    try {
      // Use the onboarding intent parser to extract researcher config
      const parseRes = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: prompt.trim() }),
      });

      if (!parseRes.ok) {
        const err = await parseRes.json().catch(() => ({}));
        toast.error((err as { error?: string }).error || 'Failed to generate researcher');
        return;
      }

      const { result } = await parseRes.json();
      toast.success('Researcher created');
      router.push(`/pipelines/${result.researcherId}`);
      router.refresh();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary w-fit">
        <button
          onClick={() => setMode('ai')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            mode === 'ai'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          AI Setup
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            mode === 'manual'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          Manual
        </button>
      </div>

      {/* AI mode */}
      {mode === 'ai' && (
        <div className="space-y-5">
          {/* Channel context */}
          {linkedChannel && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Creating researcher for</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-medium">
                {linkedChannel.name}
              </span>
              <span className="text-xs text-muted-foreground capitalize">({linkedChannel.platform})</span>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-foreground font-medium">
              Describe what you want to research
            </p>
            <p className="text-xs text-muted-foreground">
              AI will set up topics, keywords, sources, and automation based on your description.
              {channelInfo?.channelName && ' The prompt below is pre-filled based on your channel\'s voice profile.'}
            </p>
          </div>

          {promptLoading ? (
            <div className="space-y-2">
              <div className="h-32 rounded-lg bg-secondary animate-pulse" />
            </div>
          ) : (
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="I write about AI and developer tools on LinkedIn. My style is direct and analytical, like Paul Graham meets Packy McCormick."
              className="min-h-[120px] bg-card border-border resize-none text-sm leading-relaxed"
              autoFocus
            />
          )}

          <Button
            onClick={handleAISubmit}
            disabled={loading || prompt.trim().length < 10}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-8"
          >
            {loading ? 'Setting up...' : 'Create with AI →'}
          </Button>
        </div>
      )}

      {/* Manual mode */}
      {mode === 'manual' && (
        <ResearcherForm
          allChannels={allChannels}
          linkedChannelIds={channelId ? [channelId] : undefined}
          lockedChannelId={channelId}
        />
      )}
    </div>
  );
}
