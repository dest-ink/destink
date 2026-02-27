import { callClaude } from '@/lib/ai/client';
import type { ResearchConfig, ResearchSource, VoiceProfile } from '@/db/schema';

/**
 * Uses Claude to brainstorm content topic ideas based on the channel's research
 * config and voice profile. Returns topics as ResearchSource objects with
 * source: 'brainstorm'.
 */
export async function brainstormTopics(
  config: ResearchConfig,
  voiceProfile: VoiceProfile | null,
  recentTitles: string[],
  channelId: string
): Promise<ResearchSource[]> {
  const recentContext = recentTitles.length > 0
    ? `\n\nRecent posts (avoid repeating):\n${recentTitles.map(t => `- ${t}`).join('\n')}`
    : '';

  const personaContext = voiceProfile
    ? `\n\nWriter persona: ${voiceProfile.toneDescriptors.join(', ')}. Interested in: ${voiceProfile.recurringThemes.join(', ')}.`
    : '';

  const prompt = `Generate 8 interesting topic ideas for a content creator in these areas: ${config.topics.join(', ')}.

Keywords of interest: ${config.keywords.join(', ')}${personaContext}${recentContext}

Return as JSON array:
[{"title": "...", "angle": "...", "whyTimely": "..."}]

Return ONLY the JSON array, no explanation.`;

  const raw = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: 'You are a content strategist. Return only valid JSON.',
    prompt,
    maxTokens: 1024,
    audit: { operation: 'brainstorm', channelId },
  });

  let ideas: { title: string; angle: string; whyTimely: string }[];
  try {
    ideas = JSON.parse(raw) as { title: string; angle: string; whyTimely: string }[];
  } catch {
    throw new Error(`[brainstormTopics] Claude returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  return ideas.map(idea => ({
    url: '',
    title: idea.title,
    summary: `${idea.angle}\n\nWhy timely: ${idea.whyTimely}`,
    source: 'brainstorm' as const,
  }));
}
