import { describe, it, expect } from 'vitest';
import { buildExaQueries } from '@/lib/research/exa';
import type { ResearchConfig } from '@/db/schema';

const baseConfig: ResearchConfig = {
  topics: ['AI agents'],
  keywords: ['LLM', 'founder'],
  subreddits: ['r/MachineLearning'],
  substackFeeds: [],
  searchQueryTemplates: ['latest news about {topic}', '{topic} trends 2026'],
  excludedDomains: ['reddit.com'],
  contentTypeMix: { note: 70, article: 30 },
  maxDraftsPerRun: 3,
  scheduleHours: 6,
};

describe('buildExaQueries', () => {
  it('generates queries by expanding {topic} in templates', () => {
    const queries = buildExaQueries(baseConfig);
    expect(queries).toContain('latest news about AI agents');
    expect(queries).toContain('AI agents trends 2026');
  });

  it('deduplicates queries', () => {
    const dupeConfig = { ...baseConfig, searchQueryTemplates: ['news about {topic}', 'news about {topic}'] };
    const queries = buildExaQueries(dupeConfig);
    expect(queries.filter(q => q === 'news about AI agents')).toHaveLength(1);
  });

  it('falls back to "{topic} recent developments" when no templates', () => {
    const noTemplates = { ...baseConfig, searchQueryTemplates: [] };
    const queries = buildExaQueries(noTemplates);
    expect(queries).toContain('AI agents recent developments');
  });

  it('handles multiple topics', () => {
    const multiTopic = { ...baseConfig, topics: ['AI', 'startups'] };
    const queries = buildExaQueries(multiTopic);
    expect(queries.some(q => q.includes('AI'))).toBe(true);
    expect(queries.some(q => q.includes('startups'))).toBe(true);
  });
});
