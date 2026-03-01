/**
 * Data migration: move per-channel researchConfig to standalone researchers.
 *
 * For each channel with a non-null research_config:
 * 1. Creates a researcher named "{channelName} Research"
 * 2. Links it to the source channel via researcher_channels
 * 3. Sets researcherId on existing researchRuns for that channel
 *
 * Idempotent: skips channels that already have a linked researcher.
 *
 * Usage: pnpm tsx src/db/migrate-research-configs.ts
 */

import { pool, db } from './client';
import {
  channels,
  researchers,
  researcherChannels,
  researchRuns,
  type ResearchConfig,
  type ResearchSourceConfig,
} from './schema';
import { eq, isNotNull, and } from 'drizzle-orm';

async function main(): Promise<void> {
  console.log('[migrate] Starting research config migration...');

  const channelsWithConfig = await db
    .select({
      id: channels.id,
      name: channels.name,
      researchConfig: channels.researchConfig,
    })
    .from(channels)
    .where(isNotNull(channels.researchConfig));

  console.log(`[migrate] Found ${channelsWithConfig.length} channel(s) with research config`);

  let created = 0;
  let skipped = 0;

  for (const channel of channelsWithConfig) {
    // Check if this channel already has a linked researcher (idempotency)
    const existing = await db
      .select({ id: researcherChannels.id })
      .from(researcherChannels)
      .where(eq(researcherChannels.channelId, channel.id))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[migrate] Skipping channel "${channel.name}" — already has a researcher`);
      skipped++;
      continue;
    }

    const config = channel.researchConfig as ResearchConfig;

    const sourceConfig: ResearchSourceConfig = {
      subreddits: config.subreddits ?? [],
      substackFeeds: config.substackFeeds ?? [],
      searchQueryTemplates: config.searchQueryTemplates ?? [],
      excludedDomains: config.excludedDomains ?? [],
      contentTypeMix: config.contentTypeMix ?? { note: 70, article: 30 },
      maxDraftsPerRun: config.maxDraftsPerRun ?? 3,
      scheduleHours: config.scheduleHours ?? 6,
    };

    // Create the researcher
    const [researcher] = await db
      .insert(researchers)
      .values({
        name: `${channel.name} Research`,
        topics: config.topics ?? [],
        keywords: config.keywords ?? [],
        sourceConfig,
      })
      .returning({ id: researchers.id });

    // Link to the source channel
    await db.insert(researcherChannels).values({
      researcherId: researcher.id,
      channelId: channel.id,
    });

    // Update existing research runs to point to the new researcher
    await db
      .update(researchRuns)
      .set({ researcherId: researcher.id })
      .where(
        and(
          eq(researchRuns.channelId, channel.id),
          eq(researchRuns.researcherId, null as unknown as string),
        ),
      );

    console.log(
      `[migrate] Created researcher "${researcher.id}" for channel "${channel.name}"`,
    );
    created++;
  }

  console.log(
    `[migrate] Done — ${created} researcher(s) created, ${skipped} skipped`,
  );
}

main()
  .catch((err: unknown) => {
    console.error('[migrate] Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
