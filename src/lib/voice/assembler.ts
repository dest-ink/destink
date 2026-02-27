import { db } from '@/db/client';
import { voiceProfiles, channels } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { VoiceProfile } from '@/db/schema';

export interface WizardAnswer {
  question: string;
  answer: string;
}

/**
 * Assembles a persona description from wizard Q&A answers (no AI needed).
 * Returns only the characteristics body — framing is added by the assembler
 * so all profile types get a consistent outer wrapper.
 */
export function buildPersonaFromWizard(answers: WizardAnswer[]): string {
  const lines = answers
    .filter(a => a.answer.trim())
    .map(a => `${a.question}: ${a.answer}`);
  if (lines.length === 0) {
    return '';
  }
  return lines.join('\n');
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
      // rawInput is the plain Q&A body from buildPersonaFromWizard (no outer framing)
      parts.push(profile.rawInput);
    } else if (profile.extractedProfile) {
      // Null guards on every field — Claude may omit a field on a bad run
      const vp = profile.extractedProfile as VoiceProfile;
      parts.push([
        `TONE: ${(vp.toneDescriptors ?? []).join(', ')}`,
        `SENTENCE STYLE: ${vp.sentencePatterns ?? ''}`,
        `RECURRING THEMES: ${(vp.recurringThemes ?? []).join(', ')}`,
        `OPINIONS: ${(vp.opinionStances ?? []).join('; ')}`,
        `AVOID: ${(vp.topicsToAvoid ?? []).join(', ')}`,
        `VOCABULARY: ${vp.vocabularyNotes ?? ''}`,
        `IDEAL READER: ${vp.idealReader ?? ''}`,
      ].filter(line => !line.endsWith(': ')).join('\n'));
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
