import { initPublisherRegistry } from '@/lib/publishing/publisher-registry';
import { initAdapterRegistry } from '@/lib/research/adapter-registry';

/**
 * Initialize both provider registries (publishers + research adapters).
 * Call once at startup before any dispatch to publisherRegistry or adapterRegistry.
 * On failure, throws — a process without registries cannot function correctly.
 *
 * This is the single entry point for all process types:
 * - daemon (src/daemon/index.ts)
 * - CronJob scripts (src/jobs/publish.ts, src/jobs/research.ts)
 * - Next.js server instrumentation (src/instrumentation.ts)
 */
export async function initRegistries(): Promise<void> {
  await initPublisherRegistry();
  await initAdapterRegistry();
}
