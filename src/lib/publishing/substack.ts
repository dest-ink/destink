import { SubstackClient } from '@destink/substack-sdk';
import type { drafts, channels } from '@/db/schema';
import { decrypt } from '@/lib/crypto';

type DraftRow = typeof drafts.$inferSelect;
type ChannelRow = typeof channels.$inferSelect;

interface SubstackCredentials {
  publicationUrl: string;
  substackSid: string;
  substackLli: string;
  handle: string;
}

export interface SubstackPublishResult {
  id: number;
}

/**
 * Format draft content for Substack publication.
 * Combines hook, body, and CTA into a single plain-text string separated by
 * blank lines. Null/empty sections are omitted.
 * Pure function — useful for testing without network calls.
 */
export function formatForSubstack(draft: DraftRow): string {
  return [draft.hook, draft.body, draft.cta].filter(s => s?.trim()).join('\n\n');
}

/**
 * Decode and decrypt channel credentials into SubstackCredentials.
 * Throws if credentials are missing, malformed, or tampered.
 */
function parseCredentials(channel: ChannelRow): SubstackCredentials {
  if (!channel.credentials) {
    throw new Error('Substack channel has no credentials configured');
  }

  const encKey = process.env.ENCRYPTION_KEY;
  if (!encKey) {
    throw new Error('ENCRYPTION_KEY env var is not set');
  }

  const plaintext = decrypt(channel.credentials, encKey);
  if (!plaintext) {
    throw new Error(
      'Failed to decrypt Substack credentials — key mismatch or tampered data',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error('Substack credentials are not valid JSON');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).publicationUrl !== 'string' ||
    typeof (parsed as Record<string, unknown>).substackSid !== 'string' ||
    typeof (parsed as Record<string, unknown>).substackLli !== 'string' ||
    typeof (parsed as Record<string, unknown>).handle !== 'string'
  ) {
    throw new Error(
      'Substack credentials missing required fields: publicationUrl, substackSid, substackLli, handle',
    );
  }

  return parsed as SubstackCredentials;
}

/**
 * Publish a draft to Substack.
 *
 * - 'note' content type → published as a Substack Note.
 * - 'article' content type → not yet supported; throws an error.
 *
 * Credentials stored in channel.credentials must decrypt to JSON of the shape:
 *   { publicationUrl: string, substackSid: string, substackLli: string, handle: string }
 */
export async function publishToSubstack(
  draft: DraftRow,
  channel: ChannelRow,
): Promise<SubstackPublishResult> {
  if (draft.contentType === 'article') {
    throw new Error(
      'Article publishing is not yet supported. ' +
        'Only notes (contentType: "note") can be published programmatically.',
    );
  }

  const creds = parseCredentials(channel);

  const text = formatForSubstack(draft);
  if (!text.trim()) {
    throw new Error('Draft has no content to publish');
  }

  const client = new SubstackClient({
    publicationUrl: creds.publicationUrl,
    substackSid: creds.substackSid,
    substackLli: creds.substackLli,
    handle: creds.handle,
  });

  try {
    const profile = await client.ownProfile();
    const response = await profile.publishNote(text);
    return { id: response.id };
  } finally {
    await client.close();
  }
}
