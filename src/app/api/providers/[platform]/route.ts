import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { publisherRegistry, initPublisherRegistry } from '@/lib/publishing/publisher-registry';

/**
 * Replace {ENV_VAR} placeholders with their values from process.env.
 * Only replaces vars that are set — unresolved placeholders are left as-is.
 */
function resolveVars(text: string): string {
  return text.replace(/\{([A-Z_][A-Z0-9_]*)\}/g, (_match, varName) => {
    return process.env[varName] ?? `{${varName}}`;
  });
}

/** Deep-resolve all string values in an object. */
function resolveDeep<T>(obj: T): T {
  if (typeof obj === 'string') return resolveVars(obj) as T;
  if (Array.isArray(obj)) return obj.map(resolveDeep) as T;
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = resolveDeep(v);
    }
    return result as T;
  }
  return obj;
}

/**
 * GET /api/providers/:platform — returns the provider's metadata and configSchema.
 * All {ENV_VAR} placeholders in string fields are resolved server-side.
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

    const data = {
      name: provider.name,
      platform: provider.platform,
      displayName: provider.displayName,
      description: provider.description,
      configSchema: provider.configSchema,
      oauth: provider.oauth ?? null,
    };

    return NextResponse.json(resolveDeep(data));
  })();
});
