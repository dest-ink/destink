import fs from 'fs';
import path from 'path';

// PROVIDER_API_VERSION is imported here so downstream callers can reference it
// when building validator functions — the Registry itself does not use it.
export { PROVIDER_API_VERSION } from './types';

/**
 * Generic provider registry.
 *
 * A single `Registry<T>` instance manages discovery, validation, and
 * registration of providers of type `T`. The same class is used for both
 * publisher registries (keyed by `platform`) and research adapter registries
 * (keyed by `id`).
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
   *
   * Useful in tests and for built-in providers that ship with the app.
   * Throws if the registry has been frozen by a prior `loadDirectory()` call.
   */
  register(provider: T): void {
    if (this.frozen) {
      throw new Error('Registry is frozen — cannot register new providers after loadDirectory()');
    }
    const key = this.keyExtractor(provider);
    this.providers.set(key, provider);
  }

  // ─── Discovery ────────────────────────────────────────────────────────────

  /**
   * Scan `dir` for files whose names end with `suffix`, dynamically import
   * each one, validate the default export (falling back to the module itself
   * if there is no `default` export), and register every valid provider.
   *
   * Invalid modules are skipped — a `console.warn` message is emitted with
   * the file name and the reason returned by `validate`. The scan always
   * completes; a single bad file never prevents the rest from loading.
   *
   * After the scan finishes the registry is frozen: subsequent `register()`
   * calls will throw.
   *
   * @param dir      - Absolute path to the directory to scan.
   * @param suffix   - File name suffix to filter on (e.g. `.provider.js`).
   * @param validate - Function that receives the raw module export and returns
   *                   a typed provider `T` if valid, or `null` if invalid.
   */
  async loadDirectory(
    dir: string,
    suffix: string,
    validate: (mod: unknown) => T | null,
  ): Promise<void> {
    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch (err) {
      // Directory does not exist or is unreadable — freeze and return.
      this.frozen = true;
      return;
    }

    const candidates = files.filter((f) => f.endsWith(suffix));

    for (const file of candidates) {
      const filePath = path.resolve(dir, file);
      try {
        const mod = await import(filePath);
        // Prefer .default; fall back to the module object itself.
        const exported: unknown = 'default' in mod ? mod.default : mod;
        const provider = validate(exported);
        if (provider === null) {
          console.warn(`[Registry] Skipping invalid provider in "${file}": validate() returned null`);
          continue;
        }
        const key = this.keyExtractor(provider);
        this.providers.set(key, provider);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(`[Registry] Failed to load provider from "${file}": ${reason}`);
      }
    }

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
