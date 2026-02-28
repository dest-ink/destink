import path from 'path';
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
export const adapterRegistry = new Registry<ResearchAdapter>((a) => a.id);

// ─── Initializer ─────────────────────────────────────────────────────────────

/**
 * Discovers and loads all *.adapter.ts (and *.adapter.js in production builds)
 * files from the research adapters directory. Invalid or unloadable files are
 * skipped with a console.warn — a single bad file never blocks others.
 *
 * Should be called once at application startup.
 */
export async function initAdapterRegistry(): Promise<void> {
  const adaptersDir = path.resolve(process.cwd(), 'src/lib/research/adapters');
  const validate = (mod: unknown): ResearchAdapter | null =>
    isResearchAdapter(mod) ? mod : null;

  // Load TypeScript source files (development)
  await adapterRegistry.loadDirectory(adaptersDir, '.adapter.ts', validate);

  // Note: For production builds, adapters compile to .js. If the registry is
  // initialized in a compiled context, also load .adapter.js files.
  // The Registry.loadDirectory() freezes after the first call, so production
  // deployments should override adaptersDir to point at the compiled output.
}
