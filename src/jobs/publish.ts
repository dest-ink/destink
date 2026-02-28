import { pool } from '@/db/client';
import { runPublishQueue } from '@/lib/publishing/queue-runner';
import { initRegistries } from '@/lib/bootstrap';
import { publisherRegistry } from '@/lib/publishing/publisher-registry';

async function main(): Promise<void> {
  const start = new Date().toISOString();
  console.log(`[job:publish] Starting at ${start}`);

  await initRegistries();
  console.log(`[job:publish] Registry initialized: ${publisherRegistry.keys().length} publisher(s)`);

  try {
    await runPublishQueue();

    const finish = new Date().toISOString();
    console.log(`[job:publish] Finished at ${finish}`);
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('[job:publish] Unhandled error:', err);
  process.exit(1);
});
