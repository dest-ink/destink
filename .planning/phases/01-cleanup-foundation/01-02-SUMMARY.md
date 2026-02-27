---
phase: 01-cleanup-foundation
plan: "02"
subsystem: infra
tags: [daemon, kubernetes, sigterm, cron, drizzle, postgresql, jobs]

# Dependency graph
requires:
  - phase: 01-cleanup-foundation/01-01
    provides: pool export from @/db/client, recoverStuckItems() from queue-runner
provides:
  - SIGTERM-aware daemon with 25s graceful shutdown and stuck item recovery on every tick
  - daily-summary job with 4 count queries (research, drafts, published, failed) over 24h window
  - npm script job:daily-summary for operator visibility
affects: [deployment, kubernetes, monitoring, operations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Daemon graceful shutdown: isShuttingDown flag + task.stop() + 25s poll loop + pool.end()"
    - "Stuck item recovery called every tick before queue processing"
    - "Job scripts: async main() + pool.end() in finally + process.exit(1) on catch"

key-files:
  created:
    - src/jobs/daily-summary.ts
  modified:
    - src/daemon/index.ts
    - package.json

key-decisions:
  - "25s shutdown timeout — leaves 5s buffer before Kubernetes SIGKILL at 30s"
  - "SIGINT added alongside SIGTERM for local dev convenience"
  - "Failed items query uses createdAt (not updatedAt — column does not exist) as proxy for 24h window"
  - "Concurrency policy documented in module docstring: single K8s Deployment, CronJob uses concurrencyPolicy: Forbid"

patterns-established:
  - "Daemon pattern: isProcessing + isShuttingDown flags, task.stop() on shutdown"
  - "Job pattern: main() + try/finally pool.end() + catch process.exit(1)"

requirements-completed: [CLEAN-03, CLEAN-04, CLEAN-05]

# Metrics
duration: 1min
completed: 2026-02-27
---

# Phase 1 Plan 02: Daemon SIGTERM + Daily Summary Summary

**SIGTERM-aware daemon with 25s graceful shutdown, per-tick stuck item recovery, and a daily operator summary job logging research/draft/published/failed counts over 24h**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-27T13:14:22Z
- **Completed:** 2026-02-27T13:15:31Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Daemon now handles SIGTERM/SIGINT with 25s wait for in-flight publishes before pool.end()
- recoverStuckItems() runs at the start of every tick ensuring no queue items stay permanently frozen
- Concurrency policy (single K8s Deployment / CronJob: Forbid) documented in module JSDoc
- New daily-summary.ts job queries 4 aggregate counts over a 24h window and logs with [job:daily-summary] prefix
- npm script `job:daily-summary` added to package.json for operator use

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor daemon with SIGTERM handler and stuck recovery** - `e995a93` (feat)
2. **Task 2: Create daily summary job and npm script** - `61b067c` (feat)

**Plan metadata:** (docs commit — see final commit below)

## Files Created/Modified

- `src/daemon/index.ts` - Rewritten with SIGTERM/SIGINT handlers, isShuttingDown flag, recoverStuckItems() in tick, 25s shutdown poll loop, pool.end() on exit
- `src/jobs/daily-summary.ts` - New job: 4 Drizzle count queries over 24h, [job:daily-summary] log prefix, pool.end() in finally
- `package.json` - Added "job:daily-summary": "tsx src/jobs/daily-summary.ts" script

## Decisions Made

- 25s shutdown timeout leaves 5s buffer before Kubernetes SIGKILL (30s termination grace period)
- SIGINT added alongside SIGTERM so local Ctrl+C also triggers graceful shutdown
- Failed items daily count uses createdAt as the time proxy since publishQueue has no updatedAt column — acceptable for a summary job
- Concurrency policy documented in daemon module docstring satisfying CLEAN-04

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Daemon and job infrastructure is complete for the cleanup phase
- Plan 03 (remaining cleanup items) can proceed
- All TypeScript compiles cleanly

---
*Phase: 01-cleanup-foundation*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: src/daemon/index.ts
- FOUND: src/jobs/daily-summary.ts
- FOUND: .planning/phases/01-cleanup-foundation/01-02-SUMMARY.md
- FOUND commit: e995a93 (Task 1)
- FOUND commit: 61b067c (Task 2)
- FOUND commit: 1ac0eba (docs metadata)
