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
    id: 'openai/gpt-5.4-pro',
    displayName: 'GPT-5.4 Pro',
    description: 'OpenAI most capable model. Deep reasoning, best for complex tasks.',
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    pricing: { inputPer1M: 30, outputPer1M: 180 },
    tier: 'current',
    provider: 'openrouter',
  },
  {
    id: 'openai/gpt-5.4',
    displayName: 'GPT-5.4',
    description: 'OpenAI flagship. Strong reasoning and instruction following.',
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    pricing: { inputPer1M: 2.5, outputPer1M: 15 },
    tier: 'current',
    provider: 'openrouter',
  },
  {
    id: 'openai/gpt-5.4-mini',
    displayName: 'GPT-5.4 Mini',
    description: 'Fast and affordable. Great balance of speed and quality.',
    contextWindow: 400_000,
    maxOutput: 128_000,
    pricing: { inputPer1M: 0.75, outputPer1M: 4.5 },
    tier: 'current',
    provider: 'openrouter',
  },
  {
    id: 'openai/gpt-5.4-nano',
    displayName: 'GPT-5.4 Nano',
    description: 'Cheapest OpenAI model. Good for high-volume simple tasks.',
    contextWindow: 400_000,
    maxOutput: 128_000,
    pricing: { inputPer1M: 0.2, outputPer1M: 1.25 },
    tier: 'current',
    provider: 'openrouter',
  },

  // ── OpenRouter (Google Gemini) ──────────────────────────────────────────
  {
    id: 'google/gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro',
    description: 'Google flagship. Strong at long context and multimodal tasks.',
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    pricing: { inputPer1M: 2, outputPer1M: 12 },
    tier: 'current',
    provider: 'openrouter',
  },
  {
    id: 'google/gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash',
    description: 'Fast Google model. Great value for high-volume tasks.',
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    pricing: { inputPer1M: 0.5, outputPer1M: 3 },
    tier: 'current',
    provider: 'openrouter',
  },
  {
    id: 'google/gemini-3.1-flash-lite-preview',
    displayName: 'Gemini 3.1 Flash Lite',
    description: 'Cheapest Google model. Fast and extremely affordable.',
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    pricing: { inputPer1M: 0.25, outputPer1M: 1.5 },
    tier: 'current',
    provider: 'openrouter',
  },

  // ── OpenRouter (Qwen) ──────────────────────────────────────────────────
  {
    id: 'qwen/qwen3-max-thinking',
    displayName: 'Qwen3 Max Thinking',
    description: 'Alibaba reasoning model. Deep thinking with chain-of-thought.',
    contextWindow: 262_144,
    maxOutput: 32_768,
    pricing: { inputPer1M: 0.78, outputPer1M: 3.9 },
    tier: 'current',
    provider: 'openrouter',
  },
  {
    id: 'qwen/qwen3.5-plus-02-15',
    displayName: 'Qwen3.5 Plus',
    description: 'Strong Alibaba model. Good balance of quality and cost.',
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    pricing: { inputPer1M: 0.26, outputPer1M: 1.56 },
    tier: 'current',
    provider: 'openrouter',
  },
  {
    id: 'qwen/qwen3.5-flash-02-23',
    displayName: 'Qwen3.5 Flash',
    description: 'Fast Alibaba model. 1M context, very affordable.',
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    pricing: { inputPer1M: 0.065, outputPer1M: 0.26 },
    tier: 'current',
    provider: 'openrouter',
  },
  {
    id: 'qwen/qwen3-coder-next',
    displayName: 'Qwen3 Coder Next',
    description: 'Alibaba coding specialist. Strong at code generation.',
    contextWindow: 262_144,
    maxOutput: 65_536,
    pricing: { inputPer1M: 0.12, outputPer1M: 0.75 },
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
