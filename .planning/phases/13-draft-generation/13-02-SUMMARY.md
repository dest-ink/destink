---
phase: 13-draft-generation
plan: 02
subsystem: api
tags: [research, draft-generation, sse, next-api-routes]

# Dependency graph
requires:
  - phase: 13-01
    provides: generateDraftsForRun, DraftBatchResult, draft progress event types in ResearchProgressEvent
provides:
  - Auto-draft hook in runResearchForResearcher (engine.ts) triggering generateDraftsForRun after run-complete when autoDraft=true
  - POST /api/researchers/[id]/runs/[runId]/generate-drafts SSE endpoint with 409 re-generation guard
  - autoDraft field accepted by PUT /api/researchers/[id] handler
  - ResearchRunPanel handling all 5 draft progress event types with appropriate colors
affects: [13-03, research-run-ui, researcher-form]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SSE endpoint pattern extended to draft generation (same ReadableStream + TextEncoder pattern as run/route.ts)
    - Auto-draft failures caught silently (do not affect research run status -- run already persisted)
    - 409 guard checks draftsGenerated JSONB column for non-empty array before allowing re-generation

key-files:
  created:
    - src/app/api/researchers/[id]/runs/[runId]/generate-drafts/route.ts
  modified:
    - src/lib/research/engine.ts
    - src/app/api/researchers/[id]/route.ts
    - src/components/research/ResearchRunPanel.tsx

key-decisions:
  - "generateDraftsForRun emits drafts-done internally -- engine.ts auto-draft hook does not re-emit it to avoid duplicates"
  - "Manual trigger endpoint returns 409 JSON (not SSE) if run.draftsGenerated is non-empty array"

patterns-established:
  - "SSE manual trigger pattern: ReadableStream wrapping async fn, .catch sends run-error event then closes"
  - "Auto-draft failures in engine.ts emit run-error but do not throw (run already saved)"

requirements-completed: [DRAFT-01, DRAFT-02]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 13 Plan 02: Pipeline Wiring Summary

**Auto-draft hook, manual trigger SSE endpoint, and ResearchRunPanel draft event handling wired into the research pipeline using the batch engine from Plan 01**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T12:22:20Z
- **Completed:** 2026-03-03T12:24:03Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Auto-draft hook in engine.ts calls generateDraftsForRun after run-complete when researcher.autoDraft=true, inside the per-channel loop
- POST /api/researchers/[id]/runs/[runId]/generate-drafts endpoint returns SSE stream, guards re-generation with 409
- PUT /api/researchers/[id] accepts and persists autoDraft boolean field
- ResearchRunPanel handles all 5 draft event types (draft-start, draft-complete, draft-error, draft-skipped, drafts-done) with correct colors

## Task Commits

Each task was committed atomically:

1. **Task 1: Auto-draft hook in engine + manual trigger API endpoint + PUT handler** - `8c6325a` (feat)
2. **Task 2: ResearchRunPanel draft event handling** - `079b9e2` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/research/engine.ts` - Added generateDraftsForRun import and auto-draft hook after run-complete emission inside per-channel loop
- `src/app/api/researchers/[id]/runs/[runId]/generate-drafts/route.ts` - New POST SSE endpoint with researcher+run loading, 409 guard, and SSE stream
- `src/app/api/researchers/[id]/route.ts` - Added autoDraft field to PUT handler
- `src/components/research/ResearchRunPanel.tsx` - Added 5 draft event cases to handleEvent() switch, extended LogLine color union with text-yellow-500

## Decisions Made
- `generateDraftsForRun` already emits `drafts-done` at the end of batch.ts -- engine.ts auto-draft hook does not re-emit it to avoid sending the event twice over the SSE stream
- Manual trigger endpoint returns 409 JSON response (not SSE) for the re-generation guard case, since the stream hasn't been opened yet at that point

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Draft pipeline fully wired: research run -> auto-draft (if enabled) -> SSE events displayed in ResearchRunPanel
- Manual trigger endpoint ready for use from UI (Plan 03 will add the trigger button to researcher detail page)
- autoDraft field accepted by API, ready for ResearcherForm toggle (Plan 03)

---
*Phase: 13-draft-generation*
*Completed: 2026-03-03*
