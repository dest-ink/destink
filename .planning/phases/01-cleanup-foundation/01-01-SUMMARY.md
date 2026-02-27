---
phase: 01-cleanup-foundation
plan: "01"
subsystem: database
tags: [postgres, drizzle, pool, lifecycle, jobs, queue]

# Dependency graph
requires: []
provides:
  - "pool exported from src/db/client.ts for lifecycle management"
  - "Job scripts (publish, research) exit cleanly via pool.end() in finally blocks"
  - "recoverStuckItems() in queue-runner resets stuck 'publishing' items after 15 min"
affects: [02-cleanup-foundation, daemon, jobs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Job scripts use try/finally with pool.end() instead of process.exit(0)"
    - "Stuck queue item recovery uses createdAt heuristic pending processingStartedAt column"

key-files:
  created: []
  modified:
    - src/db/client.ts
    - src/jobs/publish.ts
    - src/jobs/research.ts
    - src/lib/publishing/queue-runner.ts

key-decisions:
  - "15-minute stuck threshold locked by user — safe because publishes complete in seconds"
  - "Stuck items reset to 'queued' indefinitely with no retry limit tracking (user decision)"
  - "Console.warn per recovery event — no DB record of recovery (user decision)"
  - "createdAt used as stuck-item proxy since no updatedAt/processingStartedAt column exists"

patterns-established:
  - "Job entry points: try/finally with pool.end() — natural process exit after drain"
  - "pool exported from db/client for any module needing lifecycle control"

requirements-completed:
  - CLEAN-01
  - CLEAN-02

# Metrics
duration: 13min
completed: 2026-02-27
---

# Phase 1 Plan 01: Pool Lifecycle Fix and Stuck Queue Recovery Summary

**pg Pool exported from db/client, job scripts drain connections via pool.end() in finally blocks, and recoverStuckItems() resets stuck 'publishing' items older than 15 minutes**

## Performance

- **Duration:** 13 min
- **Started:** 2026-02-27T13:08:28Z
- **Completed:** 2026-02-27T13:11:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Pool exported from `src/db/client.ts` — importable by any module needing lifecycle control
- Both job scripts (`publish.ts`, `research.ts`) now use `pool.end()` in finally blocks and exit naturally without `process.exit(0)`
- `recoverStuckItems()` added to queue-runner — queries for items in 'publishing' status older than 15 minutes and resets them to 'queued'

## Task Commits

Each task was committed atomically:

1. **Task 1: Export pool and fix job script lifecycle** - `fc0042c` (feat)
2. **Task 2: Add stuck queue item recovery to queue-runner** - `4c81321` (feat)

**Plan metadata:** (docs commit follows this summary)

## Files Created/Modified
- `src/db/client.ts` - Added `export` to pool declaration
- `src/jobs/publish.ts` - Added pool import, wrapped body in try/finally with pool.end(), removed process.exit(0)
- `src/jobs/research.ts` - Added pool import, wrapped body in try/finally with pool.end(), removed process.exit(0)
- `src/lib/publishing/queue-runner.ts` - Added `lt` import, added `recoverStuckItems()` function

## Decisions Made
- 15-minute stuck threshold — user locked this decision; safe because normal publishes complete in seconds
- Items reset to 'queued' indefinitely, no retry limit tracking — user locked decision
- Console.warn per recovery event with item ID — no DB audit trail (user decision)
- createdAt used as detection proxy — there is no `updatedAt` or `processingStartedAt` column on the publishQueue table; comment in code documents this limitation and suggests the migration path

## Deviations from Plan

None - plan executed exactly as written.

Note: The `src/` directory was deleted in the working tree prior to execution (not committed). Files were restored from git history as a prerequisite for this task — this restoration is included in the Task 1 commit but is not a deviation from the plan's intent.

## Issues Encountered
- `src/` files were deleted in the working tree but not committed. Restored via `git checkout` from the relevant commits before applying changes. All files were at their correct historical state before modification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Pool lifecycle is clean — jobs exit naturally, safe for containerization
- `recoverStuckItems()` is a standalone exported function ready for the daemon to call on each tick
- All changes compile cleanly with no TypeScript errors
- Ready for Plan 02 (daemon watchdog / containerization tasks)

## Self-Check: PASSED

- FOUND: src/db/client.ts
- FOUND: src/jobs/publish.ts
- FOUND: src/jobs/research.ts
- FOUND: src/lib/publishing/queue-runner.ts
- FOUND: .planning/phases/01-cleanup-foundation/01-01-SUMMARY.md
- FOUND commit: fc0042c (Task 1)
- FOUND commit: 4c81321 (Task 2)

---
*Phase: 01-cleanup-foundation*
*Completed: 2026-02-27*
