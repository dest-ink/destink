import type { drafts, channels } from '@/db/schema';
import { decrypt } from '@/lib/crypto';

type DraftRow = typeof drafts.$inferSelect;
type ChannelRow = typeof channels.$inferSelect;

const LINKEDIN_NOTE_MAX = 3000;
const UGCPOSTS_URL = 'https://api.linkedin.com/v2/ugcPosts';

interface LinkedInCredentials {
  accessToken: string;
  personUrn: string;
}

export interface LinkedInPublishResult {
  id: string;
}

/**
 * Format draft content for LinkedIn publication.
 * Combines hook, body, and CTA into a single plain-text string separated by
 * blank lines. Null/empty sections are omitted.
 * Truncates to 3000 characters (LinkedIn note limit) with trailing ellipsis.
 * Pure function — useful for testing without network calls.
 */
export function formatForLinkedIn(draft: DraftRow): string {
  const text = [draft.hook, draft.body, draft.cta].filter(Boolean).join('\n\n');
  if (text.length <= LINKEDIN_NOTE_MAX) {
    return text;
  }
  return text.slice(0, LINKEDIN_NOTE_MAX - 3) + '...';
}

/**
 * Decode and decrypt channel credentials into LinkedInCredentials.
 * Throws if credentials are missing, malformed, or tampered.
 */
export function parseLinkedInCredentials(channel: ChannelRow): LinkedInCredentials {
  if (!channel.credentials) {
    throw new Error('LinkedIn channel has no credentials configured');
  }

  const encKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!encKey) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY env var is not set');
  }

  const plaintext = decrypt(channel.credentials, encKey);
  if (!plaintext) {
    throw new Error(
      'Failed to decrypt LinkedIn credentials — key mismatch or tampered data',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error('LinkedIn credentials are not valid JSON');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).accessToken !== 'string' ||
    typeof (parsed as Record<string, unknown>).personUrn !== 'string'
  ) {
    throw new Error(
      'LinkedIn credentials missing required fields: accessToken, personUrn',
    );
  }

  return parsed as LinkedInCredentials;
}

/**
 * Publish a draft to LinkedIn via the ugcPosts API.
 *
 * - 'note' content type → published as a LinkedIn text post via ugcPosts.
 * - 'article' content type → not supported; throws an error.
 *
 * Credentials stored in channel.credentials must decrypt to JSON of the shape:
 *   { accessToken: string, personUrn: string }
 */
export async function publishToLinkedIn(
  draft: DraftRow,
  channel: ChannelRow,
): Promise<LinkedInPublishResult> {
  if (draft.contentType === 'article') {
    throw new Error(
      'Article publishing is not supported by the LinkedIn API. ' +
        'Only notes (contentType: "note") can be published programmatically.',
    );
  }

  const creds = parseLinkedInCredentials(channel);

  const text = formatForLinkedIn(draft);
  if (!text.trim()) {
    throw new Error('Draft has no content to publish');
  }

  const requestBody = {
    author: creds.personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const response = await fetch(UGCPOSTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(
      `LinkedIn API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { id: string };
  return { id: data.id };
}
