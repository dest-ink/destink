---
phase: 13-draft-generation
plan: 03
subsystem: ui
tags: [react, nextjs, sse, research, drafts]

# Dependency graph
requires:
  - phase: 13-draft-generation-02
    provides: SSE generate-drafts endpoint at /api/researchers/[id]/runs/[runId]/generate-drafts
  - phase: 13-draft-generation-01
    provides: ResearchProgressEvent types including draft-start, draft-complete, draft-error, draft-skipped, drafts-done
provides:
  - GenerateDraftsButton client component with SSE progress log, badge state, and router.refresh
  - autoDraft toggle in ResearcherForm Draft Settings section
  - Drafts count badge in RunsList rows
  - Run detail page passes draftsGenerated and researcherId to RunDetail
affects: [14-automation-config, 15-automation-worker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SSE stream consumption in client component (same decoder/buffer/split pattern as ResearchRunPanel)
    - Optimistic UI state for drafts: update local state from drafts-done event, then router.refresh for server sync
    - Badge replaces button pattern after completion (drafts generated badge replaces generate button)

key-files:
  created:
    - src/components/research/GenerateDraftsButton.tsx
  modified:
    - src/components/research/RunDetail.tsx
    - src/app/(app)/research/[id]/runs/[runId]/page.tsx
    - src/components/research/ResearcherForm.tsx
    - src/components/research/RunsList.tsx
    - src/app/(app)/research/[id]/runs/page.tsx
    - src/app/(app)/research/[id]/page.tsx

key-decisions:
  - "GenerateDraftsButton handles 409 as a soft message (not an error crash) -- shows 'Drafts already generated' in log"
  - "router.refresh() called unconditionally after stream closes to ensure server state is reflected"
  - "draftsDoneIds captured during stream read, applied to local state after finally block to avoid stale closure issues"

patterns-established:
  - "SSE consumer pattern: decoder + buffer + split on double newline + data: prefix parse"
  - "Button-to-badge replacement: conditional render based on draftsGenerated state length"

requirements-completed: [DRAFT-01, DRAFT-05]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 13 Plan 03: Draft Generation UI Summary

**Generate Drafts button with SSE progress log on run detail page, Drafts Generated badge, autoDraft toggle in ResearcherForm, and draft count badges in RunsList**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T12:26:41Z
- **Completed:** 2026-03-03T12:28:45Z
- **Tasks:** 2 auto tasks complete (checkpoint:human-verify pending)
- **Files modified:** 7

## Accomplishments
- Created GenerateDraftsButton client component: POSTs to generate-drafts SSE endpoint, streams draft events with colored log lines, replaces itself with "Drafts Generated (N)" badge + "View drafts" link after completion
- Added autoDraft checkbox to ResearcherForm Draft Settings section; included in PUT payload; passed from researcher detail page
- Added draftsGenerated field to RunsList Run interface; renders "N drafts" badge on runs with generated drafts
- Updated run detail page and runs list page to select and pass draftsGenerated from DB

## Task Commits

Each task was committed atomically:

1. **Task 1: GenerateDraftsButton component + RunDetail + run detail page updates** - `d8de9f1` (feat)
2. **Task 2: ResearcherForm autoDraft toggle + RunsList drafts badge** - `94d8f5d` (feat)

## Files Created/Modified
- `src/components/research/GenerateDraftsButton.tsx` - New client component: SSE stream consumer, Generate Drafts button, Drafts Generated badge, log display
- `src/components/research/RunDetail.tsx` - Added draftsGenerated and researcherId props; embeds GenerateDraftsButton in summary card
- `src/app/(app)/research/[id]/runs/[runId]/page.tsx` - Selects draftsGenerated from DB; passes draftsGenerated and researcherId to RunDetail
- `src/components/research/ResearcherForm.tsx` - Added autoDraft boolean to props/state/payload; rendered checkbox in Draft Settings section
- `src/app/(app)/research/[id]/page.tsx` - Passes autoDraft from researcher DB row to ResearcherForm
- `src/components/research/RunsList.tsx` - Added draftsGenerated to Run interface; renders badge on rows with draft IDs
- `src/app/(app)/research/[id]/runs/page.tsx` - Selects draftsGenerated in runs query; passes to RunsList

## Decisions Made
- GenerateDraftsButton handles 409 (already generated) as a soft yellow log message rather than an error state, since it's an expected condition not a failure
- `router.refresh()` called unconditionally after stream closes (in finally block) to sync server state regardless of outcome
- Local state updated from `drafts-done` event's `draftIds` optimistically, so badge shows immediately without waiting for server round-trip

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All Phase 13 auto-tasks complete; human verification checkpoint pending
- Once verified, Phase 13 is fully complete and Phase 14 (Automation Config) is unblocked
- autoDraft field is live in DB and form; automation worker (Phase 15) can read it to trigger auto-generation

## Self-Check: PASSED

All created files exist on disk. Both task commits (d8de9f1, 94d8f5d) verified in git log.

---
*Phase: 13-draft-generation*
*Completed: 2026-03-03*
