/**
 * Provider abstraction types for AI model calls.
 *
 * To add a new provider:
 * 1. Create a new file in this directory implementing AiProvider
 * 2. Register it in the provider registry (registry.ts)
 * 3. Add models to src/lib/ai/models.ts with the correct provider prefix
 */

export interface AiCallOptions {
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface AiCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface AiProvider {
  /** Unique provider identifier (e.g., 'anthropic', 'openrouter') */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Whether this provider is configured (has API key, etc.) */
  isConfigured(): boolean;

  /** Execute a completion call */
  call(options: AiCallOptions): Promise<AiCallResult>;
}
