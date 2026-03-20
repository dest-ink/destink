import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { CURRENT_MODELS } from '@/lib/ai/models';
import { getConfiguredProviders } from '@/lib/ai/providers/registry';

export const GET = auth(function GET(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    // Only show models from providers that are configured (have API keys)
    const configuredProviders = new Set(getConfiguredProviders().map(p => p.id));

    const models = CURRENT_MODELS
      .filter(m => configuredProviders.has(m.provider))
      .map(m => ({
        id: m.id,
        displayName: m.displayName,
        description: m.description,
        maxInputTokens: m.contextWindow,
        maxOutputTokens: m.maxOutput,
        pricing: m.pricing,
        provider: m.provider,
      }));

    return NextResponse.json(models);
  })();
});
