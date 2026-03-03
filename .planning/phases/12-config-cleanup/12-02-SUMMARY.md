---
phase: 12-config-cleanup
plan: "02"
subsystem: ui
tags: [react, shadcn, radix-ui, form, slider]

# Dependency graph
requires:
  - phase: 12-01
    provides: maxDraftsPerRun and shortFormPercent promoted to top-level integer columns; sourceConfig JSON contains only 4 source fields
provides:
  - Slider UI component (shadcn-style Radix wrapper) at src/components/ui/slider.tsx
  - ResearcherForm restructured into 4 visual sections with Short-form/Long-form slider
  - Schedule (hours) field removed from form UI
  - maxDraftsPerRun and shortFormPercent submitted as top-level fields in form payload
affects: [13-draft-generation, research-page-ui]

# Tech tracking
tech-stack:
  added: ["@radix-ui/react-slider"]
  patterns:
    - "shadcn-style Radix primitive wrapper pattern for UI components"
    - "Form sections separated by border-t dividers with h3 headings"

key-files:
  created:
    - src/components/ui/slider.tsx
  modified:
    - src/components/research/ResearcherForm.tsx
    - src/app/(app)/research/[id]/page.tsx
    - src/app/(app)/research/new/page.tsx
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "Slider displays percentage split as '70% / 30%' between Short-form and Long-form labels"
  - "Form divided into 4 sections: Research Identity, Sources, Draft Settings, Channels"
  - "Schedule (hours) field removed entirely — not deferred, gone"
  - "maxDraftsPerRun and shortFormPercent are top-level form state, not inside sourceConfig"

patterns-established:
  - "Slider pattern: Radix SliderPrimitive.Root with Track, Range, and Thumb sub-components styled with Tailwind"
  - "Form section pattern: <div className='space-y-4'> with <h3> heading + <div className='border-t border-border' /> divider"

requirements-completed: [CFG-01, CFG-02, CFG-03]

# Metrics
duration: 30min
completed: 2026-03-03
---

# Phase 12 Plan 02: Config Cleanup Form Restructure Summary

**ResearcherForm restructured into 4 labeled sections with a Short-form/Long-form Radix slider replacing the old Note % number input, and Schedule (hours) removed**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-03
- **Completed:** 2026-03-03
- **Tasks:** 2 (1 auto + 1 checkpoint)
- **Files modified:** 6

## Accomplishments
- Created `src/components/ui/slider.tsx` as a shadcn-style wrapper around `@radix-ui/react-slider`
- Restructured ResearcherForm into 4 visual sections (Research Identity, Sources, Draft Settings, Channels) with border-t dividers and h3 headings
- Replaced old Note % number input with Short-form / Long-form slider showing percentage split (e.g. "70% / 30%"), helper text, and step-5 increments
- Removed Schedule (hours) field entirely from the form
- Updated submit payload to send `maxDraftsPerRun` and `shortFormPercent` at top level (not inside sourceConfig)
- Updated `/research/[id]/page.tsx` to pass new top-level props to ResearcherForm
- User visually approved the form layout

## Task Commits

Each task was committed atomically:

1. **Task 1: Install slider dependency, create Slider component, restructure form** - `ea55d54` (feat)
2. **Task 2: Checkpoint — human visual verification** - approved by user (no commit; checkpoint only)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `src/components/ui/slider.tsx` - shadcn-style Radix slider wrapper component
- `src/components/research/ResearcherForm.tsx` - Restructured into 4 sections with slider replacing Note % input
- `src/app/(app)/research/[id]/page.tsx` - Passes maxDraftsPerRun and shortFormPercent to ResearcherForm
- `src/app/(app)/research/new/page.tsx` - Verified no changes needed (uses form defaults)
- `package.json` - Added @radix-ui/react-slider dependency
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Slider percentage display shows "70% / 30%" between the Short-form / Long-form labels for maximum clarity
- `step={5}` on the slider for clean increments rather than pixel-level precision
- Schedule (hours) field deleted outright — it was a legacy field with no replacement path needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Form UX and schema are now aligned: sourceConfig holds only 4 source fields, maxDraftsPerRun and shortFormPercent are top-level
- Phase 13 (Draft Generation) can read maxDraftsPerRun and shortFormPercent directly from the researchers table without JSON parsing
- No blockers or concerns

---
*Phase: 12-config-cleanup*
*Completed: 2026-03-03*
