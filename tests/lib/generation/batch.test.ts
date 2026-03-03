import { describe, it, expect } from 'vitest';
import { assignContentTypes } from '@/lib/generation/batch';
import type { TopicRecommendation } from '@/db/schema';

function makeTopic(title: string, relevanceScore: number): TopicRecommendation {
  return {
    title,
    angle: `Angle for ${title}`,
    whyTimely: 'Timely because it is relevant',
    relevanceScore,
    contentType: 'note',
    sources: [],
  };
}

describe('assignContentTypes', () => {
  it('70% of 3 topics returns 2 notes and 1 article', () => {
    const topics = [
      makeTopic('Topic A', 90),
      makeTopic('Topic B', 80),
      makeTopic('Topic C', 70),
    ];
    const result = assignContentTypes(topics, 3, 70);
    expect(result).toHaveLength(3);
    const notes = result.filter((r) => r.contentType === 'note');
    const articles = result.filter((r) => r.contentType === 'article');
    expect(notes).toHaveLength(2);
    expect(articles).toHaveLength(1);
  });

  it('50% of 3 topics returns 2 notes and 1 article (tie favors short-form via Math.round)', () => {
    const topics = [
      makeTopic('Topic A', 90),
      makeTopic('Topic B', 80),
      makeTopic('Topic C', 70),
    ];
    const result = assignContentTypes(topics, 3, 50);
    expect(result).toHaveLength(3);
    const notes = result.filter((r) => r.contentType === 'note');
    const articles = result.filter((r) => r.contentType === 'article');
    expect(notes).toHaveLength(2);
    expect(articles).toHaveLength(1);
  });

  it('50% of 4 topics returns 2 notes and 2 articles', () => {
    const topics = [
      makeTopic('Topic A', 90),
      makeTopic('Topic B', 80),
      makeTopic('Topic C', 70),
      makeTopic('Topic D', 60),
    ];
    const result = assignContentTypes(topics, 4, 50);
    expect(result).toHaveLength(4);
    const notes = result.filter((r) => r.contentType === 'note');
    const articles = result.filter((r) => r.contentType === 'article');
    expect(notes).toHaveLength(2);
    expect(articles).toHaveLength(2);
  });

  it('100% of 3 topics returns 3 notes and 0 articles', () => {
    const topics = [
      makeTopic('Topic A', 90),
      makeTopic('Topic B', 80),
      makeTopic('Topic C', 70),
    ];
    const result = assignContentTypes(topics, 3, 100);
    expect(result).toHaveLength(3);
    const notes = result.filter((r) => r.contentType === 'note');
    const articles = result.filter((r) => r.contentType === 'article');
    expect(notes).toHaveLength(3);
    expect(articles).toHaveLength(0);
  });

  it('0% of 3 topics returns 0 notes and 3 articles', () => {
    const topics = [
      makeTopic('Topic A', 90),
      makeTopic('Topic B', 80),
      makeTopic('Topic C', 70),
    ];
    const result = assignContentTypes(topics, 3, 0);
    expect(result).toHaveLength(3);
    const notes = result.filter((r) => r.contentType === 'note');
    const articles = result.filter((r) => r.contentType === 'article');
    expect(notes).toHaveLength(0);
    expect(articles).toHaveLength(3);
  });

  it('assigns note to highest-scored topics first (sorted by relevanceScore descending)', () => {
    // 70% of 3 = 2 notes. Highest scored topics should get note.
    const topics = [
      makeTopic('Low Score', 30),
      makeTopic('High Score', 90),
      makeTopic('Mid Score', 60),
    ];
    const result = assignContentTypes(topics, 3, 70);
    expect(result).toHaveLength(3);
    // After sorting by relevance desc: High(90), Mid(60), Low(30)
    // First 2 get note, last gets article
    const highResult = result.find((r) => r.topic.title === 'High Score');
    const midResult = result.find((r) => r.topic.title === 'Mid Score');
    const lowResult = result.find((r) => r.topic.title === 'Low Score');
    expect(highResult?.contentType).toBe('note');
    expect(midResult?.contentType).toBe('note');
    expect(lowResult?.contentType).toBe('article');
  });

  it('when count exceeds topics.length, only returns topics.length items', () => {
    const topics = [makeTopic('Topic A', 90), makeTopic('Topic B', 80)];
    const result = assignContentTypes(topics, 5, 70);
    expect(result).toHaveLength(2);
  });

  it('slices to count when count is less than topics.length', () => {
    const topics = [
      makeTopic('Topic A', 90),
      makeTopic('Topic B', 80),
      makeTopic('Topic C', 70),
      makeTopic('Topic D', 60),
    ];
    const result = assignContentTypes(topics, 2, 70);
    expect(result).toHaveLength(2);
    // Should be top 2 by relevance: A and B
    expect(result[0].topic.title).toBe('Topic A');
    expect(result[1].topic.title).toBe('Topic B');
  });
});
