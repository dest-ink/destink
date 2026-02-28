---
phase: 03-authentication-ui-polish
plan: "04"
subsystem: ui
tags: [nextjs, drizzle-orm, tailwind, shadcn, empty-states, cost-tracking]

# Dependency graph
requires:
  - phase: 03-authentication-ui-polish/03-02
    provides: toast system, theming, error display patterns

provides:
  - Polished empty states with specific CTAs on channels, drafts, and queue pages
  - Channel detail page at /channels/[id] with per-channel AI cost summary
  - ChannelCostSummary component displaying totalCostUsd, tokens, and operation count
  - Extended GET /api/channels/[id] returning cost aggregation from aiAuditLog

affects:
  - 04-deployment-observability
  - any phase that references channel detail or cost tracking

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component direct DB query pattern for detail pages (no self-fetch anti-pattern)"
    - "coalesce(sum(...), 0) SQL pattern for cost aggregation with safe zero fallback"
    - "Consistent empty state layout: text-lg heading + muted-foreground subtext + primary Button CTA"

key-files:
  created:
    - src/app/(app)/channels/[id]/page.tsx
    - src/components/channels/ChannelCostSummary.tsx
  modified:
    - src/app/(app)/channels/page.tsx
    - src/app/(app)/drafts/page.tsx
    - src/components/queue/QueueTimeline.tsx
    - src/app/api/channels/[id]/route.ts

key-decisions:
  - "Direct Drizzle DB query in channel detail Server Component — avoids self-fetch anti-pattern vs using the API route"
  - "QueueItem retry affordances already fully satisfied (red badge + inline Retry + error box) — UI-05 confirmed, no code changes needed"

patterns-established:
  - "Empty state pattern: text-lg font-semibold heading + text-sm text-muted-foreground subtext + primary Button with Link asChild"
  - "Cost aggregation: coalesce(sum(costUsd), '0') returns string from numeric column, parsed with parseFloat()"

requirements-completed: [UI-02, UI-05, UI-09]

# Metrics
duration: 10min
completed: "2026-02-28"
---

# Phase 3 Plan 4: UI Polish — Empty States and Per-Channel Cost Summary

**Empty states with specific CTAs on all list views plus per-channel AI spend display using Drizzle aggregation on aiAuditLog**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-02-28T18:54:13Z
- **Completed:** 2026-02-28T19:04:00Z
- **Tasks:** 2
- **Files modified:** 6 (3 modified, 3 created)

## Accomplishments

- All three list views (channels, drafts, queue) now show polished empty states with specific primary CTA buttons pointing to correct next steps
- Created `/channels/[id]` Server Component detail page with channel name, platform badge, and AI cost summary
- Extended `GET /api/channels/[id]` to aggregate total AI spend per channel from `aiAuditLog` table
- Created `ChannelCostSummary` component showing total cost, token count, and operation count; gracefully handles zero-usage channels
- Confirmed `QueueItem` already satisfies UI-05: red Failed badge, inline Retry button, error message box all present

## Task Commits

Each task was committed atomically:

1. **Task 1: Empty states with CTAs on all list views** - `f0971e9` (feat)
2. **Task 2: Per-channel cost data with channel detail page, and retry verification** - `70a508c` (feat)

**Plan metadata:** _(docs commit pending)_

## Files Created/Modified

- `src/app/(app)/channels/page.tsx` - Upgraded empty state: "No channels yet" + "Add your first channel" primary CTA
- `src/app/(app)/drafts/page.tsx` - Upgraded empty state: "No drafts yet" + "Go to channels" primary CTA with workflow context
- `src/components/queue/QueueTimeline.tsx` - Upgraded empty state: "Nothing in the queue" + "Review drafts" primary CTA
- `src/app/api/channels/[id]/route.ts` - Extended GET handler to aggregate AI cost data from aiAuditLog
- `src/components/channels/ChannelCostSummary.tsx` - New component: displays totalCostUsd, tokens, operations; "No AI usage yet" fallback
- `src/app/(app)/channels/[id]/page.tsx` - New channel detail Server Component page with cost summary

## Decisions Made

- **Direct DB query in Server Component:** The channel detail page queries Drizzle directly rather than calling the `/api/channels/[id]` endpoint. This avoids the self-fetch anti-pattern in Next.js Server Components and is simpler.
- **UI-05 already satisfied:** After reading `QueueItem.tsx`, all three retry affordances were confirmed present (red badge, inline Retry button, error message). No code changes needed.
- **coalesce pattern for numeric aggregation:** `coalesce(sum(costUsd), '0')` returns a string from Postgres numeric columns; `parseFloat()` converts it for JSON serialization.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All UI polish requirements (UI-02, UI-05, UI-09) are now satisfied
- Phase 3 has 4 plans total; plans 01, 02, and 04 are complete — plan 03 remains
- Channel detail page provides a foundation for future settings/editing features

## Self-Check: PASSED

All 6 files confirmed on disk. Both task commits (f0971e9, 70a508c) confirmed in git log.

---
*Phase: 03-authentication-ui-polish*
*Completed: 2026-02-28*
