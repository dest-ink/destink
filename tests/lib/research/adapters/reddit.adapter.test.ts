import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResearchConfig } from '@/db/schema';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';

vi.mock('@/lib/research/reddit', () => ({
  searchReddit: vi.fn(),
}));

import { searchReddit } from '@/lib/research/reddit';
import redditAdapter from '@/lib/research/adapters/reddit.adapter';

const mockConfig: ResearchConfig = {
  topics: ['startups'],
  keywords: ['founder', 'SaaS'],
  subreddits: ['r/startups', 'r/entrepreneur'],
  substackFeeds: [],
  searchQueryTemplates: [],
  excludedDomains: [],
  contentTypeMix: { note: 70, article: 30 },
  maxDraftsPerRun: 3,
  scheduleHours: 6,
};

describe('redditAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates search() to searchReddit with the same config', async () => {
    const mockSources = [{ url: 'https://reddit.com/r/startups/1', title: 'Hot post', summary: 'Summary', source: 'reddit' as const }];
    vi.mocked(searchReddit).mockResolvedValue(mockSources);

    const result = await redditAdapter.search(mockConfig);

    expect(searchReddit).toHaveBeenCalledWith(mockConfig);
    expect(result).toBe(mockSources);
  });

  it('has correct metadata — id', () => {
    expect(redditAdapter.id).toBe('reddit');
  });

  it('has correct metadata — name', () => {
    expect(redditAdapter.name).toBe('reddit');
  });

  it('has correct metadata — apiVersion', () => {
    expect(redditAdapter.apiVersion).toBe(PROVIDER_API_VERSION);
  });

  it('has a displayName and description', () => {
    expect(typeof redditAdapter.displayName).toBe('string');
    expect(redditAdapter.displayName.length).toBeGreaterThan(0);
    expect(typeof redditAdapter.description).toBe('string');
    expect(redditAdapter.description.length).toBeGreaterThan(0);
  });
});
