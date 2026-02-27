import { db } from '@/db/client';
import { channels } from '@/db/schema';
import { runResearchForChannel } from '@/lib/research/engine';

async function main(): Promise<void> {
  const start = new Date().toISOString();
  console.log(`[job:research] Starting at ${start}`);

  const allChannels = await db
    .select({ id: channels.id, name: channels.name })
    .from(channels);

  console.log(`[job:research] Found ${allChannels.length} channel(s)`);

  let successCount = 0;
  let failureCount = 0;

  for (const channel of allChannels) {
    try {
      console.log(
        `[job:research] Running research for channel ${channel.id} (${channel.name})`,
      );
      await runResearchForChannel(channel.id);
      successCount++;
    } catch (err) {
      // Per-channel failures are logged but do not abort the run.
      // The job exits 0 — individual channel errors are operational, not systemic.
      console.error(
        `[job:research] Failed for channel ${channel.id} (${channel.name}):`,
        err,
      );
      failureCount++;
    }
  }

  const finish = new Date().toISOString();
  console.log(
    `[job:research] Finished at ${finish} — ${successCount} succeeded, ${failureCount} failed`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[job:research] Unhandled error:', err);
    process.exit(1);
  });
