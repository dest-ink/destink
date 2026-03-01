---
phase: quick-001
plan: 01
subsystem: ui
tags: [next.js, server-components, drizzle, sse, research]

requires:
  - phase: 10-research-page-ui
    provides: Research page, ResearchRunPanel, ResearcherForm, researcher detail page
provides:
  - /research/[id]/runs page with runs list and run trigger
  - /research/[id]/runs/[runId] page with full run detail (topics + sources)
  - GET /api/researchers/[id]/runs endpoint
  - RunsList and RunDetail reusable components
affects: [research, researchers]

tech-stack:
  added: []
  patterns: [run-detail-view, source-grouping-by-type, topic-relevance-score-badges]

key-files:
  created:
    - src/app/(app)/research/[id]/runs/page.tsx
    - src/app/(app)/research/[id]/runs/loading.tsx
    - src/app/(app)/research/[id]/runs/[runId]/page.tsx
    - src/app/(app)/research/[id]/runs/[runId]/loading.tsx
    - src/app/api/researchers/[id]/runs/route.ts
    - src/components/research/RunsList.tsx
    - src/components/research/RunDetail.tsx
  modified:
    - src/app/(app)/research/[id]/page.tsx

key-decisions:
  - "Separated config and runs into distinct routes rather than tabs for cleaner URL structure"
  - "RunDetail is a server component (pure display) while RunsList is client (for future refresh capability)"

patterns-established:
  - "Source grouping by type with color-coded badges per adapter (exa, reddit, substack, brainstorm)"
  - "Topic cards with relevance score color coding (green >70, yellow 40-70, red <40)"

requirements-completed: [QUICK-001]

duration: 2min
completed: 2026-03-01
---

# Quick Task 001: Research Runs Page Summary

**Split researcher detail into config-only page and new runs routes with run history list, live SSE trigger, and individual run detail showing topics with relevance scores and sources grouped by type**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-01T18:22:16Z
- **Completed:** 2026-03-01T18:24:48Z
- **Tasks:** 2 (+ 1 checkpoint)
- **Files modified:** 8

## Accomplishments
- Researcher detail page (/research/[id]) now shows only the config form with a "View Runs" button
- New /research/[id]/runs page displays the ResearchRunPanel for triggering runs and a chronological list of past runs with channel badges, source/topic counts
- New /research/[id]/runs/[runId] page shows full run detail: summary card, topics sorted by relevance with score badges and linked sources, and all sources grouped by type (exa, reddit, substack, brainstorm)
- GET /api/researchers/[id]/runs API endpoint returns runs with channel info and computed counts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Runs list page and API, refactor detail page** - `2eee68a` (feat)
2. **Task 2: Create individual Run detail page with sources and topics** - `f978c2d` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `src/app/api/researchers/[id]/runs/route.ts` - GET endpoint returning runs with channel name, platform, topic/source counts
- `src/components/research/RunsList.tsx` - Client component rendering linked run rows with date, channel badge, counts
- `src/components/research/RunDetail.tsx` - Server component displaying run summary, topic cards with relevance scores, sources grouped by type
- `src/app/(app)/research/[id]/runs/page.tsx` - Runs page with ResearchRunPanel + RunsList
- `src/app/(app)/research/[id]/runs/loading.tsx` - Loading skeleton for runs page
- `src/app/(app)/research/[id]/runs/[runId]/page.tsx` - Individual run detail page
- `src/app/(app)/research/[id]/runs/[runId]/loading.tsx` - Loading skeleton for run detail
- `src/app/(app)/research/[id]/page.tsx` - Refactored to config-only with "View Runs" link

## Decisions Made
- Separated config and runs into distinct routes (/research/[id] vs /research/[id]/runs) rather than tabs, for cleaner URL structure and independent loading
- RunDetail is a server component (pure display, no interactivity needed) while RunsList is a client component (for potential future auto-refresh after run completion)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Steps
- Verify navigation flow visually: research list -> researcher config -> runs -> run detail
- Consider adding auto-refresh to RunsList after a run completes in ResearchRunPanel

## Self-Check: PASSED

All 8 files verified on disk. Both task commits (2eee68a, f978c2d) verified in git log.

---
*Quick Task: 001-research-runs-page*
*Completed: 2026-03-01*
