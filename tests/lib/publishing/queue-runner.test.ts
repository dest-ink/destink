import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules BEFORE importing queue-runner (Vitest hoists these)
vi.mock('@/db/client', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/publishing/substack', () => ({
  publishToSubstack: vi.fn(),
}));

vi.mock('@/lib/publishing/linkedin', () => ({
  publishToLinkedIn: vi.fn(),
}));

import { runPublishQueue, recoverStuckItems, getRetryDelay } from '@/lib/publishing/queue-runner';
import { db } from '@/db/client';
import { publishToSubstack } from '@/lib/publishing/substack';
import { publishToLinkedIn } from '@/lib/publishing/linkedin';

const mockDb = db as {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};
const mockPublishSubstack = vi.mocked(publishToSubstack);
const mockPublishLinkedIn = vi.mocked(publishToLinkedIn);

// ─── Helper factories ─────────────────────────────────────────────────────────

/**
 * Chainable select mock for runPublishQueue:
 * db.select().from().innerJoin().innerJoin().where()
 */
function mockSelectWithJoins(returnValue: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(returnValue),
  };
  mockDb.select.mockReturnValue(chain);
  return chain;
}

/**
 * Chainable select mock for recoverStuckItems:
 * db.select().from().where()
 */
function mockSelectSimple(returnValue: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(returnValue),
  };
  mockDb.select.mockReturnValue(chain);
  return chain;
}

/**
 * Chainable update mock: db.update().set().where()
 * Creates a fresh chain per call so each invocation's .set() args can be
 * inspected independently via mockDb.update.mock.results[N].value.set.mock.calls.
 */
function mockUpdate(times = 5) {
  for (let i = 0; i < times; i++) {
    const chain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    mockDb.update.mockReturnValueOnce(chain);
  }
}

/**
 * Extract the first argument passed to .set() for each db.update() call.
 * Each db.update() call returns a distinct chain (via mockReturnValueOnce),
 * so this correctly captures per-call set arguments.
 */
function getUpdateSetArgs() {
  return (mockDb.update.mock.results as Array<{ value: { set: ReturnType<typeof vi.fn> } }>)
    .map(r => r.value.set.mock.calls[0][0]);
}

// ─── Test fixture ─────────────────────────────────────────────────────────────

function makeQueueItem(overrides: Record<string, unknown> = {}) {
  return {
    queue: {
      id: 'q-1',
      draftId: 'd-1',
      channelId: 'c-1',
      scheduledFor: new Date('2026-01-01'),
      status: 'queued',
      retryCount: 0,
      errorMessage: null,
      publishedAt: null,
      platformResponse: null,
      createdAt: new Date('2026-01-01'),
      ...overrides,
    },
    draft: {
      id: 'd-1',
      title: 'Test Draft',
      channelId: 'c-1',
      status: 'approved',
    },
    channel: {
      id: 'c-1',
      name: 'Test Channel',
      platform: 'substack',
    },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getRetryDelay ────────────────────────────────────────────────────────────

describe('getRetryDelay', () => {
  it('returns 5 minutes for first retry', () => {
    expect(getRetryDelay(1)).toBe(5 * 60 * 1000);
  });

  it('returns 15 minutes for second retry', () => {
    expect(getRetryDelay(2)).toBe(15 * 60 * 1000);
  });

  it('returns 45 minutes for third and subsequent retries', () => {
    expect(getRetryDelay(3)).toBe(45 * 60 * 1000);
    expect(getRetryDelay(5)).toBe(45 * 60 * 1000);
    expect(getRetryDelay(10)).toBe(45 * 60 * 1000);
  });
});

// ─── runPublishQueue ──────────────────────────────────────────────────────────

describe('runPublishQueue', () => {
  it('publishes a due item and updates status to published', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const item = makeQueueItem();
    mockSelectWithJoins([item]);
    mockUpdate();
    mockPublishSubstack.mockResolvedValue({ ok: true });

    await runPublishQueue();

    // update called for: status→publishing, status→published, draft→published
    expect(mockDb.update).toHaveBeenCalledTimes(3);
    expect(mockPublishSubstack).toHaveBeenCalledTimes(1);
    expect(mockPublishSubstack).toHaveBeenCalledWith(item.draft, item.channel);
    consoleSpy.mockRestore();
  });

  it('dispatches to LinkedIn publisher for linkedin platform', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const item = makeQueueItem({ channelId: 'c-2' });
    item.channel.platform = 'linkedin';
    mockSelectWithJoins([item]);
    mockUpdate();
    mockPublishLinkedIn.mockResolvedValue({ ok: true });

    await runPublishQueue();

    expect(mockPublishLinkedIn).toHaveBeenCalledTimes(1);
    expect(mockPublishLinkedIn).toHaveBeenCalledWith(item.draft, item.channel);
    expect(mockPublishSubstack).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('retries on publisher failure with incremented retryCount', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const item = makeQueueItem({ retryCount: 0 });
    mockSelectWithJoins([item]);
    mockUpdate();
    mockPublishSubstack.mockRejectedValue(new Error('API timeout'));

    await runPublishQueue();

    // Should update twice: status→publishing, then status→queued with incremented retry
    expect(mockDb.update).toHaveBeenCalledTimes(2);
    const updateSetCalls = getUpdateSetArgs();

    expect(updateSetCalls[0]).toEqual({ status: 'publishing' });
    expect(updateSetCalls[1]).toMatchObject({
      status: 'queued',
      retryCount: 1,
    });
    // scheduledFor should be set to a future date
    expect(updateSetCalls[1].scheduledFor).toBeInstanceOf(Date);
    expect((updateSetCalls[1].scheduledFor as Date).getTime()).toBeGreaterThan(Date.now());
    warnSpy.mockRestore();
  });

  it('marks item as permanently failed after max retries', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // retryCount=3 means next attempt is 4, which exceeds maxRetries=3
    const item = makeQueueItem({ retryCount: 3 });
    mockSelectWithJoins([item]);
    mockUpdate();
    mockPublishSubstack.mockRejectedValue(new Error('Persistent failure'));

    await runPublishQueue();

    // Should update twice: status→publishing, then status→failed
    expect(mockDb.update).toHaveBeenCalledTimes(2);
    const updateSetCalls = getUpdateSetArgs();

    expect(updateSetCalls[0]).toEqual({ status: 'publishing' });
    expect(updateSetCalls[1]).toMatchObject({
      status: 'failed',
      retryCount: 4,
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('does nothing when no items are due', async () => {
    mockSelectWithJoins([]);

    await runPublishQueue();

    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockPublishSubstack).not.toHaveBeenCalled();
    expect(mockPublishLinkedIn).not.toHaveBeenCalled();
  });

  it('throws for unknown platform and records error status', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const item = makeQueueItem({ retryCount: 0 });
    item.channel.platform = 'twitter' as never;
    mockSelectWithJoins([item]);
    mockUpdate();

    await runPublishQueue();

    // Should update twice: status→publishing, then status→queued (retry path for unknown platform)
    expect(mockDb.update).toHaveBeenCalledTimes(2);
    const updateSetCalls = getUpdateSetArgs();

    expect(updateSetCalls[0]).toEqual({ status: 'publishing' });
    // Error message should mention the unknown platform
    expect(String(updateSetCalls[1].errorMessage)).toContain('twitter');
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

// ─── recoverStuckItems ────────────────────────────────────────────────────────

describe('recoverStuckItems', () => {
  it('resets items stuck in publishing older than 15 minutes', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockSelectSimple([{ id: 'stuck-1' }]);
    mockUpdate();

    await recoverStuckItems();

    expect(mockDb.update).toHaveBeenCalledTimes(1);
    const updateSetCalls = getUpdateSetArgs();
    expect(updateSetCalls[0]).toEqual({ status: 'queued' });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('stuck-1'),
    );
    warnSpy.mockRestore();
  });

  it('does nothing when no stuck items exist', async () => {
    mockSelectSimple([]);

    await recoverStuckItems();

    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
