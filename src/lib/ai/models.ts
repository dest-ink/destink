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
}

// ─── Current Models ─────────────────────────────────────────────────────────

export const CURRENT_MODELS: ModelDefinition[] = [
  {
    id: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    description: 'Most intelligent model for agents and coding. Best writing quality.',
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    pricing: { inputPer1M: 5, outputPer1M: 25 },
    tier: 'current',
  },
  {
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    description: 'Best combination of speed and intelligence. Great for most tasks.',
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    pricing: { inputPer1M: 3, outputPer1M: 15 },
    tier: 'current',
  },
  {
    id: 'claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    description: 'Fastest and most cost-effective. Good for simple, high-volume tasks.',
    contextWindow: 200_000,
    maxOutput: 64_000,
    pricing: { inputPer1M: 1, outputPer1M: 5 },
    tier: 'current',
  },
];

// ─── Legacy Models (still active) ───────────────────────────────────────────

export const LEGACY_MODELS: ModelDefinition[] = [
  {
    id: 'claude-sonnet-4-5',
    displayName: 'Claude Sonnet 4.5',
    description: 'Previous generation Sonnet. Fast with good intelligence.',
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    pricing: { inputPer1M: 3, outputPer1M: 15 },
    tier: 'legacy',
  },
  {
    id: 'claude-opus-4-5',
    displayName: 'Claude Opus 4.5',
    description: 'Previous generation Opus. Strong reasoning.',
    contextWindow: 200_000,
    maxOutput: 64_000,
    pricing: { inputPer1M: 5, outputPer1M: 25 },
    tier: 'legacy',
  },
  {
    id: 'claude-opus-4-1',
    displayName: 'Claude Opus 4.1',
    description: 'Legacy Opus. Good reasoning at higher cost.',
    contextWindow: 200_000,
    maxOutput: 32_000,
    pricing: { inputPer1M: 15, outputPer1M: 75 },
    tier: 'legacy',
  },
  {
    id: 'claude-sonnet-4-0',
    displayName: 'Claude Sonnet 4',
    description: 'Legacy Sonnet. Balanced speed and quality.',
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    pricing: { inputPer1M: 3, outputPer1M: 15 },
    tier: 'legacy',
  },
  {
    id: 'claude-opus-4-0',
    displayName: 'Claude Opus 4',
    description: 'Legacy Opus. Good reasoning at higher cost.',
    contextWindow: 200_000,
    maxOutput: 32_000,
    pricing: { inputPer1M: 15, outputPer1M: 75 },
    tier: 'legacy',
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
