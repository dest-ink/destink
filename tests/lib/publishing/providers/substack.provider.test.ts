import { describe, it, expect, vi } from 'vitest';

// Mock the substack module before importing the provider
vi.mock('@/lib/publishing/substack', () => ({
  publishToSubstack: vi.fn(),
  formatForSubstack: vi.fn(),
}));

import substackProvider from '@/lib/publishing/providers/substack.provider';
import { publishToSubstack, formatForSubstack } from '@/lib/publishing/substack';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';

const mockPublishToSubstack = vi.mocked(publishToSubstack);
const mockFormatForSubstack = vi.mocked(formatForSubstack);

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
} as Parameters<typeof substackProvider.publish>[0];

const mockChannel = {
  id: 'c-1',
  name: 'Test Channel',
  platform: 'substack',
  credentials: null,
} as Parameters<typeof substackProvider.publish>[1];

// ─── Metadata ─────────────────────────────────────────────────────────────────

describe('substackProvider metadata', () => {
  it('has correct name and platform', () => {
    expect(substackProvider.name).toBe('substack');
    expect(substackProvider.platform).toBe('substack');
  });

  it('has correct apiVersion matching PROVIDER_API_VERSION', () => {
    expect(substackProvider.apiVersion).toBe(PROVIDER_API_VERSION);
  });

  it('has a non-empty configSchema array with required fields', () => {
    expect(Array.isArray(substackProvider.configSchema)).toBe(true);
    expect(substackProvider.configSchema.length).toBeGreaterThan(0);

    const publicationUrlField = substackProvider.configSchema.find(f => f.key === 'publicationUrl');
    const tokenField = substackProvider.configSchema.find(f => f.key === 'token');

    expect(publicationUrlField).toBeDefined();
    expect(publicationUrlField?.required).toBe(true);
    expect(tokenField).toBeDefined();
    expect(tokenField?.required).toBe(true);
  });
});

// ─── publish() delegation ────────────────────────────────────────────────────

describe('substackProvider.publish()', () => {
  it('delegates to publishToSubstack with (draft, channel)', async () => {
    mockPublishToSubstack.mockResolvedValue({ id: 1, date: '2026-01-01' });

    await substackProvider.publish(mockDraft, mockChannel);

    expect(mockPublishToSubstack).toHaveBeenCalledTimes(1);
    expect(mockPublishToSubstack).toHaveBeenCalledWith(mockDraft, mockChannel);
  });
});

// ─── formatDraft() delegation ─────────────────────────────────────────────────

describe('substackProvider.formatDraft()', () => {
  it('delegates to formatForSubstack with draft only (strips channel arg)', () => {
    mockFormatForSubstack.mockReturnValue('Hook text\n\nBody text\n\nCTA text');

    substackProvider.formatDraft(mockDraft, mockChannel);

    expect(mockFormatForSubstack).toHaveBeenCalledTimes(1);
    // formatForSubstack takes only draft — channel is stripped by the wrapper
    expect(mockFormatForSubstack).toHaveBeenCalledWith(mockDraft);
  });
});
