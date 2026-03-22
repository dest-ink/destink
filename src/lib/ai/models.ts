/**
 * Single source of truth for Claude model definitions.
 * Update THIS FILE when new models are released.
 *
 * Last updated: 2026-03-20
 * Sources:
 *   Anthropic: https://platform.claude.com/docs/en/about-claude/models/overview
 *   OpenRouter: https://openrouter.ai/api/v1/models
 */

export interface ModelDefinition {
  id: string;
  displayName: string;
  description: string;
  contextWindow: number;
  maxOutput: number;
  pricing: { inputPer1M: number; outputPer1M: number };
  tier: 'current' | 'legacy';
  /** Primary provider */
  provider: string;
  /** Fallback provider if primary isn't configured */
  fallbackProvider?: string;
  /** Model ID to use with fallback provider */
  fallbackModelId?: string;
  /** Tags for categorizing model strengths */
  tags: string[];
  /** Best-for labels for each use case (helps users pick) */
  bestFor?: string[];
}

// ─── Current Models ─────────────────────────────────────────────────────────

export const CURRENT_MODELS: ModelDefinition[] = [
  // ── Anthropic ───────────────────────────────────────────────────────────
  {
    id: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    description: 'Anthropic\'s strongest model for coding and long-running professional tasks, built for agents operating across entire workflows.',
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    pricing: { inputPer1M: 5, outputPer1M: 25 },
    tier: 'current',
    provider: 'anthropic',
    fallbackProvider: 'openrouter',
    fallbackModelId: 'anthropic/claude-opus-4.6',
    tags: ['Writing', 'Reasoning', 'Coding', 'Agents'],
    bestFor: ['Draft Generation', 'Voice Analysis'],
  },
  {
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    description: 'Anthropic\'s most capable Sonnet-class model, excelling at iterative development, complex codebase navigation, and structured output.',
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    pricing: { inputPer1M: 3, outputPer1M: 15 },
    tier: 'current',
    provider: 'anthropic',
    fallbackProvider: 'openrouter',
    fallbackModelId: 'anthropic/claude-sonnet-4.6',
    tags: ['Fast', 'Coding', 'Structured Output'],
    bestFor: ['Topic Ranking', 'Draft Editing', 'Onboarding'],
  },
  {
    id: 'claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    description: 'Fastest and most cost-effective Anthropic model. Good for simple, high-volume tasks like classification and extraction.',
    contextWindow: 200_000,
    maxOutput: 64_000,
    pricing: { inputPer1M: 1, outputPer1M: 5 },
    tier: 'current',
    provider: 'anthropic',
    fallbackProvider: 'openrouter',
    fallbackModelId: 'anthropic/claude-haiku-4.5',
    tags: ['Fast', 'Cheap', 'Classification'],
    bestFor: ['High-volume tasks'],
  },

  // ── Anthropic via OpenRouter ─────────────────────────────────────────────
  {
    id: 'anthropic/claude-opus-4.6',
    displayName: 'Claude Opus 4.6 (OpenRouter)',
    description: 'Anthropic\'s strongest model routed through OpenRouter. Same model, no Anthropic API key needed.',
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    pricing: { inputPer1M: 5, outputPer1M: 25 },
    tier: 'current',
    provider: 'openrouter',
    tags: ['Writing', 'Reasoning', 'Coding', 'Agents'],
    bestFor: ['Draft Generation', 'Voice Analysis'],
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    displayName: 'Claude Sonnet 4.6 (OpenRouter)',
    description: 'Anthropic\'s best speed/intelligence balance routed through OpenRouter. No Anthropic API key needed.',
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    pricing: { inputPer1M: 3, outputPer1M: 15 },
    tier: 'current',
    provider: 'openrouter',
    tags: ['Fast', 'Coding', 'Structured Output'],
    bestFor: ['Topic Ranking', 'Draft Editing', 'Onboarding'],
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    displayName: 'Claude Haiku 4.5 (OpenRouter)',
    description: 'Fastest Anthropic model routed through OpenRouter. Cheap and fast for simple tasks.',
    contextWindow: 200_000,
    maxOutput: 64_000,
    pricing: { inputPer1M: 1, outputPer1M: 5 },
    tier: 'current',
    provider: 'openrouter',
    tags: ['Fast', 'Cheap', 'Classification'],
    bestFor: ['High-volume tasks'],
  },

  // ── OpenAI (via OpenRouter) ─────────────────────────────────────────────
  {
    id: 'openai/gpt-5.4-pro',
    displayName: 'GPT-5.4 Pro',
    description: 'OpenAI\'s most advanced model with enhanced reasoning capabilities for complex, high-stakes tasks. Best writing quality from OpenAI.',
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    pricing: { inputPer1M: 30, outputPer1M: 180 },
    tier: 'current',
    provider: 'openrouter',
    tags: ['Writing', 'Reasoning', 'Premium'],
    bestFor: ['Draft Generation', 'Voice Analysis'],
  },
  {
    id: 'openai/gpt-5.4',
    displayName: 'GPT-5.4',
    description: 'OpenAI\'s flagship model unifying the Codex and GPT lines. 1M+ context window with strong reasoning and instruction following.',
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    pricing: { inputPer1M: 2.5, outputPer1M: 15 },
    tier: 'current',
    provider: 'openrouter',
    tags: ['Writing', 'Coding', 'Versatile'],
    bestFor: ['Draft Generation', 'Topic Ranking'],
  },
  {
    id: 'openai/gpt-5.4-mini',
    displayName: 'GPT-5.4 Mini',
    description: 'Core GPT-5.4 capabilities in a faster, more efficient model optimized for high-throughput workloads with strong reasoning and tool use.',
    contextWindow: 400_000,
    maxOutput: 128_000,
    pricing: { inputPer1M: 0.75, outputPer1M: 4.5 },
    tier: 'current',
    provider: 'openrouter',
    tags: ['Fast', 'Affordable', 'Versatile'],
    bestFor: ['Onboarding', 'Draft Editing'],
  },
  {
    id: 'openai/gpt-5.4-nano',
    displayName: 'GPT-5.4 Nano',
    description: 'Most lightweight and cost-efficient OpenAI variant, optimized for speed-critical tasks like classification and data extraction.',
    contextWindow: 400_000,
    maxOutput: 128_000,
    pricing: { inputPer1M: 0.2, outputPer1M: 1.25 },
    tier: 'current',
    provider: 'openrouter',
    tags: ['Cheapest', 'Fast', 'Extraction'],
    bestFor: ['High-volume tasks'],
  },

  // ── Google Gemini (via OpenRouter) ──────────────────────────────────────
  {
    id: 'google/gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro',
    description: 'Google\'s frontier reasoning model with enhanced software engineering, improved agentic reliability, and efficient token usage. 1M context.',
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    pricing: { inputPer1M: 2, outputPer1M: 12 },
    tier: 'current',
    provider: 'openrouter',
    tags: ['Reasoning', 'Long Context', 'Coding'],
    bestFor: ['Topic Ranking', 'Draft Generation'],
  },
  {
    id: 'google/gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash',
    description: 'High-speed thinking model designed for agentic workflows, multi-turn chat, and coding assistance with near Pro-level reasoning.',
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    pricing: { inputPer1M: 0.5, outputPer1M: 3 },
    tier: 'current',
    provider: 'openrouter',
    tags: ['Fast', 'Affordable', 'Agents'],
    bestFor: ['Draft Editing', 'Onboarding'],
  },
  {
    id: 'google/gemini-3.1-flash-lite-preview',
    displayName: 'Gemini 3.1 Flash Lite',
    description: 'Outperforms Gemini 2.5 Flash Lite on quality and approaches Gemini 2.5 Flash performance at half the cost. Extremely affordable.',
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    pricing: { inputPer1M: 0.25, outputPer1M: 1.5 },
    tier: 'current',
    provider: 'openrouter',
    tags: ['Cheapest', 'Fast', 'Long Context'],
    bestFor: ['High-volume tasks'],
  },

  // ── Qwen (via OpenRouter) ──────────────────────────────────────────────
  {
    id: 'qwen/qwen3-max-thinking',
    displayName: 'Qwen3 Max Thinking',
    description: 'Flagship reasoning model designed for high-stakes cognitive tasks requiring deep, multi-step reasoning with major accuracy gains.',
    contextWindow: 262_144,
    maxOutput: 32_768,
    pricing: { inputPer1M: 0.78, outputPer1M: 3.9 },
    tier: 'current',
    provider: 'openrouter',
    tags: ['Reasoning', 'Thinking', 'Accuracy'],
    bestFor: ['Topic Ranking', 'Voice Analysis'],
  },
  {
    id: 'qwen/qwen3.5-plus-02-15',
    displayName: 'Qwen3.5 Plus',
    description: 'Vision-language model integrating linear attention with sparse mixture-of-experts. State-of-the-art performance at very low cost.',
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    pricing: { inputPer1M: 0.26, outputPer1M: 1.56 },
    tier: 'current',
    provider: 'openrouter',
    tags: ['Affordable', 'Versatile', 'Long Context'],
    bestFor: ['Draft Generation', 'Draft Editing'],
  },
  {
    id: 'qwen/qwen3.5-flash-02-23',
    displayName: 'Qwen3.5 Flash',
    description: 'Significant performance leaps in both text and multimodal tasks with fast inference speeds. 1M context at the lowest cost.',
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    pricing: { inputPer1M: 0.065, outputPer1M: 0.26 },
    tier: 'current',
    provider: 'openrouter',
    tags: ['Cheapest', 'Fast', 'Long Context'],
    bestFor: ['High-volume tasks', 'Onboarding'],
  },
  {
    id: 'qwen/qwen3-coder-next',
    displayName: 'Qwen3 Coder Next',
    description: 'Optimized for coding agents and local workflows using sparse MoE design. Reliable on long-horizon coding and structured output tasks.',
    contextWindow: 262_144,
    maxOutput: 65_536,
    pricing: { inputPer1M: 0.12, outputPer1M: 0.75 },
    tier: 'current',
    provider: 'openrouter',
    tags: ['Coding', 'Structured Output', 'Affordable'],
    bestFor: ['Topic Ranking'],
  },
];

// ─── Legacy Models ──────────────────────────────────────────────────────────

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
    fallbackProvider: 'openrouter',
    fallbackModelId: 'anthropic/claude-sonnet-4.5',
    tags: ['Legacy'],
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
    fallbackProvider: 'openrouter',
    fallbackModelId: 'anthropic/claude-opus-4.5',
    tags: ['Legacy'],
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
