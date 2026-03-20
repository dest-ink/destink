import { logAiCall, type AuditEntry } from './audit';
import { resolveProvider } from './providers/registry';
import type { AiCallOptions } from './providers/types';

// Model IDs are defined in src/lib/ai/models.ts — the single source of truth.
export type ClaudeModel = string;

export interface CallModelOptions extends AiCallOptions {
  audit: Omit<AuditEntry, 'model' | 'promptTokens' | 'completionTokens'>;
}

/**
 * Universal model caller — routes to the correct provider (Anthropic, OpenRouter, etc.)
 * based on the model ID, and logs usage to ai_audit_log.
 *
 * This is the ONLY function the rest of the app should call for AI completions.
 */
export async function callClaude(options: CallModelOptions): Promise<string> {
  const { model, system, prompt, maxTokens, audit } = options;

  const provider = resolveProvider(model);
  const result = await provider.call({ model, system, prompt, maxTokens });

  // Log usage
  try {
    await logAiCall({
      ...audit,
      model: result.model,
      promptTokens: result.inputTokens,
      completionTokens: result.outputTokens,
    });
  } catch (err) {
    console.error('[callClaude] audit log failed:', err);
  }

  return stripCodeFences(result.text);
}

// Keep backward compatibility — same export name, same interface
export { callClaude as callModel };

/** Strip markdown code fences (```json ... ```) that models sometimes add. */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    const firstNewline = trimmed.indexOf('\n');
    if (firstNewline === -1) return trimmed;
    const body = trimmed.slice(firstNewline + 1);
    const lastFence = body.lastIndexOf('```');
    return (lastFence !== -1 ? body.slice(0, lastFence) : body).trim();
  }
  return trimmed;
}
