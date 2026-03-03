import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResearchConfig, ResearchSource } from '@/db/schema';
import type { ResearchAdapter } from '@/lib/providers/types';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';

// Mock the adapter-registry module so runResearch() dispatches to our mock adapters
vi.mock('@/lib/research/adapter-registry', () => {
  const mockSearch = vi.fn();

  const mockAdapter: ResearchAdapter = {
    id: 'mock-exa',
    name: 'mock-exa',
    displayName: 'Mock Exa',
    description: 'Mock Exa adapter',
    apiVersion: PROVIDER_API_VERSION,
    search: mockSearch,
  };

  return {
    adapterRegistry: {
      getAll: vi.fn(() => [mockAdapter]),
      get: vi.fn((id: string) => (id === 'mock-exa' ? mockAdapter : undefined)),
      has: vi.fn((id: string) => id === 'mock-exa'),
      keys: vi.fn(() => ['mock-exa']),
    },
  };
});

import { runResearch } from '@/lib/research/orchestrator';
import { adapterRegistry } from '@/lib/research/adapter-registry';

const mockGetAll = vi.mocked(adapterRegistry.getAll);
const mockGet = vi.mocked(adapterRegistry.get);

const baseConfig: ResearchConfig = {
  topics: ['AI agents'],
  keywords: ['LLM'],
  subreddits: ['r/MachineLearning'],
  substackFeeds: ['example.substack.com'],
  searchQueryTemplates: [],
  excludedDomains: [],
};

const makeSource = (url: string, source: ResearchSource['source']): ResearchSource => ({
  url,
  title: `Title for ${url}`,
  summary: `Summary for ${url}`,
  source,
});

const makeAdapter = (
  id: string,
  search: (config: ResearchConfig) => Promise<ResearchSource[]>,
): ResearchAdapter => ({
  id,
  name: id,
  displayName: id,
  description: `Adapter ${id}`,
  apiVersion: PROVIDER_API_VERSION,
  search,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runResearch', () => {
  it('combines results from all adapters returned by getAll()', async () => {
    const exaSearch = vi.fn().mockResolvedValue([makeSource('https://exa.example.com/1', 'exa')]);
    const redditSearch = vi.fn().mockResolvedValue([makeSource('https://reddit.example.com/1', 'reddit')]);
    const substackSearch = vi.fn().mockResolvedValue([makeSource('https://substack.example.com/1', 'substack')]);

    mockGetAll.mockReturnValue([
      makeAdapter('exa', exaSearch),
      makeAdapter('reddit', redditSearch),
      makeAdapter('substack', substackSearch),
    ]);

    const results = await runResearch(baseConfig);

    expect(results).toHaveLength(3);
    expect(results.map(r => r.source)).toEqual(expect.arrayContaining(['exa', 'reddit', 'substack']));
  });

  it('deduplicates sources by URL', async () => {
    const sharedUrl = 'https://shared.example.com/article';
    const exaSearch = vi.fn().mockResolvedValue([makeSource(sharedUrl, 'exa')]);
    const redditSearch = vi.fn().mockResolvedValue([makeSource(sharedUrl, 'reddit')]);
    const substackSearch = vi.fn().mockResolvedValue([makeSource('https://unique.example.com/article', 'substack')]);

    mockGetAll.mockReturnValue([
      makeAdapter('exa', exaSearch),
      makeAdapter('reddit', redditSearch),
      makeAdapter('substack', substackSearch),
    ]);

    const results = await runResearch(baseConfig);

    expect(results).toHaveLength(2);
    // The first occurrence (from exa) should be kept
    const duplicate = results.find(r => r.url === sharedUrl);
    expect(duplicate).toBeDefined();
    expect(duplicate!.source).toBe('exa');
  });

  it('still returns results when one adapter rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Exa API down');
    const exaSearch = vi.fn().mockRejectedValue(error);
    const redditSearch = vi.fn().mockResolvedValue([makeSource('https://reddit.example.com/1', 'reddit')]);
    const substackSearch = vi.fn().mockResolvedValue([makeSource('https://substack.example.com/1', 'substack')]);

    mockGetAll.mockReturnValue([
      makeAdapter('exa', exaSearch),
      makeAdapter('reddit', redditSearch),
      makeAdapter('substack', substackSearch),
    ]);

    const results = await runResearch(baseConfig);

    expect(consoleSpy).toHaveBeenCalledWith('[runResearch] adapter failed:', error);
    expect(results).toHaveLength(2);
    expect(results.map(r => r.source)).toEqual(expect.arrayContaining(['reddit', 'substack']));
    expect(results.map(r => r.source)).not.toContain('exa');
    consoleSpy.mockRestore();
  });

  it('filters to specified adapter IDs when adapterIds is provided', async () => {
    const exaSearch = vi.fn().mockResolvedValue([makeSource('https://exa.example.com/1', 'exa')]);
    const exaAdapter = makeAdapter('exa', exaSearch);

    mockGet.mockImplementation((id: string) => (id === 'exa' ? exaAdapter : undefined));

    const results = await runResearch(baseConfig, ['exa']);

    expect(mockGet).toHaveBeenCalledWith('exa');
    expect(exaSearch).toHaveBeenCalledWith(baseConfig);
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('exa');
  });

  it('skips unknown adapter IDs gracefully', async () => {
    mockGet.mockReturnValue(undefined);

    const results = await runResearch(baseConfig, ['does-not-exist']);

    expect(results).toHaveLength(0);
  });
});
