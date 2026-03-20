# Magic Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-page, 21-input channel+researcher+voice creation flow with a single conversational input that uses AI to build everything in one shot.

**Architecture:** A single `POST /api/onboard` endpoint receives natural language, calls Claude to extract structured config (platform, voice, topics, sources, schedule), then creates channel + voice profile + researcher + automation schedule + links in one DB transaction. A new `OnboardingFlow` client component renders the 3-step UX: (1) single textarea prompt, (2) animated build sequence, (3) review cards with inline edit.

**Tech Stack:** Next.js App Router, Claude API via existing `callClaude()`, Drizzle ORM transactions, Tailwind CSS, shadcn/ui primitives, framer-motion for build animation.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/onboarding/parse-intent.ts` | Claude prompt + JSON schema to extract structured onboarding config from natural language |
| Create | `src/lib/onboarding/provision.ts` | DB transaction: create channel, voice profile, researcher, schedule, links |
| Create | `src/app/api/onboard/route.ts` | API route: auth guard, call parse-intent, call provision, return result |
| Create | `src/app/(app)/get-started/page.tsx` | Server page wrapper |
| Create | `src/components/onboarding/OnboardingFlow.tsx` | Top-level client component: manages 3 phases (prompt → build → review) |
| Create | `src/components/onboarding/PromptStep.tsx` | Phase 1: single textarea + submit |
| Create | `src/components/onboarding/BuildStep.tsx` | Phase 2: animated progress with checkmarks |
| Create | `src/components/onboarding/ReviewStep.tsx` | Phase 3: editable summary cards + launch button |
| Modify | `src/components/layout/SideNav.tsx` | Add "Get Started" / "+" entry point in nav |

---

## Task 1: AI Intent Parser

**Files:**
- Create: `src/lib/onboarding/parse-intent.ts`

- [ ] **Step 1: Create the intent parser module**

```typescript
// src/lib/onboarding/parse-intent.ts
import { callClaude } from '@/lib/ai/client';
import type { VoiceProfile, ResearchSourceConfig } from '@/db/schema';

export interface OnboardingIntent {
  platform: 'linkedin' | 'substack';
  channelName: string;
  platformId: string | null;
  voice: {
    style: string[];           // e.g. ["direct", "analytical", "warm"]
    audience: string;          // e.g. "technical founders at growth-stage startups"
    influences: string[];      // e.g. ["Paul Graham", "Packy McCormick"]
    avoid: string[];           // e.g. ["cryptocurrency", "politics"]
    summary: string;           // 1-2 sentence voice description for review card
  };
  researcher: {
    name: string;              // e.g. "AI & Developer Tools"
    topics: string[];
    keywords: string[];
    sourceConfig: ResearchSourceConfig;
    shortFormPercent: number;
  };
  schedule: {
    frequency: 'daily' | 'twice_daily' | 'every_other_day' | 'weekly';
    reasoning: string;         // why this frequency was chosen
  };
}

const SYSTEM_PROMPT = `You are an onboarding assistant for Destink, a content automation platform.
The user will describe what they want to publish about, where, and optionally their writing style.
Extract structured configuration from their natural language input.

Rules:
- If the user mentions "LinkedIn", set platform to "linkedin". If they mention "Substack" or "newsletter", set platform to "substack". Default to "linkedin" if unclear.
- For channelName, create a concise descriptive name like "LinkedIn — AI & Startups" or "Substack — Tech Leadership".
- For platformId, extract a handle/subdomain if they mention one (e.g., "my handle is @johndoe" → "johndoe"). Otherwise null.
- For voice.style, extract 2-4 adjectives describing their writing tone.
- For voice.audience, infer who they're writing for based on context.
- For voice.influences, extract any writers/publications they mention as style references.
- For voice.avoid, extract topics they want to stay away from. Default to empty array.
- For voice.summary, write a 1-2 sentence plain-English description of the voice.
- For researcher.name, create a concise label for the research area.
- For researcher.topics, extract 2-5 core topics.
- For researcher.keywords, expand topics into 5-10 specific keywords/terms an expert would search for.
- For researcher.sourceConfig.subreddits, suggest 2-4 relevant subreddits (without r/ prefix).
- For researcher.sourceConfig.substackFeeds, suggest 1-3 relevant Substack publications if the topics are well-known.
- For researcher.sourceConfig.searchQueryTemplates, generate 2-3 search templates using {topic} placeholder.
- For researcher.sourceConfig.excludedDomains, default to empty array.
- For researcher.shortFormPercent, recommend based on platform: LinkedIn → 70 (more short posts), Substack → 30 (more long articles).
- For schedule.frequency, recommend based on platform and content volume: LinkedIn → "daily", Substack → "every_other_day".
- For schedule.reasoning, explain why you chose this frequency in one sentence.

Respond with ONLY valid JSON matching the schema. No markdown, no explanation.`;

export async function parseOnboardingIntent(userInput: string): Promise<OnboardingIntent> {
  const raw = await callClaude({
    model: 'claude-sonnet-4-6',
    system: SYSTEM_PROMPT,
    prompt: userInput,
    maxTokens: 2048,
    audit: {
      operation: 'onboarding-parse-intent',
    },
  });

  const parsed = JSON.parse(raw) as OnboardingIntent;

  // Validate required fields
  if (!parsed.platform || !parsed.channelName || !parsed.voice || !parsed.researcher) {
    throw new Error('AI response missing required fields');
  }

  // Normalize platform
  if (!['linkedin', 'substack'].includes(parsed.platform)) {
    parsed.platform = 'linkedin';
  }

  // Ensure arrays exist
  parsed.voice.style = parsed.voice.style ?? [];
  parsed.voice.influences = parsed.voice.influences ?? [];
  parsed.voice.avoid = parsed.voice.avoid ?? [];
  parsed.researcher.topics = parsed.researcher.topics ?? [];
  parsed.researcher.keywords = parsed.researcher.keywords ?? [];
  parsed.researcher.sourceConfig = {
    subreddits: parsed.researcher.sourceConfig?.subreddits ?? [],
    substackFeeds: parsed.researcher.sourceConfig?.substackFeeds ?? [],
    searchQueryTemplates: parsed.researcher.sourceConfig?.searchQueryTemplates ?? [],
    excludedDomains: parsed.researcher.sourceConfig?.excludedDomains ?? [],
  };

  return parsed;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/onboarding/parse-intent.ts
git commit -m "feat(onboarding): add AI intent parser for natural language onboarding"
```

---

## Task 2: Database Provisioning

**Files:**
- Create: `src/lib/onboarding/provision.ts`

- [ ] **Step 1: Create the provisioning module**

```typescript
// src/lib/onboarding/provision.ts
import { db } from '@/db/client';
import {
  channels,
  voiceProfiles,
  researchers,
  researcherChannels,
  automationSchedules,
} from '@/db/schema';
import { assembleAndSavePersonaPrompt } from '@/lib/voice/assembler';
import { getNextRunAt } from '@/lib/cron-utils';
import type { OnboardingIntent } from './parse-intent';

const FREQUENCY_TO_CRON: Record<string, string> = {
  twice_daily: '0 8,20 * * *',
  daily: '0 8 * * *',
  every_other_day: '0 8 */2 * *',
  weekly: '0 8 * * 1',
};

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

export async function provisionFromIntent(intent: OnboardingIntent): Promise<ProvisionResult> {
  // Build voice rawInput from the intent (same format as wizard)
  const voiceRawInput = [
    `Describe your writing style in 3 words: ${intent.voice.style.join(', ')}`,
    intent.voice.influences.length > 0
      ? `Which writers do you admire and why: ${intent.voice.influences.join(', ')}`
      : null,
    intent.voice.avoid.length > 0
      ? `What topics do you want to avoid: ${intent.voice.avoid.join(', ')}`
      : null,
    `Describe your ideal reader: ${intent.voice.audience}`,
  ].filter(Boolean).join('\n');

  const cronExpression = FREQUENCY_TO_CRON[intent.schedule.frequency] ?? FREQUENCY_TO_CRON.daily;
  const nextRunAt = getNextRunAt(cronExpression) ?? new Date();

  // Single transaction: create everything
  const result = await db.transaction(async (tx) => {
    // 1. Create channel
    const [channel] = await tx.insert(channels).values({
      name: intent.channelName,
      platform: intent.platform,
      platformId: intent.platformId,
    }).returning();

    // 2. Create voice profile
    const [voiceProfile] = await tx.insert(voiceProfiles).values({
      channelId: channel.id,
      method: 'wizard',
      rawInput: voiceRawInput,
      extractedProfile: null,
    }).returning();

    // 3. Create researcher
    const [researcher] = await tx.insert(researchers).values({
      name: intent.researcher.name,
      topics: intent.researcher.topics,
      keywords: intent.researcher.keywords,
      sourceConfig: intent.researcher.sourceConfig,
      maxDraftsPerRun: 3,
      shortFormPercent: intent.researcher.shortFormPercent,
      autoDraft: true,
    }).returning();

    // 4. Link researcher to channel
    await tx.insert(researcherChannels).values({
      researcherId: researcher.id,
      channelId: channel.id,
    });

    // 5. Create automation schedule
    const [schedule] = await tx.insert(automationSchedules).values({
      researcherId: researcher.id,
      name: 'Auto-created schedule',
      cronExpression,
      enabled: true,
      nextRunAt,
      autoDraft: true,
    }).returning();

    return {
      channelId: channel.id,
      channelName: channel.name,
      platform: channel.platform,
      researcherId: researcher.id,
      researcherName: researcher.name,
      scheduleId: schedule.id,
      cronExpression,
      voiceProfileId: voiceProfile.id,
    };
  });

  // Assemble persona prompt outside transaction (calls Claude internally for some methods)
  await assembleAndSavePersonaPrompt(result.channelId);

  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/onboarding/provision.ts
git commit -m "feat(onboarding): add DB provisioning with single transaction"
```

---

## Task 3: API Route

**Files:**
- Create: `src/app/api/onboard/route.ts`

- [ ] **Step 1: Create the onboard API route**

```typescript
// src/app/api/onboard/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { parseOnboardingIntent } from '@/lib/onboarding/parse-intent';
import { provisionFromIntent } from '@/lib/onboarding/provision';

export const POST = auth(function POST(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    let body: { input: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.input || typeof body.input !== 'string' || body.input.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please describe what you want to publish about (at least a sentence).' },
        { status: 400 },
      );
    }

    try {
      // Phase 1: AI parses the intent
      const intent = await parseOnboardingIntent(body.input.trim());

      // Phase 2: Provision everything in DB
      const result = await provisionFromIntent(intent);

      return NextResponse.json({ intent, result }, { status: 201 });
    } catch (err) {
      const { message, status } = apiError('set up your content machine', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/onboard/route.ts
git commit -m "feat(onboarding): add POST /api/onboard route"
```

---

## Task 4: PromptStep Component (Phase 1 UI)

**Files:**
- Create: `src/components/onboarding/PromptStep.tsx`

- [ ] **Step 1: Create the prompt step**

This is the "one question" screen — a single textarea asking what the user wants to publish about. Design per UI/UX Pro Max guidelines: progressive disclosure, visible label, min 44px touch target, 150-300ms transitions, ease-out easing.

```tsx
// src/components/onboarding/PromptStep.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface PromptStepProps {
  onSubmit: (input: string) => void;
  loading: boolean;
}

export function PromptStep({ onSubmit, loading }: PromptStepProps) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (input.trim().length >= 10) {
      onSubmit(input.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="w-full max-w-xl space-y-6">
        {/* Headline */}
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            What do you want to publish about?
          </h1>
          <p className="text-sm text-muted-foreground">
            Tell us the topic, platform, and your style. We'll set everything up.
          </p>
        </div>

        {/* Input */}
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="I write about AI and developer tools on LinkedIn. My style is direct and analytical, like Paul Graham meets Packy McCormick."
          className="min-h-[140px] bg-card border-border resize-none text-base leading-relaxed"
          autoFocus
          disabled={loading}
          aria-label="Describe what you want to publish"
        />

        {/* Hint */}
        <p className="text-xs text-muted-foreground text-center">
          Mention your platform (LinkedIn, Substack), topics, and any style influences.
        </p>

        {/* Submit */}
        <div className="flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={loading || input.trim().length < 10}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 ease-out px-8"
          >
            {loading ? 'Setting up...' : "Let's go →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/PromptStep.tsx
git commit -m "feat(onboarding): add PromptStep component"
```

---

## Task 5: BuildStep Component (Phase 2 UI)

**Files:**
- Create: `src/components/onboarding/BuildStep.tsx`

- [ ] **Step 1: Create the animated build step**

Animated progress with staggered checkmarks. Per UI/UX Pro Max: stagger 30-50ms per item, entrance ease-out, 150-300ms duration, spring-physics feel.

```tsx
// src/components/onboarding/BuildStep.tsx
'use client';
import { useEffect, useState } from 'react';

const BUILD_STEPS = [
  { label: 'Understanding your intent', icon: '◈' },
  { label: 'Creating your channel', icon: '◆' },
  { label: 'Building your voice profile', icon: '◇' },
  { label: 'Configuring researcher', icon: '◉' },
  { label: 'Setting up automation', icon: '◎' },
];

interface BuildStepProps {
  voiceSummary?: string;
}

export function BuildStep({ voiceSummary }: BuildStepProps) {
  const [completedCount, setCompletedCount] = useState(0);

  // Animate steps completing one by one
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    BUILD_STEPS.forEach((_, i) => {
      timers.push(
        setTimeout(() => setCompletedCount(i + 1), 600 + i * 800),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            Setting up your content machine...
          </h2>
        </div>

        {/* Step list */}
        <div className="space-y-3">
          {BUILD_STEPS.map((step, i) => {
            const done = i < completedCount;
            const active = i === completedCount;
            return (
              <div
                key={step.label}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-300 ease-out ${
                  done
                    ? 'border-primary/30 bg-primary/5'
                    : active
                      ? 'border-border bg-card'
                      : 'border-transparent bg-transparent opacity-40'
                }`}
              >
                {/* Status indicator */}
                <span className="w-5 h-5 flex items-center justify-center text-xs shrink-0">
                  {done ? (
                    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-primary">
                      <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : active ? (
                    <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  )}
                </span>

                {/* Label */}
                <span className={`text-sm ${
                  done ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Voice preview - appears after step 3 */}
        {completedCount >= 3 && voiceSummary && (
          <div className="rounded-lg border border-border bg-card p-4 transition-all duration-300 ease-out">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Voice Preview</p>
            <p className="text-sm text-foreground leading-relaxed italic">
              "{voiceSummary}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/BuildStep.tsx
git commit -m "feat(onboarding): add BuildStep animated progress component"
```

---

## Task 6: ReviewStep Component (Phase 3 UI)

**Files:**
- Create: `src/components/onboarding/ReviewStep.tsx`

- [ ] **Step 1: Create the review step with editable cards**

Summary cards showing what was created. Each has an [edit] toggle for inline editing. Per UI/UX Pro Max: card hover states (transform, not layout shift), progressive disclosure, success feedback.

```tsx
// src/components/onboarding/ReviewStep.tsx
'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { OnboardingIntent } from '@/lib/onboarding/parse-intent';
import type { ProvisionResult } from '@/lib/onboarding/provision';

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
        {/* Header */}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/ReviewStep.tsx
git commit -m "feat(onboarding): add ReviewStep with summary cards"
```

---

## Task 7: OnboardingFlow Orchestrator + Page

**Files:**
- Create: `src/components/onboarding/OnboardingFlow.tsx`
- Create: `src/app/(app)/get-started/page.tsx`

- [ ] **Step 1: Create the orchestrator component**

Manages 3 phases: prompt → build → review. Calls the API, passes data between steps.

```tsx
// src/components/onboarding/OnboardingFlow.tsx
'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { PromptStep } from './PromptStep';
import { BuildStep } from './BuildStep';
import { ReviewStep } from './ReviewStep';
import type { OnboardingIntent } from '@/lib/onboarding/parse-intent';
import type { ProvisionResult } from '@/lib/onboarding/provision';

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
```

- [ ] **Step 2: Create the page**

```tsx
// src/app/(app)/get-started/page.tsx
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';

export default function GetStartedPage() {
  return <OnboardingFlow />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/OnboardingFlow.tsx src/app/\(app\)/get-started/page.tsx
git commit -m "feat(onboarding): add OnboardingFlow orchestrator and page"
```

---

## Task 8: Add Nav Entry Point

**Files:**
- Modify: `src/components/layout/SideNav.tsx`

- [ ] **Step 1: Add a "Get Started" / "+" button to the SideNav**

Add a prominent "+" button at the top of the nav links that routes to `/get-started`. Should be visually distinct from regular nav items — primary colored, acts as the main CTA for creating new content machines.

Read `src/components/layout/SideNav.tsx`, then add a new nav entry before the existing links:

```tsx
// Add to the nav links section, BEFORE the existing links array map:
<Link
  href="/get-started"
  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
    pathname === '/get-started'
      ? 'bg-primary/15 text-primary border-l-2 border-primary'
      : 'bg-primary/5 text-primary hover:bg-primary/10 border-l-2 border-transparent'
  }`}
>
  <span className="text-base leading-none">+</span>
  <span>New</span>
</Link>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/SideNav.tsx
git commit -m "feat(onboarding): add New button to SideNav linking to /get-started"
```

---

## Task 9: Smoke Test & Polish

- [ ] **Step 1: Verify the full flow works end-to-end**

Run: `pnpm dev`

1. Navigate to `/get-started`
2. Enter: "I write about AI and developer tools on LinkedIn. My style is direct and analytical, like Paul Graham."
3. Verify: build animation plays, then review cards appear with correct data
4. Verify: clicking "Start researching" navigates to the researcher detail page
5. Verify: channel, voice profile, researcher, automation schedule all exist in the DB

- [ ] **Step 2: Verify the new nav entry works**

1. Check SideNav shows the "+" / "New" button
2. Click it, verify navigation to `/get-started`
3. Active state highlights correctly

- [ ] **Step 3: Final commit if any polish was needed**

```bash
git add -A
git commit -m "fix(onboarding): polish from smoke test"
```
