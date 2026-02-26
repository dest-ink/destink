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
  contentTypeMix: { note: 70, article: 30 },
  maxDraftsPerRun: 3,
  scheduleHours: 6,
};

describe('buildSubstackFeedUrls', () => {
  it('passes through full https URLs unchanged', () => {
    const urls = buildSubstackFeedUrls(baseConfig);
    expect(urls).toContain('https://stratechery.com/feed');
  });

  it('converts bare subdomain to Substack RSS URL', () => {
    const urls = buildSubstackFeedUrls(baseConfig);
    expect(urls.some(u => u.includes('lenny.substack.com'))).toBe(true);
    expect(urls.some(u => u.endsWith('/feed'))).toBe(true);
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
    expect(buildSubstackFeedUrls(manyFeeds).length).toBeLessThanOrEqual(10);
  });
});
