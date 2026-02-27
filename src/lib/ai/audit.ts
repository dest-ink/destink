import { db } from '@/db/client';
import { aiAuditLog } from '@/db/schema';

// Anthropic pricing (USD per token) — verify at console.anthropic.com/pricing
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6':           { input: 15 / 1_000_000,  output: 75 / 1_000_000 },
  'claude-sonnet-4-6':         { input: 3 / 1_000_000,   output: 15 / 1_000_000 },
  'claude-haiku-4-5-20251001': { input: 0.8 / 1_000_000, output: 4 / 1_000_000  },
};

export function computeCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  return pricing.input * promptTokens + pricing.output * completionTokens;
}

export interface AuditEntry {
  operation: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  channelId?: string;
  entityType?: string;
  entityId?: string;
}

export async function logAiCall(entry: AuditEntry): Promise<void> {
  const costUsd = computeCost(entry.model, entry.promptTokens, entry.completionTokens);
  await db.insert(aiAuditLog).values({
    operation: entry.operation,
    model: entry.model,
    promptTokens: entry.promptTokens,
    completionTokens: entry.completionTokens,
    costUsd: costUsd.toFixed(6),
    channelId: entry.channelId ?? null,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
  });
}
