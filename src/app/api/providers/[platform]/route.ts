import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { publisherRegistry, initPublisherRegistry } from '@/lib/publishing/publisher-registry';

/**
 * GET /api/providers/:platform — returns the provider's metadata and configSchema.
 */
export const GET = auth(function GET(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    const { platform } = await (ctx?.params as Promise<{ platform: string }>);
    await initPublisherRegistry();
    const provider = publisherRegistry.get(platform);

    if (!provider) {
      return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 404 });
    }

    return NextResponse.json({
      name: provider.name,
      platform: provider.platform,
      displayName: provider.displayName,
      description: provider.description,
      configSchema: provider.configSchema,
    });
  })();
});
