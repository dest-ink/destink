import { searchExa } from '@/lib/research/exa';
import { searchReddit } from '@/lib/research/reddit';
import { monitorSubstackFeeds } from '@/lib/research/substack-monitor';
import type { ResearchConfig, ResearchSource } from '@/db/schema';

/**
 * Runs all three research adapters in parallel using Promise.allSettled.
 * Logs any rejected adapters, combines fulfilled results into a single
 * flat array, and deduplicates by URL (keeping first occurrence).
 */
export async function runResearch(config: ResearchConfig): Promise<ResearchSource[]> {
  const results = await Promise.allSettled([
    searchExa(config),
    searchReddit(config),
    monitorSubstackFeeds(config),
  ]);

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
