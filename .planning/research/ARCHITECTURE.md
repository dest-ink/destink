# Architecture Research

**Domain:** Pluggable provider/plugin system for TypeScript/Node.js content publishing app
**Researched:** 2026-02-26
**Confidence:** HIGH (patterns verified against production systems: Payload CMS, Fastify, Slash Engineering case study)

## Standard Architecture

### System Overview

The recommended architecture for Orbitl's pluggable provider system is a **Registry + Strategy pattern**:
a central registry per adapter type, explicit provider registration, and convention-based
auto-discovery (glob scan on startup).

```
┌─────────────────────────────────────────────────────────────────┐
│                     Provider Registry Layer                      │
│                                                                  │
│  ┌──────────────────────┐   ┌──────────────────────────────┐    │
│  │  PublisherRegistry   │   │    ResearchAdapterRegistry   │    │
│  │                      │   │                              │    │
│  │ Map<platform,        │   │ Map<name,                    │    │
│  │  PublisherProvider>  │   │  ResearchAdapter>            │    │
│  └──────────┬───────────┘   └────────────┬─────────────────┘    │
│             │ lookup by                  │ fan-out all           │
│             │ channel.platform           │ registered            │
└─────────────┼──────────────────────────--┼─────────────────────┘
              │                            │
┌─────────────▼────────────────────────────▼─────────────────────┐
│                   Provider Interfaces (contracts)                │
│                                                                  │
│  interface PublisherProvider {          interface ResearchAdapter {   │
│    platform: string                       name: string                │
│    publish(draft, channel): Result        search(config): Sources     │
│    formatContent(draft): string           isConfigured(config): bool  │
│    validateCredentials(creds): void     }                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
              │                            │
┌─────────────▼──────────────┐  ┌──────────▼─────────────────────┐
│    Publisher Modules        │  │   Research Adapter Modules      │
│                             │  │                                 │
│  ┌──────────┐ ┌──────────┐  │  │  ┌──────┐ ┌──────┐ ┌──────┐   │
│  │substack  │ │linkedin  │  │  │  │ exa  │ │reddit│ │sub-  │   │
│  │.provider │ │.provider │  │  │  │.adpt │ │.adpt │ │stack │   │
│  │   .ts    │ │   .ts    │  │  │  │  .ts │ │  .ts │ │.adpt │   │
│  └──────────┘ └──────────┘  │  │  └──────┘ └──────┘ │  .ts │   │
│                             │  │                     └──────┘   │
│  [ drop new file → done ]   │  │  [ drop new file → done ]      │
└─────────────────────────────┘  └─────────────────────────────────┘
              │                            │
┌─────────────▼────────────────────────────▼─────────────────────┐
│                    Startup Auto-Discovery                         │
│  loadProviders() {                                               │
│    glob('src/lib/publishing/providers/*.provider.ts')            │
│    glob('src/lib/research/adapters/*.adapter.ts')                │
│    → dynamic import each file                                    │
│    → register exported default into appropriate registry         │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `PublisherRegistry` | Maps platform string → PublisherProvider; dispatches publish calls | `queue-runner.ts`, startup loader |
| `ResearchAdapterRegistry` | Holds all research adapters; fans out to all registered adapters | `orchestrator.ts`, startup loader |
| `PublisherProvider` (interface) | Contract every publisher module must satisfy | Registry, providers |
| `ResearchAdapter` (interface) | Contract every research module must satisfy | Registry, adapters |
| `substack.provider.ts` | Wraps existing Substack publish logic; exports `default` satisfying interface | PublisherRegistry |
| `linkedin.provider.ts` | Wraps existing LinkedIn publish logic; exports `default` satisfying interface | PublisherRegistry |
| `exa.adapter.ts` | Wraps existing Exa search logic; exports `default` satisfying interface | ResearchAdapterRegistry |
| `reddit.adapter.ts` | Wraps existing Reddit logic; exports `default` satisfying interface | ResearchAdapterRegistry |
| `substack-monitor.adapter.ts` | Wraps existing Substack monitor; exports `default` satisfying interface | ResearchAdapterRegistry |
| Startup loader | Globs provider/adapter directories; dynamically imports and registers each module | All registries |

## Recommended Project Structure

```
src/lib/
├── publishing/
│   ├── providers/                  # Drop-in publisher modules (auto-discovered)
│   │   ├── substack.provider.ts    # Reference implementation (migrated from substack.ts)
│   │   ├── linkedin.provider.ts    # Reference implementation (migrated from linkedin.ts)
│   │   └── [twitter].provider.ts  # Future: drop file, done
│   ├── registry.ts                 # PublisherRegistry class + PublisherProvider interface
│   ├── loader.ts                   # Startup: glob providers/, import, register
│   ├── queue-runner.ts             # Uses registry.get(platform) instead of if/else
│   └── scheduler.ts                # Unchanged
│
├── research/
│   ├── adapters/                   # Drop-in research adapter modules (auto-discovered)
│   │   ├── exa.adapter.ts          # Reference implementation (migrated from exa.ts)
│   │   ├── reddit.adapter.ts       # Reference implementation (migrated from reddit.ts)
│   │   └── substack-monitor.adapter.ts
│   ├── registry.ts                 # ResearchAdapterRegistry + ResearchAdapter interface
│   ├── loader.ts                   # Startup: glob adapters/, import, register
│   ├── orchestrator.ts             # Uses registry.getAll() instead of hardcoded imports
│   ├── engine.ts                   # Unchanged
│   └── brainstorm.ts               # Unchanged (not an adapter — AI brainstorm is always on)
```

### Structure Rationale

- **`providers/` and `adapters/` subdirectories:** Convention defines the drop zone. Contributors know exactly where to put a new module. The glob pattern is tied to the directory, not a config file.
- **Filename suffix (`.provider.ts`, `.adapter.ts`):** Provides unambiguous discovery signal. Prevents accidentally loading test files, utilities, or partial modules. Follows the Slash Engineering pattern (verified: scales to 1M+ lines).
- **`registry.ts` per domain:** Keeps the registry co-located with what it manages. Publisher registry in the publishing folder; research registry in research folder.
- **`loader.ts` per domain:** Separates the startup side-effect (file scanning) from the registry business logic. Easier to test registry in isolation.

## Architectural Patterns

### Pattern 1: Interface + Default Export Contract

**What:** Each provider/adapter module exports a `default` object that satisfies the declared interface. TypeScript's `satisfies` operator enforces this at the module level without widening the type.

**When to use:** When you need type safety without requiring contributors to extend a base class. Simpler than class inheritance; works well with object literals.

**Trade-offs:** Pure and simple. Contributors don't need to understand class hierarchies. The downside is no shared behavior inheritance — use composition or helper utilities for shared logic (like credential decryption helpers).

**Example:**
```typescript
// src/lib/publishing/registry.ts

import type { drafts, channels } from '@/db/schema';

type DraftRow = typeof drafts.$inferSelect;
type ChannelRow = typeof channels.$inferSelect;

export interface PublishResult {
  platformPostId: string;
  publishedAt: string;
}

export interface PublisherProvider {
  /** Matches channel.platform string in the database. */
  readonly platform: string;

  /**
   * Format draft content for this platform's requirements.
   * Pure function — no network calls. Used for preview and testing.
   */
  formatContent(draft: DraftRow): string;

  /**
   * Publish a draft to the platform.
   * Throws on failure — queue-runner handles retry logic.
   */
  publish(draft: DraftRow, channel: ChannelRow): Promise<PublishResult>;

  /**
   * Validate that the credentials object has required fields.
   * Throws with a descriptive message if invalid.
   * Called before scheduling, not at publish time.
   */
  validateCredentials(credentials: Record<string, unknown>): void;
}
```

```typescript
// src/lib/publishing/providers/substack.provider.ts

import type { PublisherProvider, PublishResult } from '../registry';
import { SubstackClient } from 'substack-api';
import { decrypt } from '@/lib/crypto';
// ... (existing logic migrated here)

const substackProvider: PublisherProvider = {
  platform: 'substack',

  formatContent(draft) {
    return [draft.hook, draft.body, draft.cta].filter(s => s?.trim()).join('\n\n');
  },

  async publish(draft, channel): Promise<PublishResult> {
    // ... existing publishToSubstack logic, returning PublishResult shape
  },

  validateCredentials(creds) {
    if (typeof creds.publicationUrl !== 'string' || typeof creds.token !== 'string') {
      throw new Error('Substack credentials require: publicationUrl, token');
    }
  },
};

export default substackProvider;
```

### Pattern 2: Registry with Map-based Lookup

**What:** A class (or module-level singleton) holds a `Map<string, Provider>`. Callers `.register()` providers at startup and `.get(key)` at runtime. The registry throws on unknown keys — hard failure is preferable to silent no-ops.

**When to use:** When dispatch key is known at runtime (e.g., `channel.platform` is a string from the database). Replaces if/else chains. Verified against: Payload CMS plugin array pattern, Fastify encapsulation model, Slash Engineering registry pattern.

**Trade-offs:** Explicit. No magic. The registry doesn't know what providers exist until startup registration runs. This is a feature, not a bug — it makes the system testable (swap the registry in tests).

**Example:**
```typescript
// src/lib/publishing/registry.ts (continued)

export class PublisherRegistry {
  private readonly providers = new Map<string, PublisherProvider>();

  register(provider: PublisherProvider): void {
    if (this.providers.has(provider.platform)) {
      throw new Error(`Publisher provider already registered for platform: ${provider.platform}`);
    }
    this.providers.set(provider.platform, provider);
    console.log(`[publisher-registry] Registered provider: ${provider.platform}`);
  }

  get(platform: string): PublisherProvider {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new Error(
        `No publisher provider registered for platform: '${platform}'. ` +
        `Registered platforms: ${[...this.providers.keys()].join(', ')}`
      );
    }
    return provider;
  }

  list(): string[] {
    return [...this.providers.keys()];
  }
}

// Singleton instance — import this everywhere
export const publisherRegistry = new PublisherRegistry();
```

### Pattern 3: Glob-based Auto-Discovery at Startup

**What:** On application startup (and daemon startup), a loader function globs the providers directory, dynamically imports each file, and calls `.register()` on the default export. Drop a file → it's live on next restart.

**When to use:** When you want zero-config extensibility for contributors. No manifest file to update. No config key to add. Just drop a file that satisfies the interface.

**Trade-offs:** Requires a build step in TypeScript (ts-node or tsx for local; compiled JS in production). Glob runs at startup — not at request time — so there is no runtime performance cost. The Next.js app and daemon both need to call the loader before processing. The loader must run before any registry lookup.

**Important constraint:** Next.js App Router runs in a server context where dynamic `require()`/`import()` with filesystem paths is restricted. The loader pattern works for the **daemon** and **job runners** (plain Node.js). For the Next.js API routes, use a startup module that pre-loads the registry once via a module-level singleton (see Data Flow section).

**Example:**
```typescript
// src/lib/publishing/loader.ts

import { glob } from 'glob';
import path from 'path';
import { publisherRegistry } from './registry';
import type { PublisherProvider } from './registry';

export async function loadPublisherProviders(): Promise<void> {
  // In production (compiled JS), glob compiled output directory.
  // In development (tsx/ts-node), glob source directory.
  const pattern = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    'providers',
    '*.provider.{ts,js}'
  );

  const files = await glob(pattern);

  for (const file of files) {
    const mod = await import(file) as { default?: PublisherProvider };
    if (!mod.default || typeof mod.default.platform !== 'string') {
      console.warn(`[publisher-loader] Skipping ${file}: no valid default export`);
      continue;
    }
    publisherRegistry.register(mod.default);
  }

  console.log(
    `[publisher-loader] Loaded ${files.length} publisher provider(s): ${publisherRegistry.list().join(', ')}`
  );
}
```

### Pattern 4: Research Adapter Registry (fan-out vs. single lookup)

**What:** The research adapter registry differs from the publisher registry in one key way: the orchestrator calls **all** registered adapters in parallel (fan-out), not a single adapter by key. The registry exposes `.getAll()` instead of `.get(key)`.

**When to use:** When multiple sources should run simultaneously and results are merged. Matches existing `Promise.allSettled` pattern in `orchestrator.ts`.

**Example:**
```typescript
// src/lib/research/registry.ts

export interface ResearchAdapter {
  /** Unique name for logging and deduplication. */
  readonly name: string;

  /**
   * Return true if this adapter has the required config/env to run.
   * Orchestrator skips adapters that are not configured — no error.
   */
  isConfigured(config: ResearchConfig): boolean;

  /**
   * Fetch research sources for the given config.
   * Returns empty array on partial failure — do not throw.
   */
  search(config: ResearchConfig): Promise<ResearchSource[]>;
}

export class ResearchAdapterRegistry {
  private readonly adapters: ResearchAdapter[] = [];

  register(adapter: ResearchAdapter): void {
    if (this.adapters.some(a => a.name === adapter.name)) {
      throw new Error(`Research adapter already registered: ${adapter.name}`);
    }
    this.adapters.push(adapter);
    console.log(`[research-registry] Registered adapter: ${adapter.name}`);
  }

  getAll(): ResearchAdapter[] {
    return [...this.adapters];
  }

  list(): string[] {
    return this.adapters.map(a => a.name);
  }
}

export const researchAdapterRegistry = new ResearchAdapterRegistry();
```

## Data Flow

### Publisher Registration Flow (startup)

```
App/Daemon starts
    ↓
loadPublisherProviders() called (loader.ts)
    ↓
glob('providers/*.provider.ts') → [substack.provider.ts, linkedin.provider.ts, ...]
    ↓
dynamic import each file
    ↓
publisherRegistry.register(mod.default) for each
    ↓
Registry ready: Map { 'substack' → substackProvider, 'linkedin' → linkedInProvider }
    ↓
App serves requests / Daemon processes queue items
```

### Publish Queue Dispatch Flow (runtime)

```
runPublishQueue() finds due queue items
    ↓
for each item:
  channel.platform → publisherRegistry.get(platform)
    ↓
  provider.publish(draft, channel)
    ↓ (throws on failure → caught by queue-runner retry logic, unchanged)
  update queue status → 'published'
```

**Before (hardcoded):**
```typescript
if (item.channel.platform === 'substack') {
  platformResponse = await publishToSubstack(item.draft, item.channel);
} else if (item.channel.platform === 'linkedin') {
  platformResponse = await publishToLinkedIn(item.draft, item.channel);
} else {
  throw new Error(`Unknown platform '${item.channel.platform}'`);
}
```

**After (registry dispatch):**
```typescript
const provider = publisherRegistry.get(item.channel.platform);
platformResponse = await provider.publish(item.draft, item.channel);
// Unknown platform throws from registry with a descriptive message
```

### Research Adapter Registration + Fan-out Flow

```
Research run starts (engine.ts → orchestrator.ts)
    ↓
researchAdapterRegistry.getAll() → [exaAdapter, redditAdapter, substackMonitorAdapter]
    ↓
configured = adapters.filter(a => a.isConfigured(config))
    ↓
Promise.allSettled(configured.map(a => a.search(config)))
    ↓
combine fulfilled results, log rejections
    ↓
deduplicate by URL → ResearchSource[]
```

### Next.js API Route Consideration

Next.js App Router does not support dynamic filesystem imports at request time. The pattern to handle this:

```typescript
// src/lib/publishing/init.ts — called once at module load time

import { loadPublisherProviders } from './loader';

// Module-level promise ensures loading runs exactly once per process.
// Any route that imports `publisherRegistry` triggers this init.
let initPromise: Promise<void> | null = null;

export function ensureProvidersLoaded(): Promise<void> {
  if (!initPromise) {
    initPromise = loadPublisherProviders();
  }
  return initPromise;
}
```

API routes call `await ensureProvidersLoaded()` before dispatching. This is safe: the second and subsequent calls return the already-resolved promise immediately.

**Alternative for Next.js:** Use a static imports index file (`providers/index.ts`) that explicitly imports and re-exports all providers. The loader uses this index file instead of glob. This trades contributor friction (must update index.ts) for Next.js compatibility. The daemon and job runners can use true glob loading regardless.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-10 providers | Current registry singleton approach is fine. No changes needed. |
| 10-50 providers | Still fine. Add provider validation at registration time (check required interface shape). |
| 50+ providers | Consider lazy initialization — register provider factories, instantiate on first `.get()`. Add health check endpoint listing registered providers. |

### Scaling Priorities

1. **First bottleneck:** Startup time from glob + dynamic imports. At ~10 providers, negligible. At 50+, consider lazy loading or provider manifests.
2. **Second bottleneck:** The `platformEnum` in `schema.ts` is a Postgres enum locked to `['linkedin', 'substack']`. New platforms added via drop-in providers still require a schema migration to add the enum value. This is a DB-layer constraint, not a provider-layer constraint.

## Anti-Patterns

### Anti-Pattern 1: Centralized If/Else Dispatch

**What people do:** Add `else if (platform === 'twitter')` to `queue-runner.ts` for each new platform.

**Why it's wrong:** Queue runner becomes a registry of platform knowledge. Adding a platform requires editing core infrastructure. Every new adapter touches the same file — merge conflicts for parallel contributors.

**Do this instead:** Registry lookup. Queue runner has zero platform knowledge. It just asks the registry for a provider and calls `.publish()`.

### Anti-Pattern 2: Hardcoded Orchestrator Imports

**What people do:** Add `import { searchTwitter } from './twitter'` to `orchestrator.ts` for each new adapter.

**Why it's wrong:** Same problem as if/else dispatch. Orchestrator knows about every adapter. Adding an adapter requires editing the orchestrator.

**Do this instead:** `researchAdapterRegistry.getAll()` fan-out. Orchestrator has zero adapter knowledge.

### Anti-Pattern 3: Class Inheritance for Provider Contract

**What people do:** Define an abstract class `BasePublisher` and require providers to `extend BasePublisher`.

**Why it's wrong:** Creates coupling to the base class. Contributors must understand the class hierarchy. Breaks if you need to add interface methods later (forces all existing providers to update). TypeScript interfaces + object literals are simpler and more flexible.

**Do this instead:** Interface + `satisfies` operator. Providers are plain objects. No inheritance required.

### Anti-Pattern 4: Glob at Request Time

**What people do:** Run the filesystem glob inside an API route handler to discover providers on each request.

**Why it's wrong:** Filesystem I/O on every request is expensive. Next.js may sandbox filesystem access in deployed environments. Race conditions possible during concurrent requests.

**Do this instead:** Run glob once at startup/module-load time. Cache in the registry singleton.

### Anti-Pattern 5: Config-file Provider Manifest

**What people do:** Maintain a `providers.json` listing which providers are active.

**Why it's wrong:** Two sources of truth — the file itself and the manifest. Contributors must update two things. The manifest goes stale. Breaks the "drop a file, done" contributor experience.

**Do this instead:** Convention-based discovery by filename suffix. A file named `*.provider.ts` in the right directory is self-registering.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Substack API | Wrapped inside `substack.provider.ts` | Credentials decrypted per-publish; `substack-api` npm package |
| LinkedIn ugcPosts API | Wrapped inside `linkedin.provider.ts` | Bearer token auth; existing HTTP fetch pattern unchanged |
| Exa API | Wrapped inside `exa.adapter.ts` | EXA_API_KEY env var; existing `exa-js` package |
| Reddit public JSON | Wrapped inside `reddit.adapter.ts` | No API key; User-Agent header required |
| Substack RSS feeds | Wrapped inside `substack-monitor.adapter.ts` | RSS parsing; no credentials needed |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `queue-runner.ts` ↔ `PublisherRegistry` | Direct import of registry singleton | Queue runner no longer imports individual adapters |
| `orchestrator.ts` ↔ `ResearchAdapterRegistry` | Direct import of registry singleton | Orchestrator no longer imports individual adapters |
| `loader.ts` ↔ `providers/` dir | Dynamic `import()` via glob | Only loader touches the filesystem at startup |
| `init.ts` ↔ API routes | Module-level singleton pattern | Ensures providers are loaded before first request |
| `schema.ts` platformEnum ↔ new platforms | Migration required | DB enum must be extended for new platform values |

## Build Order Implications

The pluggable provider system has a clear dependency chain. Build in this order:

1. **Define interfaces** (`registry.ts` for both publishing and research) — everything downstream depends on these contracts. Interfaces first, implementations second.

2. **Build registries** (Registry class in `registry.ts`) — stateless, easily unit-tested in isolation before any provider exists.

3. **Build loaders** (`loader.ts`) — depends on registry. Test with a mock provider to verify glob + register flow.

4. **Migrate Substack publisher** → `providers/substack.provider.ts` — reference implementation. Must satisfy `PublisherProvider` interface exactly. Existing tests for `substack.ts` should pass with minor import path changes.

5. **Migrate LinkedIn publisher** → `providers/linkedin.provider.ts` — second implementation validates interface is general enough.

6. **Update `queue-runner.ts`** to use `publisherRegistry.get()` — after both publisher providers exist and are tested, remove the if/else dispatch.

7. **Migrate research adapters** (`exa.adapter.ts`, `reddit.adapter.ts`, `substack-monitor.adapter.ts`) — same pattern as publishers but for `ResearchAdapterRegistry`.

8. **Update `orchestrator.ts`** to use `researchAdapterRegistry.getAll()` — after all adapters are migrated.

9. **Add `init.ts`/startup hooks** — wire loader calls into daemon startup and Next.js API route initialization.

10. **Integration test** — verify end-to-end: new provider file dropped in directory appears in registry, queue-runner dispatches to it, orchestrator fans out to it.

Dependency summary:
- Interfaces have no dependencies (build first)
- Registry depends on interface
- Loader depends on registry
- Migrated providers depend on interface only (not the old adapter files they replace)
- `queue-runner.ts` / `orchestrator.ts` updates depend on providers being migrated and tested

## Sources

- Slash Engineering registry pattern (file extension convention, discriminator, loadModules): https://puzzles.slash.com/blog/scaling-1m-lines-of-typescript-registries — HIGH confidence (production at 1M+ LoC TypeScript)
- Payload CMS plugin architecture (curried config function, array registration): https://payloadcms.com/docs/plugins/build-your-own — HIGH confidence (official docs)
- Fastify plugin system (encapsulation, explicit registration, interface contract): https://fastify.dev/docs/latest/Reference/Plugins/ — HIGH confidence (official docs)
- Node.js glob import implementation: https://dev.to/jiyingzhi/implementing-glob-imports-in-nodejs-3004 — MEDIUM confidence (implementation article)
- Function registry pattern (eliminating if/else with registry + canHandle): https://techhub.iodigital.com/articles/function-registry-pattern-react — MEDIUM confidence (engineering blog, verified pattern matches known references)
- Stateful blog: Node.js plugin system with Map-based registry and abstract class contract: https://stateful.com/blog/build-a-plugin-system-with-node — MEDIUM confidence
- TypeScript adapter pattern (interface + implements pattern): https://refactoring.guru/design-patterns/adapter/typescript/example — HIGH confidence (canonical reference)
- Orbitl existing codebase analysis: `.worktrees/build/src/lib/publishing/`, `.worktrees/build/src/lib/research/` — HIGH confidence (direct code inspection)

---
*Architecture research for: Pluggable provider system in TypeScript/Node.js (Orbitl)*
*Researched: 2026-02-26*
