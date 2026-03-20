import { callClaude } from '@/lib/ai/client';
import { getModelForUseCase } from '@/lib/ai/model-settings';
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
  voiceProfileId: string,
  userId: string
): Promise<VoiceProfile> {
  const prompt = buildVoiceAnalysisPrompt(samples);
  const model = await getModelForUseCase(userId, 'voiceAnalysis');
  const raw = await callClaude({
    model,
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Voice analysis returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  // Structural guard — wrong-shape JSON fails loudly rather than propagating a
  // mistyped object that crashes downstream in the assembler.
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>).toneDescriptors)
  ) {
    throw new Error(`Voice analysis returned unexpected JSON shape: ${raw.slice(0, 200)}`);
  }

  return parsed as VoiceProfile;
}
