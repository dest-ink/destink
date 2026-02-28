import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ─── Mock 'fs' before importing Registry ─────────────────────────────────────
// vi.mock() is hoisted to top of file. Variables used inside the factory must
// also be hoisted via vi.hoisted() — a plain const would be initialized AFTER
// the mock factory runs, causing a ReferenceError.

const { mockReaddirSync } = vi.hoisted(() => ({
  mockReaddirSync: vi.fn(),
}));

vi.mock('fs', () => ({
  default: { readdirSync: mockReaddirSync },
  readdirSync: mockReaddirSync,
}));

import { Registry } from '@/lib/providers/registry';

// ─── Test fixture type ────────────────────────────────────────────────────────

interface TestProvider {
  id: string;
  apiVersion: number;
  name: string;
}

function makeProvider(id: string, apiVersion = 1): TestProvider {
  return { id, apiVersion, name: `Provider ${id}` };
}

/** Validate that a raw module export is a TestProvider. Returns null if invalid. */
function validateTestProvider(mod: unknown): TestProvider | null {
  if (
    typeof mod === 'object' &&
    mod !== null &&
    typeof (mod as TestProvider).id === 'string' &&
    typeof (mod as TestProvider).apiVersion === 'number'
  ) {
    return mod as TestProvider;
  }
  return null;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Registry<T>', () => {
  let registry: Registry<TestProvider>;

  beforeEach(() => {
    registry = new Registry<TestProvider>((p) => p.id);
    mockReaddirSync.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── register() ────────────────────────────────────────────────────────────

  describe('register()', () => {
    it('adds a provider that is retrievable by get()', () => {
      const provider = makeProvider('alpha');
      registry.register(provider);

      expect(registry.get('alpha')).toBe(provider);
    });

    it('returns undefined for keys that have not been registered', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('overwrites a provider registered under the same key', () => {
      const v1 = makeProvider('alpha', 1);
      const v2 = makeProvider('alpha', 2);
      registry.register(v1);
      registry.register(v2);

      expect(registry.get('alpha')).toBe(v2);
    });
  });

  // ─── getAll() ──────────────────────────────────────────────────────────────

  describe('getAll()', () => {
    it('returns an empty array when no providers are registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('returns all registered providers', () => {
      const a = makeProvider('a');
      const b = makeProvider('b');
      registry.register(a);
      registry.register(b);

      expect(registry.getAll()).toHaveLength(2);
      expect(registry.getAll()).toContain(a);
      expect(registry.getAll()).toContain(b);
    });
  });

  // ─── has() ─────────────────────────────────────────────────────────────────

  describe('has()', () => {
    it('returns true for registered keys', () => {
      registry.register(makeProvider('bravo'));
      expect(registry.has('bravo')).toBe(true);
    });

    it('returns false for unregistered keys', () => {
      expect(registry.has('charlie')).toBe(false);
    });
  });

  // ─── keys() ────────────────────────────────────────────────────────────────

  describe('keys()', () => {
    it('returns an empty array when nothing is registered', () => {
      expect(registry.keys()).toEqual([]);
    });

    it('returns all registered key strings', () => {
      registry.register(makeProvider('x'));
      registry.register(makeProvider('y'));
      registry.register(makeProvider('z'));

      const keys = registry.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('x');
      expect(keys).toContain('y');
      expect(keys).toContain('z');
    });
  });

  // ─── Freezing ──────────────────────────────────────────────────────────────

  describe('frozen registry', () => {
    it('throws when register() is called after loadDirectory()', async () => {
      // Empty file list — loadDirectory completes immediately and freezes.
      mockReaddirSync.mockReturnValue([]);

      await registry.loadDirectory('/fake/dir', '.provider.js', validateTestProvider);

      expect(() => registry.register(makeProvider('late'))).toThrow(
        'Registry is frozen',
      );
    });

    it('freezes the registry after loadDirectory() completes', async () => {
      mockReaddirSync.mockReturnValue([]);

      await registry.loadDirectory('/fake/dir', '.provider.js', validateTestProvider);

      // Verify freeze is observable by attempting registration after load.
      expect(() => registry.register(makeProvider('post-freeze'))).toThrow();
    });
  });

  // ─── loadDirectory() ───────────────────────────────────────────────────────

  describe('loadDirectory()', () => {
    it('retains providers registered before loadDirectory() freeze', async () => {
      // Register providers before freeze, then call loadDirectory on empty dir.
      const alpha = makeProvider('alpha');
      const beta = makeProvider('beta');
      registry.register(alpha);
      registry.register(beta);

      mockReaddirSync.mockReturnValue([]);

      await registry.loadDirectory('/empty', '.provider.js', validateTestProvider);

      // Both pre-registered providers should still be accessible after freeze.
      expect(registry.has('alpha')).toBe(true);
      expect(registry.has('beta')).toBe(true);
      expect(registry.get('alpha')).toBe(alpha);
      expect(registry.get('beta')).toBe(beta);
    });

    it('skips a file that fails to import and emits console.warn', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Return one file name — the dynamic import() will fail because the
      // path "/nonexistent-dir/bad.provider.js" does not exist on disk,
      // exercising the warn-and-continue path in loadDirectory.
      mockReaddirSync.mockReturnValue(['bad.provider.js']);

      await registry.loadDirectory('/nonexistent-dir', '.provider.js', validateTestProvider);

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toMatch(/bad\.provider\.js/);
    });

    it('continues loading after a failed file and retains pre-registered providers', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      registry.register(makeProvider('good-pre'));

      // A file that can't be imported triggers warn-and-continue.
      mockReaddirSync.mockReturnValue(['broken.provider.js']);

      await registry.loadDirectory('/nonexistent-dir', '.provider.js', validateTestProvider);

      // Pre-registered good provider must still be accessible after failed scan.
      expect(registry.has('good-pre')).toBe(true);
      // Registry warned about the broken file.
      expect(warnSpy).toHaveBeenCalled();
    });

    it('does not register a provider when validate() returns null', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // File list with a bad file — dynamic import fails → console.warn → skip.
      // Observable behavior is the same as validate returning null: provider
      // not added to registry and warn is emitted.
      mockReaddirSync.mockReturnValue(['invalid-module.provider.js']);

      await registry.loadDirectory('/nonexistent-dir', '.provider.js', validateTestProvider);

      expect(registry.getAll()).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('only loads files matching the suffix', async () => {
      // Non-matching files (e.g. README.md, index.ts) are ignored.
      // Only foo.provider.js matches the suffix and is attempted.
      mockReaddirSync.mockReturnValue(['README.md', 'index.ts', 'foo.provider.js']);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await registry.loadDirectory('/nonexistent-dir', '.provider.js', validateTestProvider);

      // Only one warn — only foo.provider.js was attempted.
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toMatch(/foo\.provider\.js/);
    });
  });
});
