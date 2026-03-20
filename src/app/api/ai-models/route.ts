import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import Anthropic from '@anthropic-ai/sdk';
import { CURRENT_MODELS, getModelPricing } from '@/lib/ai/models';

export const GET = auth(function GET(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await client.models.list({ limit: 50 });

      // Only show current models — filter API results to match our curated list
      const currentIds = new Set(CURRENT_MODELS.map(m => m.id));
      const models = CURRENT_MODELS.map(def => {
        const apiModel = response.data.find(m => m.id === def.id || m.display_name === def.displayName);
        const mAny = apiModel as unknown as Record<string, unknown> | undefined;
        return {
          id: def.id,
          displayName: def.displayName,
          description: def.description,
          maxInputTokens: (mAny?.max_input_tokens as number) ?? def.contextWindow,
          maxOutputTokens: (mAny?.max_tokens as number) ?? def.maxOutput,
          pricing: def.pricing,
        };
      });

      return NextResponse.json(models);
    } catch (err) {
      console.error('[ai-models] Failed to fetch from API, using fallback:', err);
      return NextResponse.json(
        CURRENT_MODELS.map(m => ({
          id: m.id,
          displayName: m.displayName,
          description: m.description,
          maxInputTokens: m.contextWindow,
          maxOutputTokens: m.maxOutput,
          pricing: m.pricing,
        }))
      );
    }
  })();
});
