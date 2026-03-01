import { describe, it, expect, beforeEach } from 'vitest';
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Registry<T>', () => {
  let registry: Registry<TestProvider>;

  beforeEach(() => {
    registry = new Registry<TestProvider>((p) => p.id);
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

  describe('freeze()', () => {
    it('throws when register() is called after freeze()', () => {
      registry.freeze();

      expect(() => registry.register(makeProvider('late'))).toThrow(
        'Registry is frozen',
      );
    });

    it('retains providers registered before freeze()', () => {
      const alpha = makeProvider('alpha');
      const beta = makeProvider('beta');
      registry.register(alpha);
      registry.register(beta);

      registry.freeze();

      expect(registry.has('alpha')).toBe(true);
      expect(registry.has('beta')).toBe(true);
      expect(registry.get('alpha')).toBe(alpha);
      expect(registry.get('beta')).toBe(beta);
    });
  });
});
