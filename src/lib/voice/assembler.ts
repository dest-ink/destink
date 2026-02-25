import { db } from '@/db/client';
import { voiceProfiles, channels } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { VoiceProfile } from '@/db/schema';

export interface WizardAnswer {
  question: string;
  answer: string;
}

/**
 * Assembles a persona prompt from wizard Q&A answers (no AI needed).
 */
export function buildPersonaFromWizard(answers: WizardAnswer[]): string {
  if (answers.length === 0) {
    return 'Write in a clear, direct, and engaging voice.';
  }
  const lines = answers
    .filter(a => a.answer.trim())
    .map(a => `${a.question}: ${a.answer}`);
  return `You are writing as a person with the following characteristics:\n\n${lines.join('\n')}\n\nWrite authentically in this voice.`;
}

/**
 * Assembles the full persona_prompt for a channel from all its voice profiles
 * and persists it to the channel row.
 */
export async function assembleAndSavePersonaPrompt(channelId: string): Promise<string> {
  const profiles = await db.select()
    .from(voiceProfiles)
    .where(eq(voiceProfiles.channelId, channelId));

  const parts: string[] = [];

  for (const profile of profiles) {
    if (profile.method === 'wizard' && profile.rawInput) {
      parts.push(profile.rawInput);
    } else if (profile.extractedProfile) {
      const vp = profile.extractedProfile as VoiceProfile;
      parts.push([
        `TONE: ${vp.toneDescriptors.join(', ')}`,
        `SENTENCE STYLE: ${vp.sentencePatterns}`,
        `RECURRING THEMES: ${vp.recurringThemes.join(', ')}`,
        `OPINIONS: ${vp.opinionStances.join('; ')}`,
        `AVOID: ${vp.topicsToAvoid.join(', ')}`,
        `VOCABULARY: ${vp.vocabularyNotes}`,
        `IDEAL READER: ${vp.idealReader}`,
      ].join('\n'));
    }
  }

  const personaPrompt = parts.length > 0
    ? `You are a ghostwriter for a specific person. Write in their voice exactly.\n\n${parts.join('\n\n---\n\n')}`
    : 'Write in a clear, direct, and engaging voice.';

  await db.update(channels)
    .set({ personaPrompt, updatedAt: new Date() })
    .where(eq(channels.id, channelId));

  return personaPrompt;
}
