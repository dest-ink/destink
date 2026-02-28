# Phase 2: Pluggable Provider System - Research

**Researched:** 2026-02-27
**Domain:** TypeScript plugin registry / auto-discovery pattern in Next.js + Node.js
**Confidence:** HIGH

## Summary

Phase 2 converts the current hardcoded if/else publisher dispatch and static adapter imports into an auto-discovered, self-describing plugin system. The codebase is a Next.js 16 app with a companion daemon, using TypeScript strict mode, Drizzle ORM, Vitest, and Zod. All target files are well-understood from direct inspection.

The core pattern is a generic `Registry<T>` class that scans a known directory at startup, dynamically imports each `*.provider.ts` or `*.adapter.ts` file, validates that the export satisfies the required interface, and registers it in a `Map<string, T>`. `queue-runner.ts` and `orchestrator.ts` then look up providers from the registry instead of branching on platform strings. Because the project runs in a Node.js context (Next.js API routes, daemon process), Node's built-in `fs` module plus dynamic `import()` are sufficient for discovery — no additional libraries are needed.

The primary risk area is the **module loader context**: Next.js API routes execute in a Next.js bundler context where `import()` of arbitrary filesystem paths may behave differently than in a plain Node daemon. The safest resolution is to initialize the registry once at the process boundary and expose it as a singleton — accessed from both the daemon and Next.js API routes — rather than re-scanning on every request.

**Primary recommendation:** Use a singleton registry initialized at process startup with dynamic `import()` and `path.resolve()` against the providers directory. Validate each module against the required interface using explicit duck-type guards before registration. Freeze the registry after startup to prevent mutation.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Interface contract design**
- Plain object exports (not classes) — each provider file exports a typed object literal matching its interface
- Separate interfaces for publishers (PublisherProvider) and research adapters (ResearchAdapter) — they solve different problems
- Publisher required methods: `publish(draft, channel)`, `formatDraft(draft, channel)`, plus metadata: `{ name, platform, apiVersion }`
- Publisher optional method: `getMetrics(postId)` — returns null if platform doesn't support it
- Research adapter interface is separate — `search(config)` returning `ResearchSource[]`

**Self-describing providers**
- Providers export display metadata: `{ name, displayName, description, icon }`
- Providers export a `configSchema` array: `[{ key, label, type, required }]` — types include `string`, `secret`, `url`, `number`
- UI renders config forms dynamically from schema — no hardcoded forms per platform
- Registry is single source of truth for platform dropdowns, config forms, available adapters

**Discovery & registration**
- Flat directory structure: `src/lib/publishing/providers/*.provider.ts` and `src/lib/research/adapters/*.adapter.ts`
- Startup scan: scan once, validate, build registry, freeze it
- Generic `Registry<T>` class — instantiated as `publisherRegistry` and `adapterRegistry`
- Research adapters are channel-configurable: each channel specifies which adapters to use

**Error & validation behavior**
- Malformed providers at startup: skip + log loud warning (file name + what's wrong). Valid providers still register
- Registry drives platform availability in UI — unregistered platforms don't appear as choices
- `PROVIDER_API_VERSION` constant for forward compatibility gating

**Migration strategy**
- All existing modules migrated at once: Substack publisher, LinkedIn publisher, Exa adapter, Reddit adapter, Substack Monitor adapter
- Brainstorm adapter also becomes pluggable — channels can opt in/out
- App is not live — no DB migration needed, clean break from old if/else dispatch
- No legacy code paths preserved

### Claude's Discretion
- Exact TypeScript type definitions and generics for Registry<T>
- Internal registry data structures (Map vs other)
- File scanning mechanism (glob pattern, fs.readdir, etc.)
- Zod schema generation from configSchema for runtime validation
- API endpoint design for exposing registry to the frontend
- Test strategy and coverage approach

### Deferred Ideas (OUT OF SCOPE)
- Post performance analytics dashboard (using getMetrics data) — future phase or v2
- Algorithmic content strategy based on performance data — v2
- Provider marketplace / community registry — v2 (PROV-03)

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PUB-01 | Publisher provider interface defined with TypeScript contract | Interface shape determined; plain object export with required + optional method signatures |
| PUB-02 | Publisher registry with Map-based lookup by platform key | Registry<T> with `Map<string, T>` internal structure; `get(platform)` and `getAll()` methods |
| PUB-03 | Auto-discovery of `*.provider.ts` files in publishers directory | `fs.readdirSync` filter + dynamic `import()` pattern; startup-only scan |
| PUB-04 | Substack publisher refactored to provider module | Existing `substack.ts` logic wrapped in PublisherProvider object literal |
| PUB-05 | LinkedIn publisher refactored to provider module | Existing `linkedin.ts` logic wrapped in PublisherProvider object literal |
| PUB-06 | Runtime interface validation at startup (reject malformed providers) | Duck-type guard checking required properties/methods; log warning + skip on failure |
| PUB-07 | PROVIDER_API_VERSION constant for compatibility gating | Exported constant in types file; checked during registration |
| RES-01 | Research adapter interface defined with TypeScript contract | `ResearchAdapter` interface with `search(config): Promise<ResearchSource[]>` plus metadata |
| RES-02 | Research adapter registry with fan-out dispatch (all run in parallel) | `adapterRegistry.getAll()` feeds `Promise.allSettled()`; dedup logic moves to orchestrator |
| RES-03 | Auto-discovery of `*.adapter.ts` files in research adapters directory | Same discovery pattern as PUB-03, different directory |
| RES-04 | Exa adapter refactored to pluggable module | Existing `exa.ts` logic wrapped in ResearchAdapter object literal |
| RES-05 | Reddit adapter refactored to pluggable module | Existing `reddit.ts` logic wrapped in ResearchAdapter object literal |
| RES-06 | Substack research adapter refactored to pluggable module | Existing `substack-monitor.ts` logic wrapped in ResearchAdapter object literal |

</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5 (already installed) | Interface contracts, type guards | Already in use; strict mode enabled |
| Node.js `fs` module | Built-in | Directory scanning at startup | No dep needed; Node context guaranteed for daemon and Next.js server |
| Dynamic `import()` | ESNext (tsconfig targets) | Load provider modules at runtime | Native JS; no bundler dep; works in Node and Next.js API context |
| Zod | ^3.25.76 (already installed) | Runtime configSchema validation | Already a project dep; user mentioned Zod for schema generation |
| `path` module | Built-in | Resolve absolute provider file paths | Required for dynamic import in Node; no dep needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `glob` | (not currently installed) | Pattern-matching file scan | Only needed if `fs.readdirSync` + filter proves insufficient; NOT recommended — keep simple |
| Vitest | ^4.0.18 (already installed) | Unit tests for registry, providers | Already in use and configured |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fs.readdirSync` | `glob` package | glob adds a dependency for a one-liner filter; `readdirSync` + `.endsWith('.provider.ts')` is sufficient for a flat directory |
| Dynamic `import()` | `require()` | Project uses ESNext modules (`"module": "esnext"` in tsconfig); `import()` is correct |
| Duck-type guards | Zod for module validation | Zod parses data, not functions; duck-type is the right tool for validating object shapes with callable methods |

**Installation:**
```bash
# No new packages needed — all required tools already in package.json
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── publishing/
│   │   ├── providers/               # Auto-discovered publisher providers
│   │   │   ├── substack.provider.ts
│   │   │   └── linkedin.provider.ts
│   │   ├── publisher-registry.ts    # Singleton publisherRegistry instance
│   │   ├── queue-runner.ts          # Updated: uses registry.get(platform)
│   │   └── scheduler.ts             # Unchanged
│   ├── research/
│   │   ├── adapters/                # Auto-discovered research adapters
│   │   │   ├── exa.adapter.ts
│   │   │   ├── reddit.adapter.ts
│   │   │   ├── substack-monitor.adapter.ts
│   │   │   └── brainstorm.adapter.ts
│   │   ├── adapter-registry.ts      # Singleton adapterRegistry instance
│   │   ├── orchestrator.ts          # Updated: uses adapterRegistry.getAll()
│   │   └── engine.ts                # Updated: uses adapterRegistry
│   └── providers/
│       ├── registry.ts              # Generic Registry<T> class
│       └── types.ts                 # PublisherProvider, ResearchAdapter interfaces, PROVIDER_API_VERSION
```

### Pattern 1: Generic Registry Class
**What:** A typed Map wrapper that discovers, validates, and freezes providers at startup.
**When to use:** Used for both `publisherRegistry` (keyed by `platform`) and `adapterRegistry` (keyed by `id`).

```typescript
// src/lib/providers/registry.ts
import fs from 'fs';
import path from 'path';

export class Registry<T extends { apiVersion: number }> {
  private readonly store = new Map<string, T>();
  private frozen = false;

  async loadDirectory(dir: string, suffix: string, validate: (mod: unknown) => T | null): Promise<void> {
    const files = fs.readdirSync(dir).filter(f => f.endsWith(suffix));
    for (const file of files) {
      const filePath = path.resolve(dir, file);
      try {
        const mod = await import(filePath);
        const provider = validate(mod.default ?? mod);
        if (!provider) {
          console.warn(`[Registry] Skipping ${file} — failed interface validation`);
          continue;
        }
        const key = this.getKey(provider);
        this.store.set(key, provider);
        console.log(`[Registry] Registered ${file} as "${key}"`);
      } catch (err) {
        console.warn(`[Registry] Skipping ${file} — import error:`, err);
      }
    }
    this.frozen = true;
    Object.freeze(this.store);
  }

  get(key: string): T | undefined {
    return this.store.get(key);
  }

  getAll(): T[] {
    return Array.from(this.store.values());
  }

  has(key: string): T | undefined {
    return this.store.get(key);
  }

  private getKey(provider: T): string {
    // Subclasses or callers inject key extractor
    return (provider as unknown as { platform?: string; id?: string }).platform
      ?? (provider as unknown as { id?: string }).id
      ?? '';
  }
}
```

### Pattern 2: PublisherProvider Interface
**What:** Plain object export shape that every publisher file must satisfy.
**When to use:** Enforced at registration time via duck-type guard.

```typescript
// src/lib/providers/types.ts
import type { drafts, channels } from '@/db/schema';

export const PROVIDER_API_VERSION = 1;

type DraftRow = typeof drafts.$inferSelect;
type ChannelRow = typeof channels.$inferSelect;

export interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'secret' | 'url' | 'number';
  required: boolean;
}

export interface PublisherProvider {
  // Metadata
  name: string;
  platform: string;       // registry key — matches channel.platform values
  displayName: string;
  description: string;
  icon?: string;
  apiVersion: number;     // must equal PROVIDER_API_VERSION
  configSchema: ConfigField[];

  // Required methods
  publish(draft: DraftRow, channel: ChannelRow): Promise<unknown>;
  formatDraft(draft: DraftRow, channel: ChannelRow): string;

  // Optional method
  getMetrics?(postId: string): Promise<Record<string, unknown> | null>;
}

export interface ResearchAdapter {
  // Metadata
  id: string;             // registry key
  name: string;
  displayName: string;
  description: string;
  apiVersion: number;

  // Required method
  search(config: ResearchConfig): Promise<ResearchSource[]>;
}
```

### Pattern 3: Publisher Provider File (Reference Implementation)
**What:** A single file that wraps existing logic and exports a `PublisherProvider` object.
**When to use:** Migration of each existing publisher.

```typescript
// src/lib/publishing/providers/substack.provider.ts
import { PROVIDER_API_VERSION } from '@/lib/providers/types';
import type { PublisherProvider } from '@/lib/providers/types';
import { publishToSubstack, formatForSubstack } from '../substack';

const substackProvider: PublisherProvider = {
  name: 'substack',
  platform: 'substack',
  displayName: 'Substack',
  description: 'Publish notes to your Substack publication',
  apiVersion: PROVIDER_API_VERSION,
  configSchema: [
    { key: 'publicationUrl', label: 'Publication URL', type: 'url', required: true },
    { key: 'token', label: 'Auth Token', type: 'secret', required: true },
  ],
  publish: publishToSubstack,
  formatDraft: (draft, _channel) => formatForSubstack(draft),
};

export default substackProvider;
```

### Pattern 4: Queue Runner After Refactor
**What:** Platform dispatch via registry lookup; no if/else chains.

```typescript
// src/lib/publishing/queue-runner.ts (key section)
import { publisherRegistry } from '@/lib/publishing/publisher-registry';

// Inside runPublishQueue():
const provider = publisherRegistry.get(item.channel.platform);
if (!provider) {
  throw new Error(`No publisher registered for platform '${item.channel.platform}'`);
}
platformResponse = await provider.publish(item.draft, item.channel);
```

### Pattern 5: Orchestrator After Refactor
**What:** Fan-out via `adapterRegistry.getAll()`; no hardcoded imports.

```typescript
// src/lib/research/orchestrator.ts (key section)
import { adapterRegistry } from '@/lib/research/adapter-registry';

export async function runResearch(config: ResearchConfig, adapterIds?: string[]): Promise<ResearchSource[]> {
  const adapters = adapterIds
    ? adapterIds.map(id => adapterRegistry.get(id)).filter(Boolean)
    : adapterRegistry.getAll();

  const results = await Promise.allSettled(adapters.map(a => a.search(config)));
  // ... same dedup logic as today
}
```

### Pattern 6: Singleton Registry Initialization
**What:** Registry loaded once at process boundary, exported as module singleton.

```typescript
// src/lib/publishing/publisher-registry.ts
import path from 'path';
import { Registry } from '@/lib/providers/registry';
import type { PublisherProvider } from '@/lib/providers/types';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';

function isPublisherProvider(val: unknown): val is PublisherProvider {
  if (typeof val !== 'object' || val === null) return false;
  const v = val as Record<string, unknown>;
  return (
    typeof v.name === 'string' &&
    typeof v.platform === 'string' &&
    typeof v.publish === 'function' &&
    typeof v.formatDraft === 'function' &&
    v.apiVersion === PROVIDER_API_VERSION &&
    Array.isArray(v.configSchema)
  );
}

class PublisherRegistry extends Registry<PublisherProvider> {
  // Override key extraction
}

export const publisherRegistry = new PublisherRegistry();

const providersDir = path.resolve(process.cwd(), 'src/lib/publishing/providers');

// Top-level await if module is ESM, or expose an init function called at app startup
export async function initPublisherRegistry(): Promise<void> {
  await publisherRegistry.loadDirectory(providersDir, '.provider.ts', (mod) =>
    isPublisherProvider(mod) ? mod : null
  );
}
```

### Anti-Patterns to Avoid
- **Top-level `await` in registry singletons in Next.js:** Next.js server components do not support top-level await in all module positions. Export an `initRegistry()` function and call it from the daemon entry point and from a Next.js instrumentation hook (`instrumentation.ts`), not at module load time.
- **Re-scanning the directory on every request:** Directory scan is a filesystem operation. Scan once at startup, freeze, serve from cache forever.
- **Using `require()` for dynamic loading:** Project tsconfig uses `"module": "esnext"` — use `import()` consistently.
- **Zod for validating provider modules:** Zod validates data shapes, not callable functions. Use a duck-type guard function (`isPublisherProvider`) that checks typeof for function properties.
- **Keeping old `if/else` dispatch as fallback:** User decision: clean break. No legacy paths.
- **Importing brainstorm adapter as a special case in engine.ts:** Brainstorm must become a pluggable adapter. engine.ts should use `adapterRegistry.getAll()` just like orchestrator.ts.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File pattern matching | Custom recursive glob | `fs.readdirSync` + `.endsWith()` | Providers live in flat directories; recursion is unnecessary complexity |
| Runtime schema validation | Custom validation logic | Duck-type guards for modules, Zod for configSchema field validation | Zod already in project; function presence requires typeof check, not Zod |
| Plugin registry | npm package like `fastify-plugin` or `require.extensions` hacks | Custom `Registry<T>` class | Existing solutions are framework-specific or too heavy; 50-line class is appropriate here |

**Key insight:** The "hard" part of plugin systems is startup ordering and module loading — both of which are solved by a simple `async initRegistry()` called once at process entry. The registry class itself is straightforward; the discipline is ensuring it's called before any request handler runs.

---

## Common Pitfalls

### Pitfall 1: Next.js instrumentation vs. daemon startup mismatch
**What goes wrong:** Registry is initialized in the daemon but not in the Next.js server process, so API routes that look up providers (e.g., a `/api/providers` endpoint) get an empty registry.
**Why it happens:** Next.js and the daemon are separate processes. Module singletons don't cross process boundaries.
**How to avoid:** Call `initPublisherRegistry()` and `initAdapterRegistry()` in BOTH the daemon entry point (`src/daemon/index.ts`) AND the Next.js instrumentation file (`src/instrumentation.ts`). The `instrumentation.ts` file is the correct Next.js hook for one-time server startup work.
**Warning signs:** API routes return empty provider lists while daemon publishes correctly.

### Pitfall 2: Dynamic import of TypeScript files at runtime
**What goes wrong:** `import('some-file.ts')` fails at runtime because `.ts` files are not executable directly in a production Node process.
**Why it happens:** `tsx` is used for development but production bundles compile to JS. Provider files need to work in both contexts.
**How to avoid:** In development (with `tsx`), `.ts` files load fine. For production (built Next.js), providers will be compiled to `.js`. The registry scanner must look for `.provider.js` in built output but `.provider.ts` in source. **Resolution:** Use `tsx` for the daemon (already the pattern via `"dev:daemon": "tsx watch ..."`), and the Next.js build will compile providers. During registry scanning, accept both `.provider.ts` and `.provider.js` file suffixes, OR scan only at source level (acceptable since app is not currently built for containerized prod use until Phase 4).
**Warning signs:** `ERR_UNKNOWN_FILE_EXTENSION` errors at runtime.

### Pitfall 3: Circular imports between registry and providers
**What goes wrong:** A provider imports from the registry to self-register; the registry imports providers for validation. Circular dependency causes `undefined` at load time.
**Why it happens:** Common mistake when designing self-registering plugins.
**How to avoid:** Providers must NEVER import from the registry. The registry imports and registers providers. This is the "pull" model (registry discovers providers), not the "push" model (providers register themselves). The user decision confirms the pull model: startup scan, not self-registration.
**Warning signs:** `Cannot access 'publisherRegistry' before initialization` errors.

### Pitfall 4: platformEnum mismatch with registry keys
**What goes wrong:** The `channels` table has a `platform` column typed as a Postgres enum `platformEnum(['linkedin', 'substack'])`. If a new provider registers with a platform key not in this enum, the channel creation route rejects it at the DB layer.
**Why it happens:** DB enum is a fixed list. Provider registry can register any string key.
**How to avoid:** The registry approach partially solves this: the channels API route currently validates `platform` against a hardcoded list (`['linkedin', 'substack']`). After Phase 2, the API route should validate against `publisherRegistry.has(platform)` instead. The Postgres enum remains `['linkedin', 'substack']` for now — expanding the enum requires a migration. Adding new platforms is a v2 concern noted in STATE.md. For Phase 2: replace the hardcoded platform check in the channels API route with a registry lookup.
**Warning signs:** Channel creation succeeds but publishing fails because provider is registered but platform enum doesn't include the value (or vice versa).

### Pitfall 5: Brainstorm adapter signature mismatch
**What goes wrong:** `brainstorm.ts` currently has a different function signature than `exa.ts`, `reddit.ts`, and `substack-monitor.ts`. It takes `(config, voiceProfile, recentTitles, channelId)` — four args — while the ResearchAdapter interface only passes `config`.
**Why it happens:** Brainstorm was designed as a specialized step in `engine.ts`, not as a generic adapter.
**How to avoid:** The `ResearchAdapter.search(config)` interface must be the contract. Either (a) extend `ResearchConfig` to carry the extra context brainstorm needs (voiceProfile, recentTitles, channelId), or (b) have the brainstorm adapter fetch its own extra context using channelId from config. Option (b) requires channelId to be part of `ResearchConfig`. The current `ResearchConfig` interface in `schema.ts` does NOT include channelId — it's passed separately. The cleanest solution: add optional fields to `ResearchConfig` (or a separate `ResearchContext` object passed alongside config) or let the adapter accept a wider config type. **Recommendation:** Pass `channelId` as an optional property on the config the adapter receives, OR change the ResearchAdapter interface to `search(config: ResearchConfig, context?: ResearchContext)`.
**Warning signs:** Brainstorm adapter compiles but produces empty results because it can't access channelId.

---

## Code Examples

Verified patterns from codebase inspection:

### Existing Publisher Pattern (before migration)
```typescript
// src/lib/publishing/queue-runner.ts — CURRENT (to be replaced)
if (item.channel.platform === 'substack') {
  platformResponse = await publishToSubstack(item.draft, item.channel);
} else if (item.channel.platform === 'linkedin') {
  platformResponse = await publishToLinkedIn(item.draft, item.channel);
} else {
  throw new Error(`Unknown platform '${item.channel.platform}'`);
}
```

### Existing Orchestrator Pattern (before migration)
```typescript
// src/lib/research/orchestrator.ts — CURRENT (to be replaced)
import { searchExa } from '@/lib/research/exa';
import { searchReddit } from '@/lib/research/reddit';
import { monitorSubstackFeeds } from '@/lib/research/substack-monitor';
// ...
const results = await Promise.allSettled([
  searchExa(config),
  searchReddit(config),
  monitorSubstackFeeds(config),
]);
```

### Duck-Type Guard (recommended pattern)
```typescript
function isPublisherProvider(val: unknown): val is PublisherProvider {
  if (typeof val !== 'object' || val === null) return false;
  const v = val as Record<string, unknown>;
  return (
    typeof v.name === 'string' &&
    typeof v.platform === 'string' &&
    typeof v.displayName === 'string' &&
    typeof v.publish === 'function' &&
    typeof v.formatDraft === 'function' &&
    v.apiVersion === PROVIDER_API_VERSION &&
    Array.isArray(v.configSchema)
  );
}
```

### Next.js Instrumentation Hook (startup initialization)
```typescript
// src/instrumentation.ts (Next.js convention — runs once at server start)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initPublisherRegistry } = await import('@/lib/publishing/publisher-registry');
    const { initAdapterRegistry } = await import('@/lib/research/adapter-registry');
    await initPublisherRegistry();
    await initAdapterRegistry();
  }
}
```

### ResearchConfig Extension for Brainstorm Context
```typescript
// Option: extend ResearchConfig with optional brainstorm fields
// (modify schema.ts interface — no DB migration needed, it's a JSONB type)
export interface ResearchConfig {
  // ... existing fields ...
  // Optional context for brainstorm adapter
  channelId?: string;
  voiceProfile?: VoiceProfile;
  recentTitles?: string[];
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CommonJS `require()` with `require.extensions` hacks | ESM dynamic `import()` | Node 12+, widespread ~2021 | Clean async module loading |
| Self-registering plugins (plugins import registry) | Pull model (registry discovers plugins) | N/A — always the safer pattern | Eliminates circular deps |
| Class-based plugins | Plain object exports | TypeScript era | Simpler, more composable, easier to test |
| Next.js `pages/_app.js` for startup hooks | `src/instrumentation.ts` | Next.js 13.4+ | Stable one-time server init hook |

**Deprecated/outdated:**
- `require.extensions`: Node.js discouraged this for years; do not use.
- Plugin class inheritance: Object literals with explicit interfaces are preferred in modern TypeScript patterns.

---

## Open Questions

1. **ResearchAdapter brainstorm signature**
   - What we know: `brainstorm.ts` takes `(config, voiceProfile, recentTitles, channelId)` — 4 args, not 1
   - What's unclear: Whether to extend `ResearchConfig` or define a `ResearchContext` wrapper
   - Recommendation: Planner should pick "extend ResearchConfig with optional fields" (simpler, no new type) OR "adapter fetches its own context by channelId" (cleaner interface, extra DB call). Either works. Flag as planner decision.

2. **Where `engine.ts` lands after refactor**
   - What we know: `engine.ts` calls brainstorm + exa + reddit + substack-monitor directly AND does AI analysis. It overlaps with `orchestrator.ts` which calls the same three adapters without brainstorm.
   - What's unclear: Do `engine.ts` and `orchestrator.ts` merge into one, or does engine.ts use adapterRegistry and orchestrator.ts is retired?
   - Recommendation: `orchestrator.ts` is the lower-level fan-out; `engine.ts` is the higher-level pipeline (fan-out + AI ranking + DB persist). After Phase 2, `engine.ts` should use `adapterRegistry.getAll()` (or `adapterRegistry.get(id)` per channel config) and `orchestrator.ts` may be simplified or merged. Planner should decide whether to keep both files or collapse into one.

3. **channels API route platform validation**
   - What we know: `src/app/api/channels/route.ts` hardcodes `['linkedin', 'substack']` as valid platforms.
   - What's unclear: Whether updating this validation is in-scope for Phase 2 or left to Phase 3 UI work.
   - Recommendation: Include it in Phase 2. Without it, the registry-driven promise ("platform dropdown comes from registered providers") is broken — the API would reject valid platforms the registry knows about. Low effort change.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUB-01 | PublisherProvider interface + types compile correctly | unit (type-check) | `npx tsc --noEmit` | Wave 0 |
| PUB-02 | Registry.get() returns registered provider by platform key | unit | `npm test -- tests/lib/publishing/registry.test.ts` | Wave 0 |
| PUB-03 | loadDirectory() scans dir and registers matching files | unit (mock fs) | `npm test -- tests/lib/publishing/registry.test.ts` | Wave 0 |
| PUB-04 | Substack provider: publish() and formatDraft() behave correctly | unit | `npm test -- tests/lib/publishing/providers/substack.provider.test.ts` | Wave 0 |
| PUB-05 | LinkedIn provider: publish() and formatDraft() behave correctly | unit | `npm test -- tests/lib/publishing/providers/linkedin.provider.test.ts` | Wave 0 |
| PUB-06 | Malformed provider is skipped with warning, valid ones still register | unit | `npm test -- tests/lib/publishing/registry.test.ts` | Wave 0 |
| PUB-07 | Provider with wrong apiVersion is rejected at startup | unit | `npm test -- tests/lib/publishing/registry.test.ts` | Wave 0 |
| RES-01 | ResearchAdapter interface + types compile correctly | unit (type-check) | `npx tsc --noEmit` | Wave 0 |
| RES-02 | adapterRegistry.getAll() feeds fan-out in orchestrator | unit | `npm test -- tests/lib/research/orchestrator.test.ts` | Exists (needs update) |
| RES-03 | loadDirectory() scans adapters dir and registers matching files | unit (mock fs) | `npm test -- tests/lib/research/registry.test.ts` | Wave 0 |
| RES-04 | Exa adapter search() returns ResearchSource[] correctly | unit | `npm test -- tests/lib/research/adapters/exa.adapter.test.ts` | Wave 0 |
| RES-05 | Reddit adapter search() returns ResearchSource[] correctly | unit | `npm test -- tests/lib/research/adapters/reddit.adapter.test.ts` | Wave 0 |
| RES-06 | Substack monitor adapter search() returns ResearchSource[] correctly | unit | `npm test -- tests/lib/research/adapters/substack-monitor.adapter.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + `npx tsc --noEmit` exit 0 before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/providers/registry.test.ts` — covers PUB-02, PUB-03, PUB-06, PUB-07, RES-03 (shared Registry<T> class)
- [ ] `tests/lib/publishing/providers/substack.provider.test.ts` — covers PUB-04
- [ ] `tests/lib/publishing/providers/linkedin.provider.test.ts` — covers PUB-05
- [ ] `tests/lib/research/adapters/exa.adapter.test.ts` — covers RES-04 (existing `tests/lib/research/exa.test.ts` can be adapted)
- [ ] `tests/lib/research/adapters/reddit.adapter.test.ts` — covers RES-05 (existing `tests/lib/research/reddit.test.ts` can be adapted)
- [ ] `tests/lib/research/adapters/substack-monitor.adapter.test.ts` — covers RES-06 (existing `tests/lib/research/substack-monitor.test.ts` can be adapted)
- [ ] `tests/lib/research/orchestrator.test.ts` — EXISTS but must be updated to mock `adapterRegistry` instead of individual adapter modules (covers RES-02)

Note: Existing tests for exa, reddit, substack-monitor, linkedin, substack cover the pure function logic (buildExaQueries, formatForLinkedIn, etc.) and remain valid. The adapter/provider test files above test the wrapper objects specifically.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — all files read directly from `/Users/dknell/Projects/orbitl/src/`
  - `src/lib/publishing/queue-runner.ts` — current dispatch logic
  - `src/lib/research/orchestrator.ts` — current fan-out logic
  - `src/lib/research/engine.ts` — full research pipeline with brainstorm
  - `src/lib/publishing/substack.ts`, `linkedin.ts` — publisher implementations
  - `src/lib/research/exa.ts`, `reddit.ts`, `substack-monitor.ts`, `brainstorm.ts` — adapter implementations
  - `src/db/schema.ts` — type definitions, ResearchConfig, ResearchSource
  - `src/app/api/channels/route.ts` — hardcoded platform validation to replace
  - `package.json` — dependency inventory
  - `tsconfig.json` — module system settings
  - `vitest.config.ts` — test infrastructure
  - `.planning/phases/02-pluggable-provider-system/02-CONTEXT.md` — user decisions

### Secondary (MEDIUM confidence)
- Next.js instrumentation API — `src/instrumentation.ts` is the documented hook for one-time server startup; pattern is standard Next.js 13.4+ practice

### Tertiary (LOW confidence)
- None — all findings are grounded in direct codebase inspection or established TypeScript patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in `package.json`; no new deps required
- Architecture: HIGH — based on direct code inspection of all files to be modified; patterns are established TypeScript idioms
- Pitfalls: HIGH — all identified pitfalls are derived from concrete mismatches found in the actual codebase (brainstorm signature, platformEnum constraint, Next.js two-process topology)

**Research date:** 2026-02-27
**Valid until:** 2026-03-29 (30 days — stable TypeScript patterns, no fast-moving deps)
