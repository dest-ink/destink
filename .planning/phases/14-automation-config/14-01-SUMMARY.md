---
phase: 14-automation-config
plan: 01
subsystem: database
tags: [drizzle, postgres, node-cron, cron, schema, migration, vitest, tdd]

# Dependency graph
requires:
  - phase: 12-config-cleanup
    provides: researchers table with maxDraftsPerRun and autoDraft columns (FK target)
provides:
  - automationSchedules Drizzle schema table with FK cascade to researchers
  - INTERVAL_PRESETS constant mapping 5 friendly labels to cron expressions with hours
  - getNextRunAt utility returning next Date or null for a cron expression
  - Migration 0006 applied to dev DB
affects:
  - 14-automation-config (plans 02+, CRUD API and UI consume schema and cron-utils)
  - 15-automation-worker (reads automationSchedules table; resolves nullable overrides)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TimeMatcher accessed via createRequire + derived absolute path from node-cron's main entry (bypasses exports map restriction)"
    - "TDD: failing test commit (test) -> implementation commit (feat)"

key-files:
  created:
    - src/lib/cron-utils.ts
    - tests/lib/cron-utils.test.ts
    - src/db/migrations/0006_misty_hemingway.sql
  modified:
    - src/db/schema.ts

key-decisions:
  - "TimeMatcher loaded via createRequire(_require.resolve('node-cron') path derivation) -- node-cron v4 exports map blocks subpath imports; absolute path via resolve is portable and version-safe"
  - "automationSchedules.autoDraft and maxDraftsPerRun are nullable (no .notNull()) -- null means inherit from researcher; worker resolves via ?? operator"

patterns-established:
  - "Nullable override columns: null = inherit from parent entity (researcher); worker resolves schedule.field ?? researcher.field"

requirements-completed: [AUTO-01]

# Metrics
duration: 8min
completed: 2026-03-14
---

# Phase 14 Plan 01: Automation Config Foundation Summary

**automationSchedules Drizzle table with FK cascade to researchers, cron-utils module with INTERVAL_PRESETS and getNextRunAt, and migration applied to dev database**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-14T21:48:45Z
- **Completed:** 2026-03-14T21:56:10Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `src/lib/cron-utils.ts` with `INTERVAL_PRESETS` (5 entries: Twice daily/12h, Daily/24h, Every other day/48h, Every 3 days/72h, Weekly/168h) and `getNextRunAt` returning a future Date or null
- 12 unit tests written via TDD (RED then GREEN) covering all presets, valid/invalid expressions, and `from` param behavior
- Added `automationSchedules` table to schema with nullable override columns (`autoDraft`, `maxDraftsPerRun`) that Phase 15 worker resolves via `??`
- Migration 0006 generated and applied to dev database

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for cron-utils** - `cafeb8d` (test)
2. **Task 1 GREEN: Implement cron-utils** - `fe64c86` (feat)
3. **Task 2: Schema + migration** - `fec4b3b` (feat)

**Plan metadata:** (docs commit - see below)

_Note: TDD tasks have separate test and feat commits_

## Files Created/Modified
- `src/lib/cron-utils.ts` - INTERVAL_PRESETS constant and getNextRunAt utility using node-cron TimeMatcher
- `tests/lib/cron-utils.test.ts` - 12 unit tests covering presets and getNextRunAt behavior
- `src/db/schema.ts` - automationSchedules table added after researcherChannels
- `src/db/migrations/0006_misty_hemingway.sql` - CREATE TABLE migration for automation_schedules

## Decisions Made
- **TimeMatcher import path**: node-cron v4's exports map does not expose `./dist/cjs/time/time-matcher` as a subpath. Used `createRequire` with `_require.resolve('node-cron')` to get the main entry path, then derived the time-matcher path via `path.dirname` + join. This is portable across pnpm/npm installations and gracefully returns null if the path ever moves.
- **Nullable override columns**: `autoDraft` and `maxDraftsPerRun` on `automationSchedules` have no `.notNull()` constraint — null means "inherit from researcher". Phase 15 worker resolves: `schedule.maxDraftsPerRun ?? researcher.maxDraftsPerRun`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TimeMatcher import path bypasses exports map**
- **Found during:** Task 1 (GREEN phase — implementing getNextRunAt)
- **Issue:** Plan specified `import from 'node-cron/dist/cjs/time/time-matcher'` but node-cron v4 exports map blocks all subpath imports, causing ERR_PACKAGE_PATH_NOT_EXPORTED
- **Fix:** Used `createRequire` + `_require.resolve('node-cron')` to derive the absolute path to `time-matcher.js` portably, wrapped in try/catch as plan specified
- **Files modified:** src/lib/cron-utils.ts
- **Verification:** All 12 tests pass including getNextRunAt returning correct future dates
- **Committed in:** fe64c86 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug/import path)
**Impact on plan:** Fix was necessary for the implementation to work at all. Same functionality delivered, more robust import strategy.

## Issues Encountered
- Postgres container was not running when `drizzle-kit push` was attempted. Started container via `docker compose up -d postgres`, then push succeeded on retry. No schema or migration changes needed.

## Next Phase Readiness
- `automationSchedules` table and `cron-utils` module are ready for Phase 14 Plan 02 (CRUD API routes) and Plan 03 (Automation UI)
- Phase 15 worker will read `automationSchedules` table and call `getNextRunAt` to refresh `nextRunAt` timestamps

---
*Phase: 14-automation-config*
*Completed: 2026-03-14*
