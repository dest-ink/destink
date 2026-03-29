'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { PromptStep } from './PromptStep';
import { PlatformStep } from './PlatformStep';
import { BuildStep } from './BuildStep';
import { ReviewStep } from './ReviewStep';
import type { OnboardingIntent, ProvisionResult } from './ReviewStep';

type Phase = 'prompt' | 'platform' | 'building' | 'review';

interface OnboardResult {
  intent: OnboardingIntent;
  result: ProvisionResult;
}

const STORAGE_KEY = 'destink-onboard';
const REVIEW_SUB_PHASES = ['credentials', 'ready', 'researching', 'topics', 'generating', 'done'];

function getInitialPhaseAndData(): { phase: Phase; data: OnboardResult | null } {
  if (typeof window === 'undefined') return { phase: 'prompt', data: null };

  const hash = window.location.hash.replace('#', '');
  const stored = sessionStorage.getItem(STORAGE_KEY);
  const parsed: OnboardResult | null = stored ? JSON.parse(stored) : null;

  // If hash is a review sub-phase or 'review', and we have stored data, restore to review
  if ((hash === 'review' || REVIEW_SUB_PHASES.includes(hash)) && parsed) {
    return { phase: 'review', data: parsed };
  }

  // 'building' is transient — fall back to prompt
  if (hash === 'building') {
    window.location.hash = 'prompt';
    return { phase: 'prompt', data: null };
  }

  // Valid onboarding phase (prompt or platform)
  if (hash === 'platform') return { phase: 'platform', data: null };

  // Default to prompt for anything else
  return { phase: 'prompt', data: null };
}

const PLATFORM_KEYWORDS = ['linkedin', 'substack', 'newsletter'];

function mentionsPlatform(input: string): boolean {
  const lower = input.toLowerCase();
  return PLATFORM_KEYWORDS.some(k => lower.includes(k));
}

export function OnboardingFlow() {
  const [mounted, setMounted] = useState(false);
  const [initial] = useState(getInitialPhaseAndData);
  const [phase, setPhaseRaw] = useState<Phase>(initial.phase);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardResult | null>(initial.data);
  const [pendingInput, setPendingInput] = useState('');

  // Only render after client-side hydration to prevent flash
  useEffect(() => setMounted(true), []);

  // Wrap setPhase to also update the hash
  const setPhase = useCallback((p: Phase | ((prev: Phase) => Phase)) => {
    setPhaseRaw(prev => {
      const next = typeof p === 'function' ? p(prev) : p;
      // Only update hash for non-review phases; ReviewStep manages its own hash
      if (next !== 'review') {
        window.location.hash = next;
      }
      return next;
    });
  }, []);

  // Set initial hash on mount
  useEffect(() => {
    if (phase !== 'review') {
      window.location.hash = phase;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitToApi = async (input: string) => {
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
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));

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

  const handlePromptSubmit = (input: string) => {
    if (mentionsPlatform(input)) {
      submitToApi(input);
    } else {
      setPendingInput(input);
      setPhase('platform');
    }
  };

  const handlePlatformSelect = (platform: string) => {
    const enriched = `${pendingInput}\n\nPlatform: ${platform}`;
    submitToApi(enriched);
  };

  if (!mounted) return <div className="h-full" />;

  return (
    <div className="h-full">
      {phase === 'prompt' && (
        <PromptStep onSubmit={handlePromptSubmit} loading={loading} />
      )}
      {phase === 'platform' && (
        <PlatformStep onSelect={handlePlatformSelect} />
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
