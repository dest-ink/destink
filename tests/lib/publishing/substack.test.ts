import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('substack-api', () => ({
  SubstackClient: vi.fn(),
}));

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn(),
}));

import { SubstackClient } from 'substack-api';
import { decrypt } from '@/lib/crypto';
import { formatForSubstack, publishToSubstack } from '@/lib/publishing/substack';
import type { drafts, channels } from '@/db/schema';

type DraftRow = typeof drafts.$inferSelect;
type ChannelRow = typeof channels.$inferSelect;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDraft(overrides: Partial<DraftRow> = {}): DraftRow {
  return {
    id: 'draft-1',
    channelId: 'channel-1',
    researchRunId: null,
    contentType: 'note',
    title: null,
    headlineOptions: null,
    hook: 'This is a hook.',
    body: 'This is the body.',
    cta: 'Follow for more.',
    voiceConfidence: null,
    researchSources: null,
    aiModel: null,
    promptTokens: null,
    completionTokens: null,
    status: 'approved',
    rejectionReason: null,
    regenerationNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeChannel(overrides: Partial<ChannelRow> = {}): ChannelRow {
  return {
    id: 'channel-1',
    userId: 'user-1',
    name: 'My Substack',
    platform: 'substack',
    platformId: null,
    personaPrompt: null,
    researchConfig: null,
    scheduleConfig: null,
    credentials: 'encrypted-creds',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const VALID_CREDS = JSON.stringify({
  publicationUrl: 'https://example.substack.com',
  token: 'tok123',
});

// ─── formatForSubstack ────────────────────────────────────────────────────────

describe('formatForSubstack', () => {
  it('joins hook, body, and CTA with double newlines', () => {
    const draft = makeDraft({ hook: 'Hook', body: 'Body', cta: 'CTA' });
    expect(formatForSubstack(draft)).toBe('Hook\n\nBody\n\nCTA');
  });

  it('omits null sections', () => {
    const draft = makeDraft({ hook: null, body: 'Body only', cta: null });
    expect(formatForSubstack(draft)).toBe('Body only');
  });

  it('returns empty string when all parts are null', () => {
    const draft = makeDraft({ hook: null, body: null, cta: null });
    expect(formatForSubstack(draft)).toBe('');
  });

  it('omits empty-string sections', () => {
    const draft = makeDraft({ hook: '', body: 'Body', cta: '' });
    expect(formatForSubstack(draft)).toBe('Body');
  });

  it('omits whitespace-only sections', () => {
    const draft = makeDraft({ hook: '   ', body: 'Body', cta: '\t' });
    expect(formatForSubstack(draft)).toBe('Body');
  });
});

// ─── publishToSubstack ────────────────────────────────────────────────────────

describe('publishToSubstack', () => {
  // Build a fresh mock client chain before each test
  let mockPublish: ReturnType<typeof vi.fn>;
  let paragraphBuilder: { text: ReturnType<typeof vi.fn>; publish: ReturnType<typeof vi.fn> };
  let mockParagraph: ReturnType<typeof vi.fn>;
  let mockNewNote: ReturnType<typeof vi.fn>;
  let mockOwnProfile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32-byte key in hex

    mockPublish = vi.fn().mockResolvedValue({ id: 42, date: '2024-01-01T00:00:00Z' });
    paragraphBuilder = {
      text: vi.fn(function () { return paragraphBuilder; }),
      publish: mockPublish,
    };
    mockParagraph = vi.fn().mockReturnValue(paragraphBuilder);
    mockNewNote = vi.fn().mockReturnValue({ paragraph: mockParagraph });
    mockOwnProfile = vi.fn().mockResolvedValue({ newNote: mockNewNote });

    // Must use a regular function (not arrow) so it can be called with `new`
    vi.mocked(SubstackClient).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function (this: any) { this.ownProfile = mockOwnProfile; } as any,
    );
  });

  it('throws for article content type', async () => {
    const draft = makeDraft({ contentType: 'article' });
    await expect(publishToSubstack(draft, makeChannel())).rejects.toThrow(
      'Article publishing is not supported',
    );
  });

  it('throws when channel has no credentials', async () => {
    const draft = makeDraft();
    const channel = makeChannel({ credentials: null });
    await expect(publishToSubstack(draft, channel)).rejects.toThrow(
      'no credentials configured',
    );
  });

  it('throws when ENCRYPTION_KEY is not set', async () => {
    delete process.env.ENCRYPTION_KEY;
    await expect(publishToSubstack(makeDraft(), makeChannel())).rejects.toThrow(
      'ENCRYPTION_KEY',
    );
  });

  it('throws when decryption fails', async () => {
    vi.mocked(decrypt).mockReturnValue(null);
    await expect(publishToSubstack(makeDraft(), makeChannel())).rejects.toThrow(
      'Failed to decrypt',
    );
  });

  it('throws when credentials are missing required fields', async () => {
    vi.mocked(decrypt).mockReturnValue(
      JSON.stringify({ publicationUrl: 'https://example.substack.com' }), // missing token
    );
    await expect(publishToSubstack(makeDraft(), makeChannel())).rejects.toThrow(
      'missing required fields',
    );
  });

  it('throws when credentials are not valid JSON', async () => {
    vi.mocked(decrypt).mockReturnValue('not-valid-json{{{');
    await expect(publishToSubstack(makeDraft(), makeChannel())).rejects.toThrow(
      'not valid JSON',
    );
  });

  it('throws when draft has no content', async () => {
    vi.mocked(decrypt).mockReturnValue(VALID_CREDS);
    const draft = makeDraft({ hook: null, body: null, cta: null });
    await expect(publishToSubstack(draft, makeChannel())).rejects.toThrow(
      'no content to publish',
    );
  });

  it('throws when draft has only whitespace content', async () => {
    vi.mocked(decrypt).mockReturnValue(VALID_CREDS);
    const draft = makeDraft({ hook: '   ', body: '\t', cta: null });
    await expect(publishToSubstack(draft, makeChannel())).rejects.toThrow(
      'no content to publish',
    );
  });

  it('constructs SubstackClient with correct config', async () => {
    vi.mocked(decrypt).mockReturnValue(VALID_CREDS);
    await publishToSubstack(makeDraft(), makeChannel());
    expect(SubstackClient).toHaveBeenCalledWith({
      publicationUrl: 'https://example.substack.com',
      token: 'tok123',
    });
  });

  it('passes formatted content to note builder', async () => {
    vi.mocked(decrypt).mockReturnValue(VALID_CREDS);
    const draft = makeDraft({ hook: 'Hook', body: 'Body', cta: 'CTA' });
    await publishToSubstack(draft, makeChannel());
    expect(paragraphBuilder.text).toHaveBeenCalledWith('Hook\n\nBody\n\nCTA');
  });

  it('returns id and date from PublishNoteResponse', async () => {
    vi.mocked(decrypt).mockReturnValue(VALID_CREDS);
    const result = await publishToSubstack(makeDraft(), makeChannel());
    expect(result).toEqual({ id: 42, date: '2024-01-01T00:00:00Z' });
  });

  it('propagates ownProfile() rejection', async () => {
    vi.mocked(decrypt).mockReturnValue(VALID_CREDS);
    mockOwnProfile.mockRejectedValue(new Error('401 Unauthorized'));
    await expect(publishToSubstack(makeDraft(), makeChannel())).rejects.toThrow(
      '401 Unauthorized',
    );
  });
});
