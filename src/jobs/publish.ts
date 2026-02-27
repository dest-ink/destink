import { runPublishQueue } from '@/lib/publishing/queue-runner';

async function main(): Promise<void> {
  const start = new Date().toISOString();
  console.log(`[job:publish] Starting at ${start}`);

  await runPublishQueue();

  const finish = new Date().toISOString();
  console.log(`[job:publish] Finished at ${finish}`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[job:publish] Unhandled error:', err);
    process.exit(1);
  });
