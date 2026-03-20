import type { AiProvider } from './types';
import { AnthropicProvider } from './anthropic';
import { OpenRouterProvider } from './openrouter';
import { getModelDefinition } from '../models';

/**
 * Provider Registry — maps model IDs to the correct provider.
 *
 * To add a new provider:
 * 1. Create a class implementing AiProvider in this directory
 * 2. Instantiate it below and add to the providers map
 * 3. Add models to src/lib/ai/models.ts with provider: 'your-provider-id'
 */

const providers = new Map<string, AiProvider>();

// Register providers (lazy singletons)
const anthropicProvider = new AnthropicProvider();
const openRouterProvider = new OpenRouterProvider();

providers.set('anthropic', anthropicProvider);
providers.set('openrouter', openRouterProvider);

/** Get a provider by ID */
export function getProvider(providerId: string): AiProvider | undefined {
  return providers.get(providerId);
}

/** Get all registered providers */
export function getAllProviders(): AiProvider[] {
  return Array.from(providers.values());
}

/** Get all configured (have API keys) providers */
export function getConfiguredProviders(): AiProvider[] {
  return getAllProviders().filter(p => p.isConfigured());
}

/**
 * Resolve which provider to use for a given model ID.
 *
 * Resolution order:
 * 1. Check models.ts for an explicit provider mapping
 * 2. If model ID contains '/' (e.g., 'openai/gpt-4o'), it's an OpenRouter model
 * 3. If model starts with 'claude-', it's Anthropic
 * 4. Default to OpenRouter (as the universal fallback)
 */
export function resolveProvider(modelId: string): AiProvider {
  // Check our model catalog first
  const def = getModelDefinition(modelId);
  if (def?.provider) {
    const provider = providers.get(def.provider);
    if (provider) return provider;
  }

  // Convention: models with '/' are OpenRouter format (e.g., 'openai/gpt-4o')
  if (modelId.includes('/')) {
    return openRouterProvider;
  }

  // Claude models go to Anthropic
  if (modelId.startsWith('claude-')) {
    return anthropicProvider;
  }

  // Default: try OpenRouter as universal router
  if (openRouterProvider.isConfigured()) {
    return openRouterProvider;
  }

  // Last resort: Anthropic
  return anthropicProvider;
}
