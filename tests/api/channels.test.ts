import { describe, it, expect, afterAll } from 'vitest';
import { db } from '@/db/client';
import { channels } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ResearchConfig, ScheduleConfig } from '@/db/schema';

const testResearchConfig: ResearchConfig = {
  topics: ['AI', 'startups'],
  keywords: ['LLM', 'founder'],
  subreddits: ['r/artificial'],
  substackFeeds: [],
  searchQueryTemplates: ['latest {topic} news'],
  excludedDomains: [],
  contentTypeMix: { note: 70, article: 30 },
  maxDraftsPerRun: 3,
  scheduleHours: 6,
};

const testScheduleConfig: ScheduleConfig = {
  timezone: 'America/New_York',
  minGapHours: 18,
  jitterMinutes: 30,
  timeWindows: [{ dayOfWeek: [2, 3, 4], startHour: 8, endHour: 10 }],
};

describe('channels data layer', () => {
  let channelId: string;

  it('inserts a linkedin channel', async () => {
    const [ch] = await db.insert(channels).values({
      name: 'Test LinkedIn',
      platform: 'linkedin',
      researchConfig: testResearchConfig,
      scheduleConfig: testScheduleConfig,
    }).returning();

    expect(ch.id).toBeDefined();
    expect(ch.name).toBe('Test LinkedIn');
    expect(ch.platform).toBe('linkedin');
    channelId = ch.id;
  });

  it('retrieves the channel by id', async () => {
    const [ch] = await db.select().from(channels).where(eq(channels.id, channelId));
    expect(ch.platform).toBe('linkedin');
    expect((ch.researchConfig as ResearchConfig).topics).toContain('AI');
  });

  it('updates the channel name', async () => {
    const [updated] = await db.update(channels)
      .set({ name: 'Updated LinkedIn', updatedAt: new Date() })
      .where(eq(channels.id, channelId))
      .returning();
    expect(updated.name).toBe('Updated LinkedIn');
  });

  it('deletes the channel', async () => {
    await db.delete(channels).where(eq(channels.id, channelId));
    const rows = await db.select().from(channels).where(eq(channels.id, channelId));
    expect(rows).toHaveLength(0);
    channelId = ''; // mark deleted
  });

  afterAll(async () => {
    if (channelId) {
      await db.delete(channels).where(eq(channels.id, channelId));
    }
  });
});
