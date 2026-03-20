import Anthropic from '@anthropic-ai/sdk';
import { logAiCall, type AuditEntry } from './audit';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type ClaudeModel =
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5-20251001'
  | 'claude-haiku-4-5'
  | 'claude-opus-4-5'
  | 'claude-sonnet-4-5'
  | 'claude-opus-4-1'
  | 'claude-sonnet-4-0'
  | 'claude-opus-4-0'
  | (string & {});

export interface CallClaudeOptions {
  model: ClaudeModel;
  system: string;
  prompt: string;
  maxTokens?: number;
  audit: Omit<AuditEntry, 'model' | 'promptTokens' | 'completionTokens'>;
}

/**
 * Calls Claude and automatically logs usage to ai_audit_log.
 * Returns the text content of the response.
 */
export async function callClaude(options: CallClaudeOptions): Promise<string> {
  const { model, system, prompt, maxTokens = 4096, audit } = options;

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  // Always log token usage — even on unexpected response types
  try {
    await logAiCall({
      ...audit,
      model,
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
    });
  } catch (err) {
    // Audit failure must never mask a successful AI response
    console.error('[callClaude] audit log failed:', err);
  }

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error(`Unexpected Claude response type: ${content.type}`);
  }

  return stripCodeFences(content.text);
}

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
