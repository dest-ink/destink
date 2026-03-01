/**
 * Orbitl background publish queue runner daemon.
 *
 * Deployment notes:
 * - Designed to run as a single Kubernetes Deployment instance.
 * - The in-process `isProcessing` flag prevents tick overlap within the daemon.
 * - If running as a Kubernetes CronJob (`job:publish`) instead of a long-lived
 *   Deployment, set `concurrencyPolicy: Forbid` to prevent overlapping runs.
 */

import { schedule, ScheduledTask } from 'node-cron';
import { pool } from '@/db/client';
import { runPublishQueue, recoverStuckItems, getRetryDelay } from '@/lib/publishing/queue-runner';
import { initRegistries } from '@/lib/bootstrap';

// Re-export so existing tests that import getRetryDelay from this module continue to work.
export { getRetryDelay };

// Module-level lock: prevents overlapping runs within the same process.
let isProcessing = false;
let isShuttingDown = false;

// Cron task handle — set during startup, used by shutdown().
let task: ScheduledTask;

async function tick() {
  if (isShuttingDown || isProcessing) {
    if (isShuttingDown) {
      console.warn('[daemon] Skipping tick — shutting down');
    } else {
      console.warn('[daemon] Previous run still in progress — skipping this tick');
    }
    return;
  }
  isProcessing = true;
  try {
    await recoverStuckItems();
    await runPublishQueue();
  } finally {
    isProcessing = false;
  }
}

async function shutdown(signal: string): Promise<void> {
  console.log(`[daemon] ${signal} received — initiating graceful shutdown`);
  isShuttingDown = true;
  task.stop();

  // Wait for in-flight publish to complete with timeout
  const TIMEOUT_MS = 25_000; // 25s — leave 5s buffer before Kubernetes SIGKILL at 30s
  const deadline = Date.now() + TIMEOUT_MS;
  while (isProcessing && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
  }
  if (isProcessing) {
    console.warn('[daemon] Shutdown timeout — forcing close with in-flight publish still running');
  }

  await pool.end();
  console.log('[daemon] DB pool closed — exiting');
  process.exit(0);
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch(console.error);
});
process.on('SIGINT', () => {
  shutdown('SIGINT').catch(console.error);
});

// Initialize provider registries before first tick.
// If initialization fails, let it crash — a daemon without registries cannot function.
(async () => {
  await initRegistries();

  task = schedule('* * * * *', () => {
    tick().catch(console.error);
  });

  console.log('[daemon] Publish loop started — checking queue every minute');
})();
