import { Registry } from '@/lib/providers/registry';
import { PROVIDER_API_VERSION, type ResearchAdapter } from '@/lib/providers/types';

// ─── Type guard ───────────────────────────────────────────────────────────────

/**
 * Duck-type guard that validates an unknown value as a ResearchAdapter.
 * Checks all required interface fields including apiVersion match.
 * Exported so adapter tests and external tooling can use it directly.
 */
export function isResearchAdapter(val: unknown): val is ResearchAdapter {
  if (typeof val !== 'object' || val === null) return false;
  const v = val as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    typeof v['name'] === 'string' &&
    typeof v['displayName'] === 'string' &&
    typeof v['description'] === 'string' &&
    typeof v['search'] === 'function' &&
    v['apiVersion'] === PROVIDER_API_VERSION
  );
}

// ─── Registry singleton ───────────────────────────────────────────────────────

/**
 * Singleton registry for research adapters, keyed by adapter id.
 *
 * Call `initAdapterRegistry()` once at startup before using `adapterRegistry`.
 * After initialization the registry is frozen — no further adapters can be
 * registered manually.
 */
const globalForAdapter = globalThis as typeof globalThis & {
  adapterRegistry?: Registry<ResearchAdapter>;
};

export const adapterRegistry =
  globalForAdapter.adapterRegistry ??
  new Registry<ResearchAdapter>((a) => a.id);

if (process.env.NODE_ENV !== 'production') {
  globalForAdapter.adapterRegistry = adapterRegistry;
}

// ─── Initializer ─────────────────────────────────────────────────────────────

/**
 * Import and register all research adapters.
 *
 * Uses explicit imports so the module works correctly in both bundled (Next.js
 * webpack / Turbopack) and unbundled (tsx) contexts. Adding a new adapter
 * requires adding an import + register call here.
 */
export async function initAdapterRegistry(): Promise<void> {
  if (adapterRegistry.keys().length > 0) return;

  const { default: brainstorm } = await import('./adapters/brainstorm.adapter');
  const { default: exa } = await import('./adapters/exa.adapter');
  const { default: reddit } = await import('./adapters/reddit.adapter');
  const { default: substackMonitor } = await import('./adapters/substack-monitor.adapter');

  const adapters = [
    { mod: brainstorm, name: 'brainstorm' },
    { mod: exa, name: 'exa' },
    { mod: reddit, name: 'reddit' },
    { mod: substackMonitor, name: 'substack-monitor' },
  ];

  for (const { mod, name } of adapters) {
    if (isResearchAdapter(mod)) {
      adapterRegistry.register(mod);
    } else {
      console.warn(`[Registry] Skipping invalid research adapter: ${name}`);
    }
  }

  adapterRegistry.freeze();
}
