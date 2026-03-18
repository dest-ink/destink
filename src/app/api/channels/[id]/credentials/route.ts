import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';
import { encrypt, decrypt } from '@/lib/crypto';
import { publisherRegistry, initPublisherRegistry } from '@/lib/publishing/publisher-registry';

/**
 * GET — returns whether credentials are configured (never returns the actual values).
 */
export const GET = auth(function GET(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const { id } = await (ctx?.params as Promise<{ id: string }>);
      const [channel] = await db
        .select({ credentials: channels.credentials, platform: channels.platform })
        .from(channels)
        .where(eq(channels.id, id));

      if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const encKey = process.env.ENCRYPTION_KEY;
      if (!encKey || !channel.credentials) {
        return NextResponse.json({ configured: false, fields: [] });
      }

      // Decrypt and return masked values (first 4 chars + ******)
      const plaintext = decrypt(channel.credentials, encKey);
      if (!plaintext) {
        return NextResponse.json({ configured: false, values: {} });
      }

      try {
        const parsed = JSON.parse(plaintext) as Record<string, string>;

        // Look up provider schema to know which fields are secrets
        await initPublisherRegistry();
        const provider = publisherRegistry.get(channel.platform);
        const secretKeys = new Set(
          provider?.configSchema
            .filter(f => f.type === 'secret')
            .map(f => f.key) ?? [],
        );

        // Mask secret values server-side, return non-secrets in full
        const masked: Record<string, string> = {};
        for (const [key, val] of Object.entries(parsed)) {
          if (typeof val === 'string' && val.length > 0) {
            masked[key] = secretKeys.has(key) ? val.slice(0, 4) + '******' : val;
          }
        }
        return NextResponse.json({ configured: true, values: masked });
      } catch {
        return NextResponse.json({ configured: false, values: {} });
      }
    } catch (err) {
      const { message, status } = apiError('check credentials', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});

/**
 * PUT — encrypts and stores channel credentials.
 * Body shape depends on platform:
 *   substack: { publicationUrl, handle, substackSid, substackLli }
 */
export const PUT = auth(function PUT(req, ctx) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const { id } = await (ctx?.params as Promise<{ id: string }>);
      const body = await req.json();

      const encKey = process.env.ENCRYPTION_KEY;
      if (!encKey) {
        return NextResponse.json(
          { error: 'ENCRYPTION_KEY is not configured on the server' },
          { status: 500 },
        );
      }

      // Validate based on what's provided
      if (typeof body !== 'object' || body === null) {
        return NextResponse.json({ error: 'Invalid credentials payload' }, { status: 400 });
      }

      const encrypted = encrypt(JSON.stringify(body), encKey);

      const [updated] = await db
        .update(channels)
        .set({ credentials: encrypted, updatedAt: new Date() })
        .where(eq(channels.id, id))
        .returning({ id: channels.id });

      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      return NextResponse.json({ ok: true });
    } catch (err) {
      const { message, status } = apiError('update credentials', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
