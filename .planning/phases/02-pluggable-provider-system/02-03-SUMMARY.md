---
phase: 02-pluggable-provider-system
plan: 03
subsystem: api
tags: [research, adapters, registry, typescript, vitest]

# Dependency graph
requires:
  - phase: 02-01
    provides: ResearchAdapter interface, PROVIDER_API_VERSION, generic Registry<T> class

provides:
  - Four ResearchAdapter wrappers (exa, reddit, substack-monitor, brainstorm) in src/lib/research/adapters/
  - adapterRegistry singleton and initAdapterRegistry() in adapter-registry.ts
  - isResearchAdapter() duck-type guard (exported for external testability)
  - Extended ResearchConfig with optional brainstorm context fields (channelId, voiceProfile, recentTitles)
  - 23 unit tests verifying each adapter delegates correctly

affects:
  - 02-04 (orchestrator and engine wiring to use adapterRegistry)
  - Any code importing ResearchConfig (new optional fields are backward-compatible)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Plain-object ResearchAdapter — adapters are POJOs satisfying TypeScript interface, not class instances
    - Flat config extension — brainstorm context passed through ResearchConfig rather than separate function args
    - Adapter delegation pattern — adapter.search() wraps existing function, preserving original implementation

key-files:
  created:
    - src/lib/research/adapters/exa.adapter.ts
    - src/lib/research/adapters/reddit.adapter.ts
    - src/lib/research/adapters/substack-monitor.adapter.ts
    - src/lib/research/adapters/brainstorm.adapter.ts
    - src/lib/research/adapter-registry.ts
    - tests/lib/research/adapters/exa.adapter.test.ts
    - tests/lib/research/adapters/reddit.adapter.test.ts
    - tests/lib/research/adapters/substack-monitor.adapter.test.ts
    - tests/lib/research/adapters/brainstorm.adapter.test.ts
  modified:
    - src/db/schema.ts

key-decisions:
  - "Brainstorm config flattening — extended ResearchConfig with optional channelId/voiceProfile/recentTitles instead of adapter holding separate state; enables uniform search(config) signature across all adapters"
  - "Empty-array fallback for missing channelId — brainstorm adapter returns [] rather than throwing when channelId is absent, keeping adapter failures non-fatal"
  - "isResearchAdapter exported as named export — testable independently and importable by orchestrator for validation"

patterns-established:
  - "Adapter file pattern: default export a ResearchAdapter POJO, import PROVIDER_API_VERSION and type from @/lib/providers/types"
  - "Registry initialization: initAdapterRegistry() calls loadDirectory() with .adapter.ts suffix; invalid files emit console.warn and are skipped"

requirements-completed: [RES-03, RES-04, RES-05, RES-06]

# Metrics
duration: 5min
completed: 2026-02-28
---

# Phase 2 Plan 03: Research Adapters and Registry Summary

**Four research adapters (exa, reddit, substack-monitor, brainstorm) wrapped as ResearchAdapter POJOs with auto-discovering adapterRegistry singleton and 23 unit tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-28T01:59:32Z
- **Completed:** 2026-02-28T02:04:42Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Extended ResearchConfig with optional brainstorm context fields (channelId, voiceProfile, recentTitles) enabling uniform search(config) signature across all adapters
- Created four adapter files wrapping existing research functions as ResearchAdapter POJOs; exa/reddit/substack-monitor delegate directly, brainstorm extracts config fields to reconstruct the 4-arg signature
- Created adapterRegistry singleton with isResearchAdapter duck-type guard and initAdapterRegistry() auto-discovery; mirrors publisher-registry pattern
- 23 unit tests passing — adapter delegation verified with vi.mock(), brainstorm tests verify 4-arg mapping and missing-channelId fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ResearchConfig and create four research adapter files** - `2183708` (feat)
2. **Task 2: Create adapter registry singleton** - `0359e96` (feat)

## Files Created/Modified

- `src/db/schema.ts` - Added optional channelId, voiceProfile, recentTitles to ResearchConfig
- `src/lib/research/adapters/exa.adapter.ts` - ResearchAdapter wrapping searchExa
- `src/lib/research/adapters/reddit.adapter.ts` - ResearchAdapter wrapping searchReddit
- `src/lib/research/adapters/substack-monitor.adapter.ts` - ResearchAdapter wrapping monitorSubstackFeeds
- `src/lib/research/adapters/brainstorm.adapter.ts` - ResearchAdapter wrapping brainstormTopics with config field extraction
- `src/lib/research/adapter-registry.ts` - adapterRegistry singleton, isResearchAdapter guard, initAdapterRegistry()
- `tests/lib/research/adapters/exa.adapter.test.ts` - 5 tests for exa adapter
- `tests/lib/research/adapters/reddit.adapter.test.ts` - 5 tests for reddit adapter
- `tests/lib/research/adapters/substack-monitor.adapter.test.ts` - 5 tests for substack-monitor adapter
- `tests/lib/research/adapters/brainstorm.adapter.test.ts` - 8 tests for brainstorm adapter (argument mapping + fallbacks)

## Decisions Made

- **Brainstorm config flattening:** Extended ResearchConfig with optional fields rather than passing brainstorm context via separate adapter state. This preserves the uniform `search(config)` interface across all adapters while solving the 4-arg brainstormTopics signature mismatch.
- **Empty-array fallback:** Brainstorm adapter returns `[]` when channelId is absent rather than throwing. Keeps adapter failures non-fatal, consistent with warn-and-continue philosophy.
- **isResearchAdapter exported:** Named export enables external testing and can be used by orchestrator/engine for inline validation if needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four research adapters are ready for Plan 02-04 to wire orchestrator.ts and engine.ts to use adapterRegistry instead of hardcoded imports
- adapterRegistry.initAdapterRegistry() must be called at application startup before research runs
- ResearchConfig extension is backward-compatible (all new fields are optional) — existing DB records and code paths continue working

---
*Phase: 02-pluggable-provider-system*
*Completed: 2026-02-28*

## Self-Check: PASSED

All files verified present on disk. Both commits (2183708, 0359e96) confirmed in git log.
