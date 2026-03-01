import { adapterRegistry } from '@/lib/research/adapter-registry';
import type { ResearchAdapter } from '@/lib/providers/types';
import type { ResearchConfig, ResearchSource } from '@/db/schema';
import type { OnProgress } from './progress';

/**
 * Runs research adapters in parallel using Promise.allSettled.
 * By default, all registered adapters are run. Pass an optional `adapterIds`
 * array to fan-out only to a specific subset of adapters.
 *
 * Logs any rejected adapters, combines fulfilled results into a single
 * flat array, and deduplicates by URL (keeping first occurrence).
 *
 * When `onProgress` is provided, emits adapter-start/result/error events.
 */
export async function runResearch(
  config: ResearchConfig,
  adapterIds?: string[],
  onProgress?: OnProgress,
): Promise<ResearchSource[]> {
  const adapters: ResearchAdapter[] = adapterIds
    ? adapterIds
        .map((id) => adapterRegistry.get(id))
        .filter((a): a is ResearchAdapter => a !== undefined)
    : adapterRegistry.getAll();

  // Run each adapter with progress tracking
  const results = await Promise.allSettled(
    adapters.map(async (a) => {
      onProgress?.({ type: 'adapter-start', adapterId: a.id, adapterName: a.displayName });
      try {
        const sources = await a.search(config);
        onProgress?.({
          type: 'adapter-result',
          adapterId: a.id,
          adapterName: a.displayName,
          sourceCount: sources.length,
        });
        return sources;
      } catch (err) {
        onProgress?.({
          type: 'adapter-error',
          adapterId: a.id,
          adapterName: a.displayName,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }),
  );

  const combined: ResearchSource[] = [];

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[runResearch] adapter failed:', result.reason);
    } else {
      combined.push(...result.value);
    }
  }

  // Deduplicate by URL — keep first occurrence, discard subsequent duplicates
  const seen = new Set<string>();
  const deduplicated: ResearchSource[] = [];

  for (const source of combined) {
    if (!seen.has(source.url)) {
      seen.add(source.url);
      deduplicated.push(source);
    }
  }

  return deduplicated;
}
