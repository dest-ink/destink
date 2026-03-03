---
phase: 13-draft-generation
plan: 01
subsystem: api
tags: [drizzle, postgres, generation, draft, batch, vitest]

# Dependency graph
requires:
  - phase: 12-config-cleanup
    provides: shortFormPercent and maxDraftsPerRun top-level columns on researchers table; ResearcherForm Draft Settings section
provides:
  - autoDraft boolean column on researchers table with Drizzle migration applied
  - generateDraftsForRun() batch engine in src/lib/generation/batch.ts
  - assignContentTypes() pure function with deterministic ratio logic
  - DraftBatchResult interface
  - 5 draft progress event types in ResearchProgressEvent union (draft-start, draft-complete, draft-error, draft-skipped, drafts-done)
affects: [13-draft-generation plan-02, auto-draft scheduling, research SSE stream]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batch draft generation: assignContentTypes() pure function + generateDraftsForRun() for DB orchestration"
    - "TDD: RED test commit then GREEN implementation commit for pure logic"
    - "Partial failure tolerance: continue loop on individual draft failure, accumulate failedCount"
    - "Intra-batch dedup: add generated titles to existingTitles Set after each success"

key-files:
  created:
    - src/lib/generation/batch.ts
    - src/db/migrations/0005_tranquil_omega_sentinel.sql
    - tests/lib/generation/batch.test.ts
  modified:
    - src/db/schema.ts
    - src/lib/research/progress.ts

key-decisions:
  - "assignContentTypes uses Math.round for ratio calculation — ties favor short-form (50% of 3 = round(1.5) = 2 notes)"
  - "Topics sorted by relevanceScore descending before type assignment — highest relevance topics get note type in the batch"
  - "generateDraftsForRun loads last 10 draft titles for dedup seed and voice context (recentTitles for prompt)"
  - "status: 'pending_review' set explicitly in insert values (not relying on DB default) per DRAFT-06"
  - "draftsGenerated updated on researchRuns only when at least one draft was generated"

patterns-established:
  - "assignContentTypes(): pure function, no I/O — takes TopicRecommendation[], count, shortFormPercent; returns ContentTypeAssignment[]"
  - "generateDraftsForRun(): async, DB-touching orchestration; pure logic tested separately in batch.test.ts"

requirements-completed: [DRAFT-02, DRAFT-03, DRAFT-04, DRAFT-05, DRAFT-06]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 13 Plan 01: Draft Generation Engine Summary

**Batch draft engine (generateDraftsForRun + assignContentTypes) with autoDraft schema column, Drizzle migration, and 5 draft progress event types extending the research SSE stream**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T12:17:17Z
- **Completed:** 2026-03-03T12:19:33Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- Added `autoDraft` boolean column to researchers table; migration 0005 generated and applied
- Extended `ResearchProgressEvent` union with 5 draft event types for SSE streaming continuity
- Implemented `assignContentTypes()` pure function with deterministic Math.round ratio, short-form tie-breaking, and relevanceScore-descending sort
- Implemented `generateDraftsForRun()` with channel persona load, title-based dedup (seeded from DB + intra-batch), partial failure tolerance, and progress event emission
- 8 unit tests for `assignContentTypes()` covering all ratio scenarios, tie-breaking, sort order, and count boundaries — all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + progress event types** - `7586583` (feat)
2. **Task 2 RED: Failing tests for assignContentTypes** - `9d241a7` (test)
3. **Task 2 GREEN: Batch draft generation engine** - `e0183b1` (feat)

_Note: TDD task 2 has two commits (test RED then feat GREEN)_

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/db/schema.ts` - Added `autoDraft: boolean('auto_draft').default(false).notNull()` and `boolean` import
- `src/lib/research/progress.ts` - Extended `ResearchProgressEvent` with draft-start, draft-complete, draft-error, draft-skipped, drafts-done
- `src/db/migrations/0005_tranquil_omega_sentinel.sql` - Adds `auto_draft` boolean column to researchers table
- `src/lib/generation/batch.ts` - New: `assignContentTypes()`, `generateDraftsForRun()`, `DraftBatchResult` interface
- `tests/lib/generation/batch.test.ts` - New: 8 unit tests for `assignContentTypes()` pure function

## Decisions Made
- `Math.round` for ratio calculation ensures short-form tie-breaking (50% of 3 = 2 notes, not 1)
- Highest-relevance topics sorted first, then assigned to note slots — ensures best topics are short-form notes
- `generateDraftsForRun()` loads last 10 draft titles from DB both for dedup and for `recentTitles` context in the generation prompt (voice consistency)
- `status: 'pending_review'` set explicitly per DRAFT-06 spec

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `generateDraftsForRun()` is ready to be called from the research run API route after `run-complete` when `autoDraft` is true
- `assignContentTypes()` is fully tested and ready for integration
- Plan 02 can wire the batch engine into the research SSE endpoint and add the manual Generate Drafts button to the research run detail UI

---
*Phase: 13-draft-generation*
*Completed: 2026-03-03*
