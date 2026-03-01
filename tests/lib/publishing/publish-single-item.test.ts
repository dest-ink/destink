import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db/client', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/publishing/publisher-registry', () => ({
  publisherRegistry: { get: vi.fn(), keys: vi.fn().mockReturnValue(['substack']) },
  initPublisherRegistry: vi.fn(),
}));

import { publishSingleItem } from '@/lib/publishing/publish-single-item';
import { db } from '@/db/client';
import { publisherRegistry, initPublisherRegistry } from '@/lib/publishing/publisher-registry';

const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};
const mockRegistryGet = vi.mocked(publisherRegistry.get);
const mockInit = vi.mocked(initPublisherRegistry);

function mockSelectWithJoins(returnValue: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(returnValue),
  };
  mockDb.select.mockReturnValue(chain);
  return chain;
}

function mockUpdate(times = 5) {
  for (let i = 0; i < times; i++) {
    const chain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    mockDb.update.mockReturnValueOnce(chain);
  }
}

function getUpdateSetArgs() {
  return (mockDb.update.mock.results as Array<{ value: { set: ReturnType<typeof vi.fn> } }>)
    .map(r => r.value.set.mock.calls[0]?.[0]);
}

function makeItem() {
  return {
    queue: { id: 'q-1', retryCount: 0 },
    draft: { id: 'd-1', title: 'Test' },
    channel: { id: 'c-1', platform: 'substack' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('publishSingleItem', () => {
  it('publishes successfully and updates status to published', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockSelectWithJoins([makeItem()]);
    mockUpdate();
    const mockProvider = {
      publish: vi.fn().mockResolvedValue({ id: 1 }),
      name: 'substack',
      platform: 'substack',
    };
    mockRegistryGet.mockReturnValue(mockProvider as never);

    await publishSingleItem('q-1');

    expect(mockProvider.publish).toHaveBeenCalledTimes(1);
    const updates = getUpdateSetArgs();
    expect(updates[0]).toMatchObject({ status: 'published' });
    logSpy.mockRestore();
  });

  it('retries on failure with incremented retryCount', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockSelectWithJoins([makeItem()]);
    mockUpdate();
    const mockProvider = {
      publish: vi.fn().mockRejectedValue(new Error('timeout')),
      name: 'substack',
      platform: 'substack',
    };
    mockRegistryGet.mockReturnValue(mockProvider as never);

    await publishSingleItem('q-1');

    const updates = getUpdateSetArgs();
    expect(updates[0]).toMatchObject({ status: 'queued', retryCount: 1 });
    warnSpy.mockRestore();
  });

  it('calls initPublisherRegistry if registry is empty', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(publisherRegistry.keys).mockReturnValueOnce([]);
    mockSelectWithJoins([makeItem()]);
    mockUpdate();
    const mockProvider = {
      publish: vi.fn().mockResolvedValue({ id: 1 }),
      name: 'substack',
      platform: 'substack',
    };
    mockRegistryGet.mockReturnValue(mockProvider as never);

    await publishSingleItem('q-1');

    expect(mockInit).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
  });
});
