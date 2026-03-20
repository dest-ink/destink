/**
 * Single source of truth for Claude model definitions.
 * Update THIS FILE when Anthropic releases new models.
 *
 * Last updated: 2026-03-20
 * Reference: https://platform.claude.com/docs/en/about-claude/models/overview
 */

export interface ModelDefinition {
  id: string;
  displayName: string;
  description: string;
  contextWindow: number;
  maxOutput: number;
  pricing: { inputPer1M: number; outputPer1M: number };
  tier: 'current' | 'legacy';
  provider: 'anthropic' | 'openrouter';
}

// ─── Current Models ─────────────────────────────────────────────────────────

export const CURRENT_MODELS: ModelDefinition[] = [
  // ── Anthropic ───────────────────────────────────────────────────────────
  {
    id: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    description: 'Most intelligent model for agents and coding. Best writing quality.',
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    pricing: { inputPer1M: 5, outputPer1M: 25 },
    tier: 'current',
    provider: 'anthropic',
  },
  {
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    description: 'Best combination of speed and intelligence. Great for most tasks.',
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    pricing: { inputPer1M: 3, outputPer1M: 15 },
    tier: 'current',
    provider: 'anthropic',
  },
  {
    id: 'claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    description: 'Fastest and most cost-effective. Good for simple, high-volume tasks.',
    contextWindow: 200_000,
    maxOutput: 64_000,
    pricing: { inputPer1M: 1, outputPer1M: 5 },
    tier: 'current',
    provider: 'anthropic',
  },

  // ── OpenRouter (OpenAI) ─────────────────────────────────────────────────
  {
    id: 'openai/gpt-4.1',
    displayName: 'GPT-4.1',
    description: 'OpenAI flagship. Strong reasoning and instruction following.',
    contextWindow: 1_047_576,
    maxOutput: 32_768,
    pricing: { inputPer1M: 2, outputPer1M: 8 },
    tier: 'current',
    provider: 'openrouter',
  },
  {
    id: 'openai/gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini',
    description: 'Fast and affordable OpenAI model. Good for simple tasks.',
    contextWindow: 1_047_576,
    maxOutput: 32_768,
    pricing: { inputPer1M: 0.4, outputPer1M: 1.6 },
    tier: 'current',
    provider: 'openrouter',
  },
  {
    id: 'openai/o3',
    displayName: 'OpenAI o3',
    description: 'OpenAI reasoning model. Deep thinking for complex problems.',
    contextWindow: 200_000,
    maxOutput: 100_000,
    pricing: { inputPer1M: 2, outputPer1M: 8 },
    tier: 'current',
    provider: 'openrouter',
  },

  // ── OpenRouter (Google) ─────────────────────────────────────────────────
  {
    id: 'google/gemini-2.5-pro-preview',
    displayName: 'Gemini 2.5 Pro',
    description: 'Google flagship. Strong at long context and multimodal tasks.',
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    pricing: { inputPer1M: 1.25, outputPer1M: 10 },
    tier: 'current',
    provider: 'openrouter',
  },
  {
    id: 'google/gemini-2.5-flash-preview',
    displayName: 'Gemini 2.5 Flash',
    description: 'Fast Google model. Great value for high-volume tasks.',
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    pricing: { inputPer1M: 0.15, outputPer1M: 0.60 },
    tier: 'current',
    provider: 'openrouter',
  },
];

// ─── Legacy Models (still active, Anthropic only) ────────────────────────

export const LEGACY_MODELS: ModelDefinition[] = [
  {
    id: 'claude-sonnet-4-5',
    displayName: 'Claude Sonnet 4.5',
    description: 'Previous generation Sonnet.',
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    pricing: { inputPer1M: 3, outputPer1M: 15 },
    tier: 'legacy',
    provider: 'anthropic',
  },
  {
    id: 'claude-opus-4-5',
    displayName: 'Claude Opus 4.5',
    description: 'Previous generation Opus.',
    contextWindow: 200_000,
    maxOutput: 64_000,
    pricing: { inputPer1M: 5, outputPer1M: 25 },
    tier: 'legacy',
    provider: 'anthropic',
  },
];

// ─── Combined ───────────────────────────────────────────────────────────────

export const ALL_MODELS: ModelDefinition[] = [...CURRENT_MODELS, ...LEGACY_MODELS];

/** Lookup a model by ID */
export function getModelDefinition(id: string): ModelDefinition | undefined {
  return ALL_MODELS.find(m => m.id === id);
}

/** Get pricing for a model ID */
export function getModelPricing(id: string): { inputPer1M: number; outputPer1M: number } | undefined {
  return getModelDefinition(id)?.pricing;
}

/** All valid model IDs */
export const MODEL_IDS = ALL_MODELS.map(m => m.id);
