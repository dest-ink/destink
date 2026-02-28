import { describe, it, expect, vi } from 'vitest';

// Mock the linkedin module before importing the provider
vi.mock('@/lib/publishing/linkedin', () => ({
  publishToLinkedIn: vi.fn(),
  formatForLinkedIn: vi.fn(),
}));

import linkedInProvider from '@/lib/publishing/providers/linkedin.provider';
import { publishToLinkedIn, formatForLinkedIn } from '@/lib/publishing/linkedin';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';

const mockPublishToLinkedIn = vi.mocked(publishToLinkedIn);
const mockFormatForLinkedIn = vi.mocked(formatForLinkedIn);

// ─── Minimal fixtures ─────────────────────────────────────────────────────────

const mockDraft = {
  id: 'd-1',
  title: 'Test Draft',
  hook: 'Hook text',
  body: 'Body text',
  cta: 'CTA text',
  contentType: 'note',
  status: 'approved',
  channelId: 'c-1',
} as Parameters<typeof linkedInProvider.publish>[0];

const mockChannel = {
  id: 'c-1',
  name: 'Test Channel',
  platform: 'linkedin',
  credentials: null,
} as Parameters<typeof linkedInProvider.publish>[1];

// ─── Metadata ─────────────────────────────────────────────────────────────────

describe('linkedInProvider metadata', () => {
  it('has correct name and platform', () => {
    expect(linkedInProvider.name).toBe('linkedin');
    expect(linkedInProvider.platform).toBe('linkedin');
  });

  it('has correct apiVersion matching PROVIDER_API_VERSION', () => {
    expect(linkedInProvider.apiVersion).toBe(PROVIDER_API_VERSION);
  });

  it('has a non-empty configSchema array with required fields', () => {
    expect(Array.isArray(linkedInProvider.configSchema)).toBe(true);
    expect(linkedInProvider.configSchema.length).toBeGreaterThan(0);

    const accessTokenField = linkedInProvider.configSchema.find(f => f.key === 'accessToken');
    const personUrnField = linkedInProvider.configSchema.find(f => f.key === 'personUrn');

    expect(accessTokenField).toBeDefined();
    expect(accessTokenField?.required).toBe(true);
    expect(personUrnField).toBeDefined();
    expect(personUrnField?.required).toBe(true);
  });
});

// ─── publish() delegation ─────────────────────────────────────────────────────

describe('linkedInProvider.publish()', () => {
  it('delegates to publishToLinkedIn with (draft, channel)', async () => {
    mockPublishToLinkedIn.mockResolvedValue({ id: 'li-post-1' });

    await linkedInProvider.publish(mockDraft, mockChannel);

    expect(mockPublishToLinkedIn).toHaveBeenCalledTimes(1);
    expect(mockPublishToLinkedIn).toHaveBeenCalledWith(mockDraft, mockChannel);
  });
});

// ─── formatDraft() delegation ─────────────────────────────────────────────────

describe('linkedInProvider.formatDraft()', () => {
  it('delegates to formatForLinkedIn with draft only (strips channel arg)', () => {
    mockFormatForLinkedIn.mockReturnValue('Hook text\n\nBody text\n\nCTA text');

    linkedInProvider.formatDraft(mockDraft, mockChannel);

    expect(mockFormatForLinkedIn).toHaveBeenCalledTimes(1);
    // formatForLinkedIn takes only draft — channel is stripped by the wrapper
    expect(mockFormatForLinkedIn).toHaveBeenCalledWith(mockDraft);
  });
});
