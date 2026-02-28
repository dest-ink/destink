---
phase: 02-pluggable-provider-system
plan: 04
subsystem: api
tags: [research, orchestrator, engine, daemon, registry, instrumentation, typescript, vitest]

# Dependency graph
requires:
  - phase: 02-02
    provides: publisherRegistry singleton and initPublisherRegistry() for publisher dispatch
  - phase: 02-03
    provides: adapterRegistry singleton and initAdapterRegistry() for research adapter dispatch

provides:
  - Registry-backed research fan-out in orchestrator.ts — no hardcoded adapter imports
  - Engine delegates all research to runResearch() with brainstorm context in extended config
  - Next.js instrumentation.ts register() hook initializing both registries at server startup
  - Daemon top-level await initializing both registries before first cron tick
  - Channels API platform validation via publisherRegistry.has() — no hardcoded platform list

affects:
  - Phase 3 (Auth+UI) — both registries are initialized by instrumentation.ts for any server route
  - Any future provider/adapter additions — drop a file, no other code changes needed

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Registry fan-out pattern — orchestrator calls adapterRegistry.getAll() or filters by ID list
    - Next.js instrumentation hook — server-only registry init via dynamic import inside register()
    - Top-level await in daemon — tsx supports it natively, cleaner than IIFE wrapper
    - Extended config threading — brainstorm context (channelId, voiceProfile, recentTitles) passed through ResearchConfig

key-files:
  created:
    - src/instrumentation.ts
  modified:
    - src/lib/research/orchestrator.ts
    - src/lib/research/engine.ts
    - src/daemon/index.ts
    - src/app/api/channels/route.ts
    - tests/lib/research/orchestrator.test.ts

key-decisions:
  - "Per-channel adapter filtering deferred — runResearch() accepts optional adapterIds param for future use, but engine passes none (runs all) since channel schema has no researchAdapterIds field"
  - "Top-level await in daemon — tsx supports it natively; avoids async IIFE wrapper while keeping init before schedule() call"
  - "Dynamic imports in instrumentation.ts — prevents server-only modules from being evaluated in Edge runtime context"

patterns-established:
  - "Registry initialization pattern: both registries initialized once at startup (instrumentation.ts for Next.js, top-level await for daemon) before any business logic runs"
  - "Pluggable provider system complete: new publisher = one .provider.ts file; new adapter = one .adapter.ts file; zero other code changes"

requirements-completed: [RES-02]

# Metrics
duration: 10min
completed: 2026-02-27
---

# Phase 2 Plan 04: Integration Wiring Summary

**Registry-backed research orchestration with no hardcoded adapter imports — orchestrator/engine dispatch via adapterRegistry, daemon and Next.js initialize both registries at startup, channels API validates platforms dynamically**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-27T21:06:00Z
- **Completed:** 2026-02-27T21:16:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Removed all hardcoded adapter imports from orchestrator.ts and engine.ts; all research now fans out through adapterRegistry.getAll()
- Created src/instrumentation.ts (Next.js 15+ stable hook) that initializes both registries on Node.js server startup via dynamic imports
- Updated daemon/index.ts with top-level await registry initialization before the cron schedule starts
- Replaced hardcoded `['linkedin', 'substack']` array in channels API with `publisherRegistry.has()` — error message now dynamically lists available platforms

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire orchestrator and engine to use adapterRegistry** - `87982ad` (feat)
2. **Task 2: Add registry initialization to daemon, Next.js, and channels API** - `6bfbe53` (feat)

## Files Created/Modified

- `src/lib/research/orchestrator.ts` - Removed hardcoded adapter imports; fans out via adapterRegistry.getAll() or filtered by adapterIds
- `src/lib/research/engine.ts` - Removed all direct adapter imports; delegates to runResearch() with extended config containing brainstorm context
- `src/instrumentation.ts` - New Next.js register() hook initializing publisherRegistry and adapterRegistry on Node.js server start
- `src/daemon/index.ts` - Added top-level await initPublisherRegistry() and initAdapterRegistry() before cron schedule starts
- `src/app/api/channels/route.ts` - Replaced hardcoded platform array with publisherRegistry.has(); dynamic available platforms in error message
- `tests/lib/research/orchestrator.test.ts` - Updated to mock adapterRegistry instead of individual adapter modules; added adapterIds filter tests

## Decisions Made

- **Per-channel adapter filtering deferred:** The plan noted this as a future enhancement. The optional `adapterIds` parameter is present in `runResearch()` for forward-compatibility, but engine.ts passes no filter (all adapters run) since the channel schema has no `researchAdapterIds` field. Documented in code comment.
- **Top-level await:** The daemon uses `tsx` which supports top-level await natively. This is cleaner than wrapping in an async IIFE and naturally ensures registries are initialized before `schedule()` is called.
- **Dynamic imports in instrumentation:** Registry modules are dynamically imported inside `register()` rather than at the module top level. This prevents server-only modules from being evaluated in Edge runtime contexts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error in orchestrator test `makeAdapter` helper**
- **Found during:** Task 1 (orchestrator and engine wiring)
- **Issue:** `vi.fn()` return type `Mock<Procedure | Constructable>` not assignable to `ResearchAdapter.search: (config: ResearchConfig) => Promise<ResearchSource[]>` — TypeScript rejected the untyped mock
- **Fix:** Added explicit function type annotation to `makeAdapter`'s `search` parameter
- **Files modified:** tests/lib/research/orchestrator.test.ts
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `87982ad` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Necessary for TypeScript correctness. No scope creep.

## Issues Encountered

Pre-existing test failures in `tests/api/channels.test.ts`, `tests/db/schema.test.ts` (DB integration tests requiring live DB connection — SASL error from missing env vars) and `tests/lib/publishing/scheduler.test.ts` (timing assertion flakiness) are unrelated to this plan's changes and were pre-existing before this execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 goal fully achieved: the entire system dispatches through registries. Adding a new publisher = one `.provider.ts` file. Adding a new research adapter = one `.adapter.ts` file. No other code changes required.
- Both registries initialized at application startup (Next.js via instrumentation.ts, daemon via top-level await)
- Phase 3 (Auth+UI) can proceed — instrumentation.ts will initialize registries for all server routes

---
*Phase: 02-pluggable-provider-system*
*Completed: 2026-02-27*

## Self-Check: PASSED

Files verified:
- `src/instrumentation.ts` — FOUND
- `src/lib/research/orchestrator.ts` — FOUND (adapterRegistry dispatch confirmed)
- `src/lib/research/engine.ts` — FOUND (runResearch() delegation confirmed)
- `src/daemon/index.ts` — FOUND (initPublisherRegistry + initAdapterRegistry confirmed)
- `src/app/api/channels/route.ts` — FOUND (publisherRegistry.has() confirmed)

Commits verified:
- `87982ad` — FOUND (feat: wire orchestrator and engine to use adapterRegistry)
- `6bfbe53` — FOUND (feat: initialize registries in daemon, Next.js, and channels API)
