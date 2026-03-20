import { db } from '@/db/client';
import { aiModelSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { AiModelSettingsConfig } from '@/db/schema';
import type { ClaudeModel } from './client';

export const DEFAULT_SETTINGS: AiModelSettingsConfig = {
  topicRanking: 'claude-sonnet-4-6',
  draftGeneration: 'claude-opus-4-6',
  voiceAnalysis: 'claude-sonnet-4-6',
  onboarding: 'claude-sonnet-4-6',
  draftEditing: 'claude-sonnet-4-6',
};

export type AiUseCase = keyof AiModelSettingsConfig;

export const USE_CASE_LABELS: Record<AiUseCase, { label: string; description: string }> = {
  topicRanking: {
    label: 'Topic Ranking',
    description: 'Analyzes research sources and ranks the best content topics',
  },
  draftGeneration: {
    label: 'Draft Generation',
    description: 'Writes the actual draft content (hook, body, CTA)',
  },
  voiceAnalysis: {
    label: 'Voice Analysis',
    description: 'Analyzes writing samples to build a voice profile',
  },
  onboarding: {
    label: 'Onboarding',
    description: 'Parses natural language to set up new content machines',
  },
  draftEditing: {
    label: 'Draft Editing',
    description: 'AI chat for editing and refining drafts',
  },
};

/**
 * Load AI model settings for a user, falling back to defaults.
 */
export async function getModelSettings(userId: string): Promise<AiModelSettingsConfig> {
  const [row] = await db.select().from(aiModelSettings).where(eq(aiModelSettings.userId, userId));
  if (!row?.settings) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...row.settings };
}

/**
 * Get the model ID for a specific use case.
 */
export async function getModelForUseCase(userId: string, useCase: AiUseCase): Promise<ClaudeModel> {
  const settings = await getModelSettings(userId);
  return (settings[useCase] ?? DEFAULT_SETTINGS[useCase]) as ClaudeModel;
}
