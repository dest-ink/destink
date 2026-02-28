---
phase: 03-authentication-ui-polish
plan: 02
subsystem: ui
tags: [next-themes, sonner, skeleton, dark-mode, toast, error-handling]

# Dependency graph
requires:
  - phase: 03-authentication-ui-polish/03-01
    provides: Auth.js v5 Credentials auth — all API routes protected with auth() wrapper
provides:
  - Light/dark mode theming via next-themes with warm orange accent in both modes
  - Sonner toast system (bottom-right) for transient error notifications
  - Skeleton loading pages for all four app routes (channels, drafts, queue, audit)
  - src/lib/errors.ts apiError() utility mapping exceptions to actionable messages
  - All API routes use operation-specific error messages — zero generic 500s
  - Client components (DraftActions, QueueItem, CreateChannelForm, VoiceWizard) fire toast.error()
affects: [04-deployment-observability, ui-polish, client-components]

# Tech tracking
tech-stack:
  added: [next-themes, sonner]
  patterns: [ThemeProvider wrapping root layout, suppressHydrationWarning on html, mounted guard for theme toggle, apiError() utility for operation-specific error messages]

key-files:
  created:
    - src/components/providers.tsx
    - src/components/ui/sonner.tsx
    - src/components/ui/skeleton.tsx
    - src/lib/errors.ts
    - src/app/(app)/channels/loading.tsx
    - src/app/(app)/drafts/loading.tsx
    - src/app/(app)/queue/loading.tsx
    - src/app/(app)/audit/loading.tsx
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
    - src/components/layout/SideNav.tsx
    - src/app/api/channels/route.ts
    - src/app/api/channels/[id]/route.ts
    - src/app/api/drafts/route.ts
    - src/app/api/drafts/[id]/approve/route.ts
    - src/app/api/drafts/[id]/reject/route.ts
    - src/app/api/queue/route.ts
    - src/app/api/queue/[id]/route.ts
    - src/app/api/queue/[id]/publish-now/route.ts
    - src/app/api/queue/[id]/retry/route.ts
    - src/app/api/voice/route.ts
    - src/components/drafts/DraftActions.tsx
    - src/components/queue/QueueItem.tsx
    - src/components/channels/CreateChannelForm.tsx
    - src/components/channels/VoiceWizard.tsx

key-decisions:
  - "ThemeProvider uses attribute='class' with defaultTheme='system' — next-themes applies .dark/.light class to <html>"
  - "suppressHydrationWarning on <html> prevents next-themes class mismatch between SSR and client"
  - "Mounted guard in SideNav theme toggle prevents rendering wrong icon on initial SSR hydration"
  - "apiError() returns both message and HTTP status code — callers use the status directly"
  - "Toast fires in parallel with inline error display — user sees feedback even if scrolled away"

patterns-established:
  - "ThemeProvider + Toaster: always in src/components/providers.tsx, never in individual layouts"
  - "apiError(operation, err): always import from @/lib/errors in API route catch blocks"
  - "toast.error(msg) + setError(msg): dual error display pattern in client components"
  - "loading.tsx: Next.js App Router convention for per-route skeleton fallbacks"

requirements-completed: [UI-01, UI-03, UI-04]

# Metrics
duration: 4min
completed: 2026-02-28
---

# Phase 3 Plan 02: UI Design System Summary

**Dark/light mode toggle via next-themes, sonner toast system (bottom-right), skeleton loading for all four app pages, and operation-specific actionable error messages replacing all generic 500s**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-28T18:46:58Z
- **Completed:** 2026-02-28T18:51:29Z
- **Tasks:** 3
- **Files modified:** 17 (8 created, 9 modified)

## Accomplishments

- Dark/light mode theming with warm orange accent preserved — `ThemeProvider` wraps root layout, `.dark`/`.light` CSS variable blocks in globals.css, `suppressHydrationWarning` on `<html>`
- Theme toggle button (sun/moon icons) in SideNav footer alongside logout, with mounted guard preventing hydration mismatch
- Sonner toast system configured bottom-right — all 4 client components now fire `toast.error()` with actionable messages
- Skeleton loading pages for channels, drafts, queue, and audit using Next.js App Router `loading.tsx` convention
- `src/lib/errors.ts` `apiError()` utility maps exception types to user-readable context — zero generic "Internal server error" responses remain in 11 API routes

## Task Commits

Each task was committed atomically:

1. **Task 1: Install theming + toast dependencies and configure design system** - `29b4212` (feat)
2. **Task 2: Dark/light toggle in SideNav and skeleton loading pages** - `65efbea` (feat)
3. **Task 3: Upgrade API errors to actionable messages and wire toast** - `f3006f9` (feat)

## Files Created/Modified

- `src/components/providers.tsx` - ThemeProvider + Toaster wrapper for root layout
- `src/components/ui/sonner.tsx` - Sonner Toaster component (shadcn)
- `src/components/ui/skeleton.tsx` - Skeleton loading component (shadcn)
- `src/lib/errors.ts` - apiError() utility mapping exceptions to actionable messages with HTTP status
- `src/app/globals.css` - Light mode CSS variables in :root, dark mode in .dark class
- `src/app/layout.tsx` - Wrapped with Providers, suppressHydrationWarning on html element
- `src/components/layout/SideNav.tsx` - Theme toggle button (Sun/Moon) in footer with mounted guard
- `src/app/(app)/channels/loading.tsx` - Skeleton page: header + 4 card grid
- `src/app/(app)/drafts/loading.tsx` - Skeleton page: two-panel layout (list + detail)
- `src/app/(app)/queue/loading.tsx` - Skeleton page: time slot + card row pattern
- `src/app/(app)/audit/loading.tsx` - Skeleton page: header + table rows
- All 11 API routes - catch blocks upgraded from generic 500 to apiError() with operation context
- `DraftActions.tsx`, `QueueItem.tsx`, `CreateChannelForm.tsx`, `VoiceWizard.tsx` - toast.error() added

## Decisions Made

- ThemeProvider uses `attribute="class"` — next-themes applies `.dark`/`.light` class to `<html>` element, matching the `@custom-variant dark (&:is(.dark *))` Tailwind v4 setup
- `suppressHydrationWarning` on `<html>` prevents React hydration mismatch from next-themes adding class on client
- Mounted guard in SideNav (`useState(false)` + `useEffect(() => setMounted(true), [])`) ensures the sun/moon icon is only rendered after client hydration
- `apiError()` returns `{ message, status }` tuple — API routes destructure both and use the HTTP status directly rather than always 500

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Design system foundation complete: theming, toast notifications, skeleton loaders, actionable errors
- Plans 03-03 and 03-04 can build on this foundation with full dark/light mode support
- All API routes now return operation-specific errors — client UX can surface meaningful messages

---
*Phase: 03-authentication-ui-polish*
*Completed: 2026-02-28*

## Self-Check: PASSED

All key files present: providers.tsx, errors.ts, loading.tsx x4, SUMMARY.md.
All task commits verified: 29b4212, 65efbea, f3006f9.
