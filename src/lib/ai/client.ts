import Anthropic from '@anthropic-ai/sdk';
import { logAiCall, type AuditEntry } from './audit';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type ClaudeModel =
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5-20251001';

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

  return content.text;
}
