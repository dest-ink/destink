import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResearchConfig, ResearchSource } from '@/db/schema';

vi.mock('@/lib/research/exa', () => ({
  searchExa: vi.fn(),
}));

vi.mock('@/lib/research/reddit', () => ({
  searchReddit: vi.fn(),
}));

vi.mock('@/lib/research/substack-monitor', () => ({
  monitorSubstackFeeds: vi.fn(),
}));

import { runResearch } from '@/lib/research/orchestrator';
import { searchExa } from '@/lib/research/exa';
import { searchReddit } from '@/lib/research/reddit';
import { monitorSubstackFeeds } from '@/lib/research/substack-monitor';

const mockSearchExa = vi.mocked(searchExa);
const mockSearchReddit = vi.mocked(searchReddit);
const mockMonitorSubstackFeeds = vi.mocked(monitorSubstackFeeds);

const baseConfig: ResearchConfig = {
  topics: ['AI agents'],
  keywords: ['LLM'],
  subreddits: ['r/MachineLearning'],
  substackFeeds: ['example.substack.com'],
  searchQueryTemplates: [],
  excludedDomains: [],
  contentTypeMix: { note: 70, article: 30 },
  maxDraftsPerRun: 3,
  scheduleHours: 6,
};

const makeSource = (url: string, source: ResearchSource['source']): ResearchSource => ({
  url,
  title: `Title for ${url}`,
  summary: `Summary for ${url}`,
  source,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runResearch', () => {
  it('combines results from all adapters', async () => {
    mockSearchExa.mockResolvedValue([makeSource('https://exa.example.com/1', 'exa')]);
    mockSearchReddit.mockResolvedValue([makeSource('https://reddit.example.com/1', 'reddit')]);
    mockMonitorSubstackFeeds.mockResolvedValue([makeSource('https://substack.example.com/1', 'substack')]);

    const results = await runResearch(baseConfig);

    expect(results).toHaveLength(3);
    expect(results.map(r => r.source)).toEqual(expect.arrayContaining(['exa', 'reddit', 'substack']));
  });

  it('deduplicates sources by URL', async () => {
    const sharedUrl = 'https://shared.example.com/article';
    mockSearchExa.mockResolvedValue([makeSource(sharedUrl, 'exa')]);
    mockSearchReddit.mockResolvedValue([makeSource(sharedUrl, 'reddit')]);
    mockMonitorSubstackFeeds.mockResolvedValue([makeSource('https://unique.example.com/article', 'substack')]);

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
    mockSearchExa.mockRejectedValue(error);
    mockSearchReddit.mockResolvedValue([makeSource('https://reddit.example.com/1', 'reddit')]);
    mockMonitorSubstackFeeds.mockResolvedValue([makeSource('https://substack.example.com/1', 'substack')]);

    const results = await runResearch(baseConfig);

    expect(consoleSpy).toHaveBeenCalledWith('[runResearch] adapter failed:', error);
    expect(results).toHaveLength(2);
    expect(results.map(r => r.source)).toEqual(expect.arrayContaining(['reddit', 'substack']));
    expect(results.map(r => r.source)).not.toContain('exa');
    consoleSpy.mockRestore();
  });
});
