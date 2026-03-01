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
const globalForPublisher = globalThis as typeof globalThis & {
  publisherRegistry?: Registry<PublisherProvider>;
};

export const publisherRegistry =
  globalForPublisher.publisherRegistry ??
  new Registry<PublisherProvider>((p) => p.platform);

if (process.env.NODE_ENV !== 'production') {
  globalForPublisher.publisherRegistry = publisherRegistry;
}

// ─── Initializer ─────────────────────────────────────────────────────────────

/**
 * Import and register all publisher providers.
 *
 * Uses explicit imports so the module works correctly in both bundled (Next.js
 * webpack / Turbopack) and unbundled (tsx) contexts. Adding a new provider
 * requires adding an import + register call here.
 */
export async function initPublisherRegistry(): Promise<void> {
  if (publisherRegistry.keys().length > 0) return;

  const { default: linkedin } = await import('./providers/linkedin.provider');
  const { default: substack } = await import('./providers/substack.provider');

  if (isPublisherProvider(linkedin)) {
    publisherRegistry.register(linkedin);
  } else {
    console.warn('[Registry] Skipping invalid publisher provider: linkedin');
  }

  if (isPublisherProvider(substack)) {
    publisherRegistry.register(substack);
  } else {
    console.warn('[Registry] Skipping invalid publisher provider: substack');
  }

  publisherRegistry.freeze();
}
