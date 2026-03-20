import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { CURRENT_MODELS } from '@/lib/ai/models';
import { getConfiguredProviders } from '@/lib/ai/providers/registry';

export const GET = auth(function GET(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    // Show models from configured providers, including models that can fall back
    const configured = await getConfiguredProviders();
    const configuredIds = new Set(configured.map(p => p.id));

    const models = CURRENT_MODELS
      .filter(m => configuredIds.has(m.provider) || (m.fallbackProvider && configuredIds.has(m.fallbackProvider)))
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
