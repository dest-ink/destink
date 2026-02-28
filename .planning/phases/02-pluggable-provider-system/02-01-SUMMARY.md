---
phase: 02-pluggable-provider-system
plan: "01"
subsystem: api
tags: [providers, registry, typescript, interfaces, vitest]

# Dependency graph
requires:
  - phase: 01-cleanup-foundation
    provides: Drizzle schema types (DraftRow, ChannelRow, ResearchConfig, ResearchSource) used by provider interfaces
provides:
  - PublisherProvider interface with publish, formatDraft, optional getMetrics, configSchema
  - ResearchAdapter interface with search method and metadata
  - ConfigField interface for dynamic config UI rendering
  - PROVIDER_API_VERSION = 1 constant for compatibility gating
  - Generic Registry<T> class with loadDirectory, register, get, getAll, has, keys
affects: [02-02-publisher-providers, 02-03-research-adapters, all Phase 2 plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provider as plain object contract — interfaces not classes, implementations are plain objects satisfying the interface"
    - "Generic Registry<T> with injected keyExtractor — same class serves publisher (keyed by platform) and adapter (keyed by id) registries"
    - "vi.hoisted() pattern for Vitest ESM module mocking — mock functions declared via vi.hoisted() so they are available in vi.mock() factory"
    - "loadDirectory() freeze pattern — registry is mutable before load, immutable after"

key-files:
  created:
    - src/lib/providers/types.ts
    - src/lib/providers/registry.ts
    - tests/lib/providers/registry.test.ts
  modified: []

key-decisions:
  - "Plain object interfaces (not class contracts) — providers are POJOs satisfying TypeScript interface, not class instances"
  - "Version gating delegated to validator — Registry<T> does not check PROVIDER_API_VERSION; the caller's validate() function is responsible"
  - "loadDirectory() freeze is permanent — once called, register() always throws regardless of success or failure of the scan"
  - "warn-and-continue for invalid providers — unloadable or invalid files emit console.warn and are skipped; one bad file never blocks others"

patterns-established:
  - "Registry<T> with keyExtractor injection: new Registry<PublisherProvider>(p => p.platform)"
  - "Validator function pattern: (mod: unknown) => T | null — returns typed provider or null for invalid"
  - "vi.hoisted() for ESM mocks: const { fn } = vi.hoisted(() => ({ fn: vi.fn() })); vi.mock('module', () => ({ fn }))"

requirements-completed: [PUB-01, PUB-07, RES-01]

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 2 Plan 01: Provider Type Contracts and Generic Registry Summary

**TypeScript provider interface contracts (PublisherProvider, ResearchAdapter, ConfigField) and generic Registry<T> class with directory-scan, validate-and-register, and freeze-after-load semantics — 16 unit tests all passing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-28T01:53:34Z
- **Completed:** 2026-02-28T01:57:12Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Defined `PublisherProvider`, `ResearchAdapter`, `ConfigField` interfaces and `PROVIDER_API_VERSION = 1` constant, typed against Drizzle `$inferSelect` row types
- Implemented `Registry<T>` with `loadDirectory()` (fs scan, dynamic import, validate, register, freeze), `register()`, `get()`, `getAll()`, `has()`, `keys()`
- 16 unit tests covering all registry behaviors including ESM mocking of `fs.readdirSync` using `vi.hoisted()`

## Task Commits

Each task was committed atomically:

1. **Task 1: Define PublisherProvider, ResearchAdapter, and ConfigField interfaces** - `713819e` (feat)
2. **Task 2: Implement generic Registry class with tests** - `1a8dfa5` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `src/lib/providers/types.ts` - PublisherProvider, ResearchAdapter, ConfigField interfaces and PROVIDER_API_VERSION constant
- `src/lib/providers/registry.ts` - Generic Registry<T> class with loadDirectory, register, get, getAll, has, keys
- `tests/lib/providers/registry.test.ts` - 16 unit tests for Registry<T> using Vitest with vi.hoisted() ESM mocking

## Decisions Made
- Plain object interfaces: providers are POJOs, not class instances. Aligns with plan's "plain object exports" direction.
- Version gating delegated to validators: Registry<T> is generic and does not know about PROVIDER_API_VERSION — the caller's `validate()` function handles version checks.
- Freeze is permanent: `loadDirectory()` always freezes regardless of scan success/failure, making the lifecycle predictable.
- warn-and-continue: invalid/unloadable files produce `console.warn` and are skipped, so one bad community provider never breaks all others.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ESM module mocking approach for fs.readdirSync in tests**
- **Found during:** Task 2 (registry test implementation)
- **Issue:** `vi.spyOn(fsMock, 'readdirSync')` throws "Cannot spy on export — Module namespace is not configurable in ESM" in Vitest ESM mode. Plain `const mockFn = vi.fn()` before `vi.mock()` throws "Cannot access before initialization" because `vi.mock()` is hoisted above the const.
- **Fix:** Used `vi.hoisted(() => ({ mockReaddirSync: vi.fn() }))` to create the mock function in the hoisted scope, then passed it to the `vi.mock('fs', ...)` factory. This is the correct Vitest pattern for stable ESM mock references.
- **Files modified:** tests/lib/providers/registry.test.ts
- **Verification:** All 16 tests pass
- **Committed in:** 1a8dfa5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test implementation)
**Impact on plan:** Auto-fix was necessary for test correctness in ESM mode. No scope creep.

## Issues Encountered
- Vitest ESM mocking requires `vi.hoisted()` for mock function references used inside `vi.mock()` factory — documented as established pattern for future test files that mock Node built-ins.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `src/lib/providers/types.ts` exports are ready for 02-02 (publisher providers) and 02-03 (research adapters) to import and satisfy
- `Registry<T>` is ready for 02-02 to instantiate as `publisherRegistry` and 02-03 as `adapterRegistry`
- Downstream plans can import `{ PublisherProvider, ResearchAdapter, PROVIDER_API_VERSION }` from `@/lib/providers/types` and `{ Registry }` from `@/lib/providers/registry` without modification

---
*Phase: 02-pluggable-provider-system*
*Completed: 2026-02-28*

## Self-Check: PASSED

- src/lib/providers/types.ts: FOUND
- src/lib/providers/registry.ts: FOUND
- tests/lib/providers/registry.test.ts: FOUND
- 02-01-SUMMARY.md: FOUND
- Commit 713819e (Task 1): FOUND
- Commit 1a8dfa5 (Task 2): FOUND
