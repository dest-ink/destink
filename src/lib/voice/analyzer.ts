import { callClaude } from '@/lib/ai/client';
import type { VoiceProfile } from '@/db/schema';

export function buildVoiceAnalysisPrompt(samples: string[]): string {
  const joined = samples
    .map((s, i) => `--- Sample ${i + 1} ---\n${s}`)
    .join('\n\n');

  return `Analyze the writing samples below and extract a voice profile as JSON.

Return ONLY valid JSON matching this exact shape (no explanation, no markdown):
{
  "toneDescriptors": ["direct", "analytical"],
  "sentencePatterns": "Tends toward medium-length declarative sentences...",
  "recurringThemes": ["AI", "startups"],
  "opinionStances": ["Contrarian about remote work"],
  "topicsToAvoid": ["celebrity news"],
  "vocabularyNotes": "Uses technical terms without over-explaining",
  "idealReader": "A technical founder or senior IC"
}

WRITING SAMPLES:
${joined}`;
}

export async function analyzeVoice(
  samples: string[],
  channelId: string,
  voiceProfileId: string
): Promise<VoiceProfile> {
  const prompt = buildVoiceAnalysisPrompt(samples);
  const raw = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: 'You are a writing style analyst. Return only valid JSON, no explanation.',
    prompt,
    maxTokens: 1024,
    audit: {
      operation: 'voice_analysis',
      channelId,
      entityType: 'voice_profile',
      entityId: voiceProfileId,
    },
  });

  try {
    return JSON.parse(raw) as VoiceProfile;
  } catch {
    throw new Error(`Voice analysis returned invalid JSON: ${raw.slice(0, 200)}`);
  }
}
