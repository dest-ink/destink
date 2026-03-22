import type { ResearchConfig, ResearchSource } from '@/db/schema';
import Exa from 'exa-js';

/**
 * Expands templates with each topic and deduplicates.
 * Pure function — no I/O.
 */
export function buildExaQueries(config: ResearchConfig): string[] {
  const queries: string[] = [];
  for (const topic of config.topics) {
    if (config.searchQueryTemplates.length === 0) {
      queries.push(`${topic} recent developments`);
    } else {
      for (const template of config.searchQueryTemplates) {
        queries.push(template.replace('{topic}', topic));
      }
    }
  }
  return [...new Set(queries)];
}

/**
 * Runs up to 5 Exa searches and returns deduplicated ResearchSource array.
 * Requires EXA_API_KEY env var. Returns [] if key is missing or client init fails.
 */
export async function searchExa(config: ResearchConfig): Promise<ResearchSource[]> {
  let client: Exa;
  try {
    client = new Exa(process.env.EXA_API_KEY!);
  } catch (err) {
    console.error('[searchExa] failed to initialise Exa client (check EXA_API_KEY)', err);
    return [];
  }

  const queries = buildExaQueries(config);
  const sources: ResearchSource[] = [];
  const seen = new Set<string>();

  for (const query of queries.slice(0, 5)) {
    try {
      const result = await Promise.race([
        client.search(query, {
          type: 'auto',
          numResults: 3,
          contents: {
            highlights: { maxCharacters: 4000 },
          },
          excludeDomains: config.excludedDomains ?? [],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Exa search timed out after 5s')), 5000),
        ),
      ]);
      for (const r of result.results) {
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        sources.push({
          url: r.url,
          title: r.title ?? '',
          // Use || so an empty highlights array falls through to text fallback
          summary: r.highlights?.join(' ') || ((r as unknown as { text?: string }).text ?? '').slice(0, 500),
          source: 'exa',
        });
      }
    } catch (err) {
      console.error(`[searchExa] query failed: "${query}"`, err);
      // continue — don't let one failed query abort the whole run
    }
  }

  return sources;
}
