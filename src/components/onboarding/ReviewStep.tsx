'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export interface OnboardingIntent {
  platform: 'linkedin' | 'substack';
  channelName: string;
  platformId: string | null;
  voice: {
    style: string[];
    audience: string;
    influences: string[];
    avoid: string[];
    summary: string;
  };
  researcher: {
    name: string;
    topics: string[];
    keywords: string[];
    sourceConfig: {
      subreddits: string[];
      substackFeeds: string[];
      searchQueryTemplates: string[];
      excludedDomains: string[];
    };
    shortFormPercent: number;
  };
  schedule: {
    frequency: string;
    reasoning: string;
  };
}

export interface ProvisionResult {
  channelId: string;
  channelName: string;
  platform: string;
  researcherId: string;
  researcherName: string;
  scheduleId: string;
  cronExpression: string;
  voiceProfileId: string;
}

interface ReviewStepProps {
  intent: OnboardingIntent;
  result: ProvisionResult;
}

const FREQUENCY_LABELS: Record<string, string> = {
  twice_daily: 'Twice daily',
  daily: 'Daily at 8am',
  every_other_day: 'Every other day',
  weekly: 'Weekly (Mondays)',
};

export function ReviewStep({ intent, result }: ReviewStepProps) {
  const router = useRouter();

  const handleLaunch = () => {
    router.push(`/research/${result.researcherId}`);
  };

  const handleAddAnother = () => {
    router.refresh();
    window.location.href = '/get-started';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            Your content machine is ready.
          </h2>
          <p className="text-sm text-muted-foreground">
            Everything's been set up. Review below, or jump right in.
          </p>
        </div>

        {/* Channel card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-1 transition-all duration-200 hover:border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Channel</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-6 px-2"
              onClick={() => router.push(`/channels/${result.channelId}`)}
            >
              edit
            </Button>
          </div>
          <p className="text-sm font-medium text-foreground">
            {result.channelName}
          </p>
          <p className="text-xs text-muted-foreground capitalize">
            {result.platform}
          </p>
        </div>

        {/* Voice card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-1 transition-all duration-200 hover:border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Voice</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-6 px-2"
              onClick={() => router.push(`/channels/${result.channelId}`)}
            >
              edit
            </Button>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {intent.voice.summary}
          </p>
          {intent.voice.influences.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Inspired by: {intent.voice.influences.join(', ')}
            </p>
          )}
        </div>

        {/* Research card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-2 transition-all duration-200 hover:border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Research</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-6 px-2"
              onClick={() => router.push(`/research/${result.researcherId}`)}
            >
              edit
            </Button>
          </div>
          <p className="text-sm font-medium text-foreground">
            {intent.researcher.name}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {intent.researcher.topics.map(topic => (
              <span key={topic} className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                {topic}
              </span>
            ))}
          </div>
          {intent.researcher.sourceConfig.subreddits.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Reddit: {intent.researcher.sourceConfig.subreddits.map(s => `r/${s}`).join(', ')}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Schedule: {FREQUENCY_LABELS[intent.schedule.frequency] ?? intent.schedule.frequency}
            {' · '}Auto-draft on · {intent.researcher.shortFormPercent}% short-form
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddAnother}
            className="text-muted-foreground"
          >
            + Add another
          </Button>
          <Button
            onClick={handleLaunch}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 ease-out px-8"
          >
            Start researching →
          </Button>
        </div>
      </div>
    </div>
  );
}
