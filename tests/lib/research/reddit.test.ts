import { describe, it, expect } from 'vitest';
import { buildRedditUrls } from '@/lib/research/reddit';
import type { ResearchConfig } from '@/db/schema';

const baseConfig: ResearchConfig = {
  topics: ['AI agents', 'LLMs'],
  keywords: ['LLM', 'founder'],
  subreddits: ['r/MachineLearning', 'r/artificial'],
  substackFeeds: [],
  searchQueryTemplates: [],
  excludedDomains: [],
  contentTypeMix: { note: 70, article: 30 },
  maxDraftsPerRun: 3,
  scheduleHours: 6,
};

describe('buildRedditUrls', () => {
  it('builds a hot posts URL for each subreddit', () => {
    const urls = buildRedditUrls(baseConfig);
    expect(urls.some(u => u.includes('MachineLearning'))).toBe(true);
    expect(urls.some(u => u.includes('artificial'))).toBe(true);
  });

  it('strips the r/ prefix from subreddit names', () => {
    const urls = buildRedditUrls(baseConfig);
    // Should produce URLs like reddit.com/r/MachineLearning/hot.json
    expect(urls.every(u => !u.includes('r/r/'))).toBe(true);
  });

  it('returns empty array for empty subreddits', () => {
    const noSubs = { ...baseConfig, subreddits: [] };
    expect(buildRedditUrls(noSubs)).toHaveLength(0);
  });

  it('caps at 5 subreddits', () => {
    const manySubs = {
      ...baseConfig,
      subreddits: ['r/a', 'r/b', 'r/c', 'r/d', 'r/e', 'r/f', 'r/g'],
    };
    expect(buildRedditUrls(manySubs).length).toBeLessThanOrEqual(5);
  });
});
