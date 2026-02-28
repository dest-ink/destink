import { adapterRegistry } from '@/lib/research/adapter-registry';
import type { ResearchAdapter } from '@/lib/providers/types';
import type { ResearchConfig, ResearchSource } from '@/db/schema';

/**
 * Runs research adapters in parallel using Promise.allSettled.
 * By default, all registered adapters are run. Pass an optional `adapterIds`
 * array to fan-out only to a specific subset of adapters.
 *
 * Logs any rejected adapters, combines fulfilled results into a single
 * flat array, and deduplicates by URL (keeping first occurrence).
 */
export async function runResearch(
  config: ResearchConfig,
  adapterIds?: string[],
): Promise<ResearchSource[]> {
  const adapters: ResearchAdapter[] = adapterIds
    ? adapterIds
        .map((id) => adapterRegistry.get(id))
        .filter((a): a is ResearchAdapter => a !== undefined)
    : adapterRegistry.getAll();

  const results = await Promise.allSettled(adapters.map((a) => a.search(config)));

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
