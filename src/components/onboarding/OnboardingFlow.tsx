'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { PromptStep } from './PromptStep';
import { BuildStep } from './BuildStep';
import { ReviewStep } from './ReviewStep';
import type { OnboardingIntent, ProvisionResult } from './ReviewStep';

type Phase = 'prompt' | 'building' | 'review';

interface OnboardResult {
  intent: OnboardingIntent;
  result: ProvisionResult;
}

export function OnboardingFlow() {
  const [phase, setPhase] = useState<Phase>('prompt');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardResult | null>(null);

  const handleSubmit = async (input: string) => {
    setLoading(true);
    setPhase('building');

    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (err as { error?: string }).error || 'Something went wrong';
        toast.error(msg);
        setPhase('prompt');
        setLoading(false);
        return;
      }

      const result: OnboardResult = await res.json();
      setData(result);

      // Let the build animation play for a minimum duration
      setTimeout(() => {
        setPhase('review');
        setLoading(false);
      }, 4500);
    } catch {
      toast.error('Failed to connect. Please try again.');
      setPhase('prompt');
      setLoading(false);
    }
  };

  return (
    <div className="h-full">
      {phase === 'prompt' && (
        <PromptStep onSubmit={handleSubmit} loading={loading} />
      )}
      {phase === 'building' && (
        <BuildStep voiceSummary={data?.intent.voice.summary} />
      )}
      {phase === 'review' && data && (
        <ReviewStep intent={data.intent} result={data.result} />
      )}
    </div>
  );
}
