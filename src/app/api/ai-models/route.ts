import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import Anthropic from '@anthropic-ai/sdk';
import { ALL_MODELS, CURRENT_MODELS, getModelPricing } from '@/lib/ai/models';

export const GET = auth(function GET(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await client.models.list({ limit: 50 });

      const models = response.data.map(m => {
        const pricing = getModelPricing(m.id);
        const mAny = m as unknown as Record<string, unknown>;
        return {
          id: m.id,
          displayName: m.display_name,
          maxInputTokens: (mAny.max_input_tokens as number) ?? null,
          maxOutputTokens: (mAny.max_tokens as number) ?? null,
          pricing: pricing ?? null,
          createdAt: m.created_at,
        };
      });

      // Also include models from our constants that might not be in the API response
      // (in case the API returns fewer models)
      const apiIds = new Set(models.map(m => m.id));
      for (const def of ALL_MODELS) {
        if (!apiIds.has(def.id)) {
          models.push({
            id: def.id,
            displayName: def.displayName,
            maxInputTokens: def.contextWindow,
            maxOutputTokens: def.maxOutput,
            pricing: def.pricing,
            createdAt: '',
          });
        }
      }

      return NextResponse.json(models);
    } catch (err) {
      console.error('[ai-models] Failed to fetch from API, using fallback:', err);
      // Fallback to our constants
      return NextResponse.json(
        CURRENT_MODELS.map(m => ({
          id: m.id,
          displayName: m.displayName,
          maxInputTokens: m.contextWindow,
          maxOutputTokens: m.maxOutput,
          pricing: m.pricing,
          createdAt: '',
        }))
      );
    }
  })();
});
