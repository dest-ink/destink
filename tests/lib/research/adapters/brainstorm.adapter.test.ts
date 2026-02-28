import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResearchConfig, VoiceProfile } from '@/db/schema';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';

vi.mock('@/lib/research/brainstorm', () => ({
  brainstormTopics: vi.fn(),
}));

import { brainstormTopics } from '@/lib/research/brainstorm';
import brainstormAdapter from '@/lib/research/adapters/brainstorm.adapter';

const mockVoiceProfile: VoiceProfile = {
  toneDescriptors: ['thoughtful', 'direct'],
  sentencePatterns: 'Short punchy sentences.',
  recurringThemes: ['AI', 'productivity'],
  opinionStances: ['AI will transform work'],
  topicsToAvoid: ['politics'],
  vocabularyNotes: 'Avoid jargon',
  idealReader: 'Tech-savvy founders',
};

const baseConfig: ResearchConfig = {
  topics: ['AI agents'],
  keywords: ['LLM', 'automation'],
  subreddits: [],
  substackFeeds: [],
  searchQueryTemplates: [],
  excludedDomains: [],
  contentTypeMix: { note: 70, article: 30 },
  maxDraftsPerRun: 3,
  scheduleHours: 6,
};

const configWithContext: ResearchConfig = {
  ...baseConfig,
  channelId: 'channel-abc-123',
  voiceProfile: mockVoiceProfile,
  recentTitles: ['Post about AI', 'Startup lessons'],
};

const configWithoutChannelId: ResearchConfig = {
  ...baseConfig,
  voiceProfile: mockVoiceProfile,
  recentTitles: ['Some post'],
  // channelId is intentionally absent
};

describe('brainstormAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates search() to brainstormTopics with correctly mapped arguments', async () => {
    const mockSources = [{ url: '', title: 'AI trends', summary: 'An angle\n\nWhy timely: now', source: 'brainstorm' as const }];
    vi.mocked(brainstormTopics).mockResolvedValue(mockSources);

    const result = await brainstormAdapter.search(configWithContext);

    expect(brainstormTopics).toHaveBeenCalledWith(
      configWithContext,
      mockVoiceProfile,
      ['Post about AI', 'Startup lessons'],
      'channel-abc-123',
    );
    expect(result).toBe(mockSources);
  });

  it('returns empty array when channelId is missing', async () => {
    const result = await brainstormAdapter.search(configWithoutChannelId);

    expect(brainstormTopics).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('uses null for voiceProfile when not provided in config', async () => {
    const configNoVoice: ResearchConfig = {
      ...baseConfig,
      channelId: 'channel-xyz',
      recentTitles: [],
    };
    vi.mocked(brainstormTopics).mockResolvedValue([]);

    await brainstormAdapter.search(configNoVoice);

    expect(brainstormTopics).toHaveBeenCalledWith(
      configNoVoice,
      null,
      [],
      'channel-xyz',
    );
  });

  it('uses empty array for recentTitles when not provided in config', async () => {
    const configNoTitles: ResearchConfig = {
      ...baseConfig,
      channelId: 'channel-xyz',
      voiceProfile: mockVoiceProfile,
    };
    vi.mocked(brainstormTopics).mockResolvedValue([]);

    await brainstormAdapter.search(configNoTitles);

    expect(brainstormTopics).toHaveBeenCalledWith(
      configNoTitles,
      mockVoiceProfile,
      [],
      'channel-xyz',
    );
  });

  it('has correct metadata — id', () => {
    expect(brainstormAdapter.id).toBe('brainstorm');
  });

  it('has correct metadata — name', () => {
    expect(brainstormAdapter.name).toBe('brainstorm');
  });

  it('has correct metadata — apiVersion', () => {
    expect(brainstormAdapter.apiVersion).toBe(PROVIDER_API_VERSION);
  });

  it('has a displayName and description', () => {
    expect(typeof brainstormAdapter.displayName).toBe('string');
    expect(brainstormAdapter.displayName.length).toBeGreaterThan(0);
    expect(typeof brainstormAdapter.description).toBe('string');
    expect(brainstormAdapter.description.length).toBeGreaterThan(0);
  });
});
