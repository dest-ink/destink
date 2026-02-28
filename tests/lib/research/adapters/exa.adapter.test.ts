import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResearchConfig } from '@/db/schema';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';

vi.mock('@/lib/research/exa', () => ({
  searchExa: vi.fn(),
}));

import { searchExa } from '@/lib/research/exa';
import exaAdapter from '@/lib/research/adapters/exa.adapter';

const mockConfig: ResearchConfig = {
  topics: ['AI agents'],
  keywords: ['LLM', 'founder'],
  subreddits: [],
  substackFeeds: [],
  searchQueryTemplates: [],
  excludedDomains: [],
  contentTypeMix: { note: 70, article: 30 },
  maxDraftsPerRun: 3,
  scheduleHours: 6,
};

describe('exaAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates search() to searchExa with the same config', async () => {
    const mockSources = [{ url: 'https://example.com', title: 'Test', summary: 'Summary', source: 'exa' as const }];
    vi.mocked(searchExa).mockResolvedValue(mockSources);

    const result = await exaAdapter.search(mockConfig);

    expect(searchExa).toHaveBeenCalledWith(mockConfig);
    expect(result).toBe(mockSources);
  });

  it('has correct metadata — id', () => {
    expect(exaAdapter.id).toBe('exa');
  });

  it('has correct metadata — name', () => {
    expect(exaAdapter.name).toBe('exa');
  });

  it('has correct metadata — apiVersion', () => {
    expect(exaAdapter.apiVersion).toBe(PROVIDER_API_VERSION);
  });

  it('has a displayName and description', () => {
    expect(typeof exaAdapter.displayName).toBe('string');
    expect(exaAdapter.displayName.length).toBeGreaterThan(0);
    expect(typeof exaAdapter.description).toBe('string');
    expect(exaAdapter.description.length).toBeGreaterThan(0);
  });
});
