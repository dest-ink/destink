# Phase 1: Cleanup & Foundation - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix four known code defects and add test coverage before any new code is written. The codebase must be clean, correct, and safe to containerize. Scope: process.exit fix, stuck queue recovery, graceful SIGTERM shutdown, daily summary job, queue runner tests. No new features, no UI changes.

</domain>

<decisions>
## Implementation Decisions

### Stuck item recovery
- Detection: Time-based threshold — if a queue item has been in `publishing` status for longer than 15 minutes, consider it stuck
- Recovery action: Reset status back to `pending` so it gets retried on the next daemon cycle
- No retry limit tracking — items reset to pending indefinitely (simple approach)
- Visibility: Console log a warning when items are recovered — no DB record of recovery events
- Recovery runs on each daemon cycle (check for stuck items at the start of each queue processing loop)

### Daily summary content
- Content: Counts only — research completed, drafts generated, items published, items failed
- Granularity: Just totals, not per-channel breakdown
- Time window: Last 24 hours
- Output: Console/stdout — captured by container logs in Docker environments
- Format: Simple log lines, not structured JSON (matches existing job output patterns)

### Claude's Discretion
- Graceful shutdown implementation details (signal handling, timeout duration, cleanup order)
- Test coverage depth and structure for queue runner tests
- How `process.exit(0)` replacement is implemented (pool.end() in finally blocks)
- Daily summary query optimization
- Concurrency policy documentation format (CLEAN-04)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for the technical cleanup items.

</specifics>

<deferred>
## Deferred Ideas

- Activity feed / log page — a filterable UI showing logs and activity across the system. Could pair with Phase 3 UI work or be its own phase.

</deferred>

---

*Phase: 01-cleanup-foundation*
*Context gathered: 2026-02-27*
