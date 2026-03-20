import type { AiProvider } from './types';
import { getModelDefinition } from '../models';

/**
 * Provider Registry — pluggable system for AI providers.
 *
 * Providers are lazy-loaded: they're only instantiated when first needed.
 * To add a new provider:
 * 1. Create a class implementing AiProvider in this directory
 * 2. Add a loader to PROVIDER_LOADERS below
 * 3. Add models to src/lib/ai/models.ts with provider: 'your-provider-id'
 */

// ─── Provider Loaders ───────────────────────────────────────────────────────
// Each loader returns a provider instance. The class is only imported when
// the loader is first called, so unconfigured providers never load their SDKs.

type ProviderLoader = () => Promise<AiProvider>;

const PROVIDER_LOADERS: Record<string, ProviderLoader> = {
  anthropic: async () => {
    const { AnthropicProvider } = await import('./anthropic');
    return new AnthropicProvider();
  },
  openrouter: async () => {
    const { OpenRouterProvider } = await import('./openrouter');
    return new OpenRouterProvider();
  },
  // ── Add new providers here ──────────────────────────────────────────────
  // example: async () => {
  //   const { ExampleProvider } = await import('./example');
  //   return new ExampleProvider();
  // },
};

// ─── Registry ───────────────────────────────────────────────────────────────

const instances = new Map<string, AiProvider>();

/** Get or create a provider instance (async — dynamic import) */
async function getOrCreate(id: string): Promise<AiProvider | undefined> {
  if (instances.has(id)) return instances.get(id)!;
  const loader = PROVIDER_LOADERS[id];
  if (!loader) return undefined;
  const provider = await loader();
  instances.set(id, provider);
  return provider;
}

/** Get a provider by ID */
export async function getProvider(providerId: string): Promise<AiProvider | undefined> {
  return getOrCreate(providerId);
}

/** Get all registered provider IDs */
export function getProviderIds(): string[] {
  return Object.keys(PROVIDER_LOADERS);
}

/** Get all registered providers (instantiates them) */
export async function getAllProviders(): Promise<AiProvider[]> {
  const results = await Promise.all(getProviderIds().map(id => getOrCreate(id)));
  return results.filter((p): p is AiProvider => !!p);
}

/** Get all configured (have API keys) providers */
export async function getConfiguredProviders(): Promise<AiProvider[]> {
  const all = await getAllProviders();
  return all.filter(p => p.isConfigured());
}

/**
 * Register a new provider at runtime.
 * Useful for plugins or testing.
 */
export function registerProvider(id: string, loader: ProviderLoader): void {
  PROVIDER_LOADERS[id] = loader;
  instances.delete(id);
}

/**
 * Resolve which provider to use for a given model ID.
 *
 * Resolution order:
 * 1. Check models.ts for an explicit provider mapping
 * 2. If model ID contains '/' (e.g., 'openai/gpt-4o'), it's an OpenRouter model
 * 3. If model starts with 'claude-', it's Anthropic
 * 4. Try OpenRouter as universal fallback
 * 5. Last resort: first configured provider
 */
export async function resolveProvider(modelId: string): Promise<AiProvider> {
  // 1. Check catalog
  const def = getModelDefinition(modelId);
  if (def?.provider) {
    const provider = await getOrCreate(def.provider);
    if (provider?.isConfigured()) return provider;
    // Try fallback provider (e.g., OpenRouter can proxy Claude models)
    if (def.fallbackProvider) {
      const fallback = await getOrCreate(def.fallbackProvider);
      if (fallback?.isConfigured()) return fallback;
    }
    // Generic OpenRouter fallback
    const or = await getOrCreate('openrouter');
    if (or?.isConfigured()) return or;
  }

  // 2. Slash convention → OpenRouter
  if (modelId.includes('/')) {
    const or = await getOrCreate('openrouter');
    if (or?.isConfigured()) return or;
  }

  // 3. Claude prefix → Anthropic (or OpenRouter as proxy)
  if (modelId.startsWith('claude-')) {
    const anthropic = await getOrCreate('anthropic');
    if (anthropic?.isConfigured()) return anthropic;
    const or = await getOrCreate('openrouter');
    if (or?.isConfigured()) return or;
  }

  // 4. OpenRouter as universal fallback
  const or = await getOrCreate('openrouter');
  if (or?.isConfigured()) return or;

  // 5. First configured provider
  const configured = await getConfiguredProviders();
  if (configured.length > 0) return configured[0];

  // Nothing configured
  const anthropic = await getOrCreate('anthropic');
  return anthropic!;
}
