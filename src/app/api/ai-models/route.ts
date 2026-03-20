import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import Anthropic from '@anthropic-ai/sdk';

// Static pricing since the API doesn't expose it
const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'claude-opus-4-6': { inputPer1M: 5, outputPer1M: 25 },
  'claude-sonnet-4-6': { inputPer1M: 3, outputPer1M: 15 },
  'claude-haiku-4-5-20251001': { inputPer1M: 1, outputPer1M: 5 },
  'claude-opus-4-5-20251101': { inputPer1M: 5, outputPer1M: 25 },
  'claude-sonnet-4-5-20250929': { inputPer1M: 3, outputPer1M: 15 },
  'claude-opus-4-1-20250805': { inputPer1M: 15, outputPer1M: 75 },
  'claude-sonnet-4-20250514': { inputPer1M: 3, outputPer1M: 15 },
  'claude-opus-4-20250514': { inputPer1M: 15, outputPer1M: 75 },
};

// Map full IDs to aliases
const ALIASES: Record<string, string> = {
  'claude-haiku-4-5-20251001': 'claude-haiku-4-5',
  'claude-sonnet-4-5-20250929': 'claude-sonnet-4-5',
  'claude-opus-4-5-20251101': 'claude-opus-4-5',
  'claude-opus-4-1-20250805': 'claude-opus-4-1',
  'claude-sonnet-4-20250514': 'claude-sonnet-4-0',
  'claude-opus-4-20250514': 'claude-opus-4-0',
};

export const GET = auth(function GET(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await client.models.list({ limit: 50 });

      const models = response.data.map(m => {
        const alias = ALIASES[m.id] ?? m.id;
        const pricing = PRICING[m.id] ?? PRICING[alias];
        const mAny = m as unknown as Record<string, unknown>;
        return {
          id: alias,
          fullId: m.id,
          displayName: m.display_name,
          maxInputTokens: (mAny.max_input_tokens as number) ?? null,
          maxOutputTokens: (mAny.max_tokens as number) ?? null,
          pricing: pricing ?? null,
          createdAt: m.created_at,
        };
      });

      // Deduplicate by alias (prefer the one with pricing)
      const seen = new Map<string, typeof models[0]>();
      for (const m of models) {
        if (!seen.has(m.id) || (m.pricing && !seen.get(m.id)!.pricing)) {
          seen.set(m.id, m);
        }
      }

      return NextResponse.json(Array.from(seen.values()));
    } catch (err) {
      console.error('[ai-models] Failed to fetch models:', err);
      // Fallback to static list
      return NextResponse.json([
        { id: 'claude-opus-4-6', displayName: 'Claude Opus 4.6', pricing: PRICING['claude-opus-4-6'], maxInputTokens: 1000000, maxOutputTokens: 128000 },
        { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', pricing: PRICING['claude-sonnet-4-6'], maxInputTokens: 1000000, maxOutputTokens: 64000 },
        { id: 'claude-haiku-4-5', displayName: 'Claude Haiku 4.5', pricing: PRICING['claude-haiku-4-5-20251001'], maxInputTokens: 200000, maxOutputTokens: 64000 },
      ]);
    }
  })();
});
