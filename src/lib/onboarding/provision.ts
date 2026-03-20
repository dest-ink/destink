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

export async function provisionFromIntent(intent: OnboardingIntent, userId: string): Promise<ProvisionResult> {
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

  const result = await db.transaction(async (tx) => {
    const [channel] = await tx.insert(channels).values({
      userId,
      name: intent.channelName,
      platform: intent.platform,
      platformId: intent.platformId,
    }).returning();

    const [voiceProfile] = await tx.insert(voiceProfiles).values({
      channelId: channel.id,
      method: 'wizard',
      rawInput: voiceRawInput,
      extractedProfile: null,
    }).returning();

    const [researcher] = await tx.insert(researchers).values({
      userId,
      name: intent.researcher.name,
      topics: intent.researcher.topics,
      keywords: intent.researcher.keywords,
      sourceConfig: intent.researcher.sourceConfig,
      maxDraftsPerRun: 3,
      shortFormPercent: intent.researcher.shortFormPercent,
      autoDraft: true,
    }).returning();

    await tx.insert(researcherChannels).values({
      researcherId: researcher.id,
      channelId: channel.id,
    });

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

  await assembleAndSavePersonaPrompt(result.channelId);

  return result;
}
