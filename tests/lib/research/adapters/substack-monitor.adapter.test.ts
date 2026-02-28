import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResearchConfig } from '@/db/schema';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';

vi.mock('@/lib/research/substack-monitor', () => ({
  monitorSubstackFeeds: vi.fn(),
}));

import { monitorSubstackFeeds } from '@/lib/research/substack-monitor';
import substackMonitorAdapter from '@/lib/research/adapters/substack-monitor.adapter';

const mockConfig: ResearchConfig = {
  topics: ['content creation'],
  keywords: ['newsletter', 'creator'],
  subreddits: [],
  substackFeeds: ['lenny.substack.com', 'stratechery.com/feed'],
  searchQueryTemplates: [],
  excludedDomains: [],
  contentTypeMix: { note: 70, article: 30 },
  maxDraftsPerRun: 3,
  scheduleHours: 6,
};

describe('substackMonitorAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates search() to monitorSubstackFeeds with the same config', async () => {
    const mockSources = [{ url: 'https://lenny.substack.com/p/post', title: 'Lenny post', summary: 'Summary', source: 'substack' as const }];
    vi.mocked(monitorSubstackFeeds).mockResolvedValue(mockSources);

    const result = await substackMonitorAdapter.search(mockConfig);

    expect(monitorSubstackFeeds).toHaveBeenCalledWith(mockConfig);
    expect(result).toBe(mockSources);
  });

  it('has correct metadata — id', () => {
    expect(substackMonitorAdapter.id).toBe('substack-monitor');
  });

  it('has correct metadata — name', () => {
    expect(substackMonitorAdapter.name).toBe('substack-monitor');
  });

  it('has correct metadata — apiVersion', () => {
    expect(substackMonitorAdapter.apiVersion).toBe(PROVIDER_API_VERSION);
  });

  it('has a displayName and description', () => {
    expect(typeof substackMonitorAdapter.displayName).toBe('string');
    expect(substackMonitorAdapter.displayName.length).toBeGreaterThan(0);
    expect(typeof substackMonitorAdapter.description).toBe('string');
    expect(substackMonitorAdapter.description.length).toBeGreaterThan(0);
  });
});
