import { describe, it, expect } from 'vitest';
import { buildSubstackFeedUrls } from '@/lib/research/substack-monitor';
import type { ResearchConfig } from '@/db/schema';

const baseConfig: ResearchConfig = {
  topics: ['AI'],
  keywords: [],
  subreddits: [],
  substackFeeds: ['https://stratechery.com/feed', 'lenny.substack.com'],
  searchQueryTemplates: [],
  excludedDomains: [],
};

describe('buildSubstackFeedUrls', () => {
  it('passes through full https URLs unchanged', () => {
    const urls = buildSubstackFeedUrls(baseConfig);
    expect(urls).toContain('https://stratechery.com/feed');
  });

  it('converts bare subdomain to Substack RSS URL', () => {
    const urls = buildSubstackFeedUrls({ ...baseConfig, substackFeeds: ['lenny.substack.com'] });
    expect(urls).toEqual(['https://lenny.substack.com/feed']);
  });

  it('strips trailing slash before adding /feed', () => {
    const urls = buildSubstackFeedUrls({ ...baseConfig, substackFeeds: ['lenny.substack.com/'] });
    expect(urls).toEqual(['https://lenny.substack.com/feed']);
  });

  it('returns empty array for empty substackFeeds', () => {
    const noFeeds = { ...baseConfig, substackFeeds: [] };
    expect(buildSubstackFeedUrls(noFeeds)).toHaveLength(0);
  });

  it('caps at 10 feeds', () => {
    const manyFeeds = {
      ...baseConfig,
      substackFeeds: Array.from({ length: 15 }, (_, i) => `pub${i}.substack.com`),
    };
    expect(buildSubstackFeedUrls(manyFeeds)).toHaveLength(10);
  });
});
