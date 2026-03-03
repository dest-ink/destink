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
};

describe('buildRedditUrls', () => {
  it('builds a hot posts URL for each subreddit', () => {
    const urls = buildRedditUrls(baseConfig);
    expect(urls.some(u => u.includes('MachineLearning'))).toBe(true);
    expect(urls.some(u => u.includes('artificial'))).toBe(true);
  });

  it('strips the r/ prefix from subreddit names', () => {
    const urls = buildRedditUrls(baseConfig);
    expect(urls[0]).toBe('https://www.reddit.com/r/MachineLearning/hot.json?limit=10');
    expect(urls[1]).toBe('https://www.reddit.com/r/artificial/hot.json?limit=10');
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
    expect(buildRedditUrls(manySubs)).toHaveLength(5);
  });
});
