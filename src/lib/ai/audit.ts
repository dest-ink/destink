import { db } from '@/db/client';
import { aiAuditLog } from '@/db/schema';
import { getModelPricing } from './models';

export function computeCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = getModelPricing(model);
  if (!pricing) return 0;
  const inputCost = (pricing.inputPer1M / 1_000_000) * promptTokens;
  const outputCost = (pricing.outputPer1M / 1_000_000) * completionTokens;
  return inputCost + outputCost;
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
