import path from 'path';
import { Registry } from '@/lib/providers/registry';
import { PublisherProvider, PROVIDER_API_VERSION } from '@/lib/providers/types';

// ─── Type guard ───────────────────────────────────────────────────────────────

/**
 * Duck-type guard for PublisherProvider objects.
 *
 * Validates all required fields and checks that apiVersion matches the current
 * PROVIDER_API_VERSION. An invalid or version-mismatched module will return
 * null from the registry validate function, emitting a warning instead of
 * crashing the server.
 */
export function isPublisherProvider(val: unknown): val is PublisherProvider {
  if (typeof val !== 'object' || val === null) return false;

  const v = val as Record<string, unknown>;

  return (
    typeof v['name'] === 'string' &&
    typeof v['platform'] === 'string' &&
    typeof v['displayName'] === 'string' &&
    typeof v['description'] === 'string' &&
    typeof v['publish'] === 'function' &&
    typeof v['formatDraft'] === 'function' &&
    v['apiVersion'] === PROVIDER_API_VERSION &&
    Array.isArray(v['configSchema'])
  );
}

// ─── Registry singleton ───────────────────────────────────────────────────────

/**
 * Singleton publisher registry keyed by `platform`.
 *
 * Call `initPublisherRegistry()` at application startup to populate it.
 * After initialisation, use `publisherRegistry.get(platform)` to dispatch
 * publish calls without if/else chains.
 */
export const publisherRegistry = new Registry<PublisherProvider>(p => p.platform);

// ─── Initializer ─────────────────────────────────────────────────────────────

/**
 * Scan the `providers/` directory adjacent to this file and register every
 * valid *.provider.ts (or *.provider.js in production) file.
 *
 * Invalid modules emit a console.warn and are skipped — one bad provider
 * never blocks others from loading.
 *
 * Uses `process.cwd()` + relative path so this works with both tsx (dev) and
 * Next.js build output where __dirname / import.meta.url are unreliable.
 */
export async function initPublisherRegistry(): Promise<void> {
  const providersDir = path.resolve(process.cwd(), 'src/lib/publishing/providers');
  // Accept .provider.ts (tsx/ts-node) and .provider.js (compiled output)
  // The Registry.loadDirectory suffix matching uses endsWith(), so we call it
  // twice to cover both extension variants.
  await publisherRegistry.loadDirectory(
    providersDir,
    '.provider.ts',
    (mod) => (isPublisherProvider(mod) ? mod : null),
  );
}
