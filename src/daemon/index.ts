import { schedule } from 'node-cron';
import { runPublishQueue, getRetryDelay } from '@/lib/publishing/queue-runner';

// Re-export so existing tests that import getRetryDelay from this module continue to work.
export { getRetryDelay };

// Module-level lock: prevents overlapping runs within the same process.
// This daemon is designed to run as a single Kubernetes Deployment instance,
// so in-process locking is sufficient to prevent tick overlap.
let isProcessing = false;

async function tick() {
  if (isProcessing) {
    console.warn('[daemon] Previous run still in progress — skipping this tick');
    return;
  }
  isProcessing = true;
  try {
    await runPublishQueue();
  } finally {
    isProcessing = false;
  }
}

// Run publish check every minute
schedule('* * * * *', () => {
  tick().catch(console.error);
});

console.log('[daemon] Publish loop started — checking queue every minute');
