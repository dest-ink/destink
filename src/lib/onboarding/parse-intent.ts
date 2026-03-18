import { callClaude } from '@/lib/ai/client';
import type { ResearchSourceConfig } from '@/db/schema';

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
    sourceConfig: ResearchSourceConfig;
    shortFormPercent: number;
  };
  schedule: {
    frequency: 'daily' | 'twice_daily' | 'every_other_day' | 'weekly';
    reasoning: string;
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

  if (!parsed.platform || !parsed.channelName || !parsed.voice || !parsed.researcher) {
    throw new Error('AI response missing required fields');
  }

  if (!['linkedin', 'substack'].includes(parsed.platform)) {
    parsed.platform = 'linkedin';
  }

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
