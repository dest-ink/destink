// PROVIDER_API_VERSION is imported here so downstream callers can reference it
// when building validator functions — the Registry itself does not use it.
export { PROVIDER_API_VERSION } from './types';

/**
 * Generic provider registry.
 *
 * A single `Registry<T>` instance manages validation and registration of
 * providers of type `T`. The same class is used for both publisher registries
 * (keyed by `platform`) and research adapter registries (keyed by `id`).
 *
 * Providers are registered via explicit `register()` calls, then the registry
 * is frozen with `freeze()` to prevent further mutations.
 *
 * @param keyExtractor - Pure function that derives the registry key from a
 *                       validated provider instance. E.g. `p => p.platform`.
 */
export class Registry<T> {
  private readonly providers = new Map<string, T>();
  private readonly keyExtractor: (provider: T) => string;
  private frozen = false;

  constructor(keyExtractor: (provider: T) => string) {
    this.keyExtractor = keyExtractor;
  }

  // ─── Registration ─────────────────────────────────────────────────────────

  /**
   * Register a single provider directly.
   * Throws if the registry has been frozen.
   */
  register(provider: T): void {
    if (this.frozen) {
      throw new Error('Registry is frozen — cannot register new providers after freeze()');
    }
    const key = this.keyExtractor(provider);
    this.providers.set(key, provider);
  }

  /**
   * Freeze the registry so no further `register()` calls are accepted.
   */
  freeze(): void {
    this.frozen = true;
  }

  // ─── Lookup ───────────────────────────────────────────────────────────────

  /** Return the provider registered under `key`, or `undefined`. */
  get(key: string): T | undefined {
    return this.providers.get(key);
  }

  /** Return all registered providers as an array. */
  getAll(): T[] {
    return Array.from(this.providers.values());
  }

  /** Return `true` if a provider is registered under `key`. */
  has(key: string): boolean {
    return this.providers.has(key);
  }

  /** Return all registered keys. */
  keys(): string[] {
    return Array.from(this.providers.keys());
  }
}
