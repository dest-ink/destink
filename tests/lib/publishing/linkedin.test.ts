import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { drafts, channels } from '@/db/schema';

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn(),
}));

import { decrypt } from '@/lib/crypto';
import { formatForLinkedIn, publishToLinkedIn } from '@/lib/publishing/linkedin';

const mockDecrypt = vi.mocked(decrypt);

// ─── Fixtures ────────────────────────────────────────────────────────────────

type DraftRow = typeof drafts.$inferSelect;
type ChannelRow = typeof channels.$inferSelect;

function makeDraft(overrides: Partial<DraftRow> = {}): DraftRow {
  return {
    id: 'draft-1',
    channelId: 'chan-1',
    researchRunId: null,
    contentType: 'note',
    title: null,
    headlineOptions: null,
    hook: 'This is the hook.',
    body: 'This is the body.',
    cta: 'Follow for more.',
    voiceConfidence: null,
    researchSources: null,
    aiModel: null,
    promptTokens: null,
    completionTokens: null,
    status: 'pending_review',
    rejectionReason: null,
    regenerationNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeChannel(overrides: Partial<ChannelRow> = {}): ChannelRow {
  return {
    id: 'chan-1',
    name: 'Test LinkedIn Channel',
    platform: 'linkedin',
    platformId: null,
    personaPrompt: null,
    researchConfig: null,
    scheduleConfig: null,
    credentials: 'encrypted-blob',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const VALID_CREDS = JSON.stringify({
  accessToken: 'tok-abc123',
  personUrn: 'urn:li:person:XYZ',
});

const ENC_KEY = 'a'.repeat(64);

// Helper to stub fetch with a successful response
function stubFetchSuccess(id = 'urn:li:ugcPost:12345') {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    statusText: 'Created',
    json: vi.fn().mockResolvedValue({ id }),
  });
  vi.stubGlobal('fetch', mockFetch);
  return mockFetch;
}

// ─── formatForLinkedIn ───────────────────────────────────────────────────────

describe('formatForLinkedIn', () => {
  it('joins hook, body, and cta with double newlines', () => {
    const draft = makeDraft({ hook: 'Hook text', body: 'Body text', cta: 'CTA text' });
    expect(formatForLinkedIn(draft)).toBe('Hook text\n\nBody text\n\nCTA text');
  });

  it('omits null hook', () => {
    const draft = makeDraft({ hook: null, body: 'Body', cta: 'CTA' });
    expect(formatForLinkedIn(draft)).toBe('Body\n\nCTA');
  });

  it('omits null body', () => {
    const draft = makeDraft({ hook: 'Hook', body: null, cta: 'CTA' });
    expect(formatForLinkedIn(draft)).toBe('Hook\n\nCTA');
  });

  it('omits null cta', () => {
    const draft = makeDraft({ hook: 'Hook', body: 'Body', cta: null });
    expect(formatForLinkedIn(draft)).toBe('Hook\n\nBody');
  });

  it('omits empty-string sections', () => {
    const draft = makeDraft({ hook: '', body: 'Body', cta: '' });
    expect(formatForLinkedIn(draft)).toBe('Body');
  });

  it('omits whitespace-only sections', () => {
    const draft = makeDraft({ hook: '   ', body: 'Body', cta: '\t' });
    expect(formatForLinkedIn(draft)).toBe('Body');
  });

  it('returns empty string when all sections are null', () => {
    const draft = makeDraft({ hook: null, body: null, cta: null });
    expect(formatForLinkedIn(draft)).toBe('');
  });

  it('does not truncate text at exactly 3000 characters', () => {
    const text = 'x'.repeat(3000);
    const draft = makeDraft({ hook: text, body: null, cta: null });
    const result = formatForLinkedIn(draft);
    expect(result).toHaveLength(3000);
    expect(result.endsWith('...')).toBe(false);
  });

  it('does not truncate text at 2999 characters', () => {
    const text = 'x'.repeat(2999);
    const draft = makeDraft({ hook: text, body: null, cta: null });
    const result = formatForLinkedIn(draft);
    expect(result).toHaveLength(2999);
    expect(result.endsWith('...')).toBe(false);
  });

  it('truncates text over 3000 characters to exactly 3000 with ellipsis', () => {
    const text = 'x'.repeat(3001);
    const draft = makeDraft({ hook: text, body: null, cta: null });
    const result = formatForLinkedIn(draft);
    expect(result).toHaveLength(3000);
    expect(result.endsWith('...')).toBe(true);
  });

  it('truncates a 5000-character text to 3000 chars ending with ...', () => {
    const text = 'a'.repeat(5000);
    const draft = makeDraft({ hook: text, body: null, cta: null });
    const result = formatForLinkedIn(draft);
    expect(result).toHaveLength(3000);
    expect(result.endsWith('...')).toBe(true);
    expect(result.slice(0, 2997)).toBe('a'.repeat(2997));
  });

  it('truncates correctly when the cut falls within the section separator', () => {
    // hook (2998) + '\n\n' + body => total > 3000, cut lands in the separator
    const hook = 'h'.repeat(2998);
    const draft = makeDraft({ hook, body: 'body text', cta: null });
    const result = formatForLinkedIn(draft);
    expect(result).toHaveLength(3000);
    expect(result.endsWith('...')).toBe(true);
  });
});

// ─── publishToLinkedIn ───────────────────────────────────────────────────────

describe('publishToLinkedIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENCRYPTION_KEY = ENC_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws for article content type', async () => {
    const draft = makeDraft({ contentType: 'article' });
    await expect(publishToLinkedIn(draft, makeChannel())).rejects.toThrow(
      'Article publishing is not supported by the LinkedIn API',
    );
  });

  it('throws when channel has no credentials', async () => {
    const draft = makeDraft();
    const channel = makeChannel({ credentials: null });
    await expect(publishToLinkedIn(draft, channel)).rejects.toThrow(
      'LinkedIn channel has no credentials configured',
    );
  });

  it('throws when ENCRYPTION_KEY is not set', async () => {
    delete process.env.ENCRYPTION_KEY;
    await expect(publishToLinkedIn(makeDraft(), makeChannel())).rejects.toThrow(
      'ENCRYPTION_KEY env var is not set',
    );
  });

  it('throws when decrypt returns null', async () => {
    mockDecrypt.mockReturnValue(null);
    await expect(publishToLinkedIn(makeDraft(), makeChannel())).rejects.toThrow(
      'Failed to decrypt LinkedIn credentials',
    );
  });

  it('throws when credentials are missing required fields', async () => {
    mockDecrypt.mockReturnValue(JSON.stringify({ accessToken: 'tok' })); // missing personUrn
    await expect(publishToLinkedIn(makeDraft(), makeChannel())).rejects.toThrow(
      'LinkedIn credentials missing required fields: accessToken, personUrn',
    );
  });

  it('throws when draft has no content', async () => {
    mockDecrypt.mockReturnValue(VALID_CREDS);
    const draft = makeDraft({ hook: null, body: null, cta: null });
    await expect(publishToLinkedIn(draft, makeChannel())).rejects.toThrow(
      'Draft has no content to publish',
    );
  });

  it('throws when draft has only whitespace content', async () => {
    mockDecrypt.mockReturnValue(VALID_CREDS);
    const draft = makeDraft({ hook: '   ', body: null, cta: null });
    await expect(publishToLinkedIn(draft, makeChannel())).rejects.toThrow(
      'Draft has no content to publish',
    );
  });

  it('throws with status code when LinkedIn API returns non-2xx', async () => {
    mockDecrypt.mockReturnValue(VALID_CREDS);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: vi.fn(),
    }));
    await expect(publishToLinkedIn(makeDraft(), makeChannel())).rejects.toThrow(
      'LinkedIn API error: 422 Unprocessable Entity',
    );
  });

  it('omits statusText from error when empty (HTTP/2)', async () => {
    mockDecrypt.mockReturnValue(VALID_CREDS);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: '',
      json: vi.fn(),
    }));
    await expect(publishToLinkedIn(makeDraft(), makeChannel())).rejects.toThrow(
      'LinkedIn API error: 429',
    );
  });

  it('throws when API response has no string id', async () => {
    mockDecrypt.mockReturnValue(VALID_CREDS);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      statusText: 'Created',
      json: vi.fn().mockResolvedValue({ id: 12345 }), // numeric, not string
    }));
    await expect(publishToLinkedIn(makeDraft(), makeChannel())).rejects.toThrow(
      'LinkedIn API returned unexpected response shape',
    );
  });

  it('propagates network-level fetch rejection', async () => {
    mockDecrypt.mockReturnValue(VALID_CREDS);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(publishToLinkedIn(makeDraft(), makeChannel())).rejects.toThrow(
      'ECONNREFUSED',
    );
  });

  it('returns LinkedInPublishResult with id on success', async () => {
    mockDecrypt.mockReturnValue(VALID_CREDS);
    stubFetchSuccess('urn:li:ugcPost:12345');
    const result = await publishToLinkedIn(makeDraft(), makeChannel());
    expect(result).toEqual({ id: 'urn:li:ugcPost:12345' });
  });

  it('calls fetch with the correct URL', async () => {
    mockDecrypt.mockReturnValue(VALID_CREDS);
    const mockFetch = stubFetchSuccess();

    await publishToLinkedIn(makeDraft(), makeChannel());
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.linkedin.com/v2/ugcPosts',
      expect.anything(),
    );
  });

  it('calls fetch with correct Authorization and protocol headers', async () => {
    mockDecrypt.mockReturnValue(VALID_CREDS);
    const mockFetch = stubFetchSuccess();

    await publishToLinkedIn(makeDraft(), makeChannel());

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok-abc123');
    expect(headers['X-Restli-Protocol-Version']).toBe('2.0.0');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('calls fetch with correctly shaped ugcPosts body', async () => {
    mockDecrypt.mockReturnValue(VALID_CREDS);
    const mockFetch = stubFetchSuccess();

    const draft = makeDraft({ hook: 'Hook', body: 'Body', cta: 'CTA' });
    await publishToLinkedIn(draft, makeChannel());

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);

    expect(body.author).toBe('urn:li:person:XYZ');
    expect(body.lifecycleState).toBe('PUBLISHED');
    expect(
      body.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text,
    ).toBe('Hook\n\nBody\n\nCTA');
    expect(
      body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory,
    ).toBe('NONE');
    expect(body.visibility['com.linkedin.ugc.MemberNetworkVisibility']).toBe('PUBLIC');
  });
});
