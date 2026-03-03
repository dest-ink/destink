---
phase: 12-config-cleanup
plan: 01
subsystem: database
tags: [drizzle, postgres, schema-migration, api-routes, research-engine]

# Dependency graph
requires:
  - phase: 11-channel-cleanup
    provides: researcher entity and researcher form components this plan modifies
provides:
  - researchers table with maxDraftsPerRun (integer, default 3) and shortFormPercent (integer, default 70) columns
  - ResearchSourceConfig with exactly 4 source fields (subreddits, substackFeeds, searchQueryTemplates, excludedDomains)
  - ResearchConfig with legacy contentTypeMix/maxDraftsPerRun/scheduleHours as optional (backward compat)
  - SQL migration 0004 with ALTER TABLE DDL plus back-fill and JSON key stripping
  - POST /api/researchers accepting maxDraftsPerRun and shortFormPercent as top-level fields
  - PUT /api/researchers/[id] updating both new fields when present
  - buildResearchConfig reading from researcher.maxDraftsPerRun and researcher.shortFormPercent
affects: [13-draft-generation, 14-automation-config, 15-automation-worker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Top-level integer columns for scalar config values instead of embedding in JSON blob"
    - "Back-fill and JSON key stripping in the same DDL migration (no separate TS script)"

key-files:
  created:
    - src/db/migrations/0004_early_dreaming_celestial.sql
  modified:
    - src/db/schema.ts
    - src/lib/research/engine.ts
    - src/app/api/researchers/route.ts
    - src/app/api/researchers/[id]/route.ts
    - src/components/research/ResearcherForm.tsx
    - src/db/migrate-research-configs.ts
    - src/app/(app)/research/[id]/page.tsx
    - tests/lib/research/exa.test.ts
    - tests/lib/research/orchestrator.test.ts
    - tests/lib/research/reddit.test.ts
    - tests/lib/research/substack-monitor.test.ts

key-decisions:
  - "maxDraftsPerRun and shortFormPercent promoted to top-level integer columns; sourceConfig JSON now contains only 4 source fields"
  - "contentTypeMix replaced by shortFormPercent (0-100 integer, default 70) — simpler, enables SQL queries"
  - "scheduleHours removed entirely (no migration needed since Phase 14 automation config replaces it)"
  - "ResearchConfig legacy fields made optional for backward compat with channels.researchConfig stored JSON"
  - "Back-fill uses SQL COALESCE to safely handle existing rows with or without old JSON fields"

patterns-established:
  - "Scalar config promotion: add column, back-fill from JSON, strip old JSON keys in one migration"

requirements-completed: [CFG-01, CFG-02, CFG-03]

# Metrics
duration: 30min
completed: 2026-03-03
---

# Phase 12 Plan 01: Config Cleanup Summary

**Promoted maxDraftsPerRun and shortFormPercent to top-level researcher columns via SQL migration with back-fill and JSON key stripping, cleaned ResearchSourceConfig to 4 source fields, and deleted dead ResearchConfigForm.tsx**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-03T02:00:00Z
- **Completed:** 2026-03-03T02:29:13Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Added `max_drafts_per_run` (integer, default 3) and `short_form_percent` (integer, default 70) columns to the `researchers` table
- Generated and applied migration 0004 with DDL, back-fill from sourceConfig JSON, and stripping of migrated JSON keys
- Cleaned `ResearchSourceConfig` from 7 fields to 4 source-only fields
- Updated `buildResearchConfig` to read from researcher's top-level columns instead of sourceConfig JSON
- Updated POST and PUT API routes to accept/update the new top-level fields
- Removed dead code `ResearchConfigForm.tsx` (unused since Phase 11)
- Cleaned all 4 test fixtures of removed optional fields; all targeted tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Update schema, generate migration with back-fill, clean types** - `f934a43` (feat)
2. **Task 2: Update API routes, research engine, and test fixtures** - `9d35b40` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/db/schema.ts` - Added 2 columns to researchers table; cleaned ResearchSourceConfig (4 fields); made ResearchConfig legacy fields optional
- `src/db/migrations/0004_early_dreaming_celestial.sql` - DDL + back-fill UPDATE + JSON key stripping UPDATE
- `src/lib/research/engine.ts` - buildResearchConfig signature updated; reads from top-level columns; removed as-cast
- `src/app/api/researchers/route.ts` - POST inserts maxDraftsPerRun and shortFormPercent with defaults
- `src/app/api/researchers/[id]/route.ts` - PUT updates both new fields when present in body
- `src/components/research/ResearcherForm.tsx` - Removed old sourceConfig fields; added top-level state for new columns; updated payload
- `src/app/(app)/research/[id]/page.tsx` - Passes maxDraftsPerRun and shortFormPercent to ResearcherForm
- `src/db/migrate-research-configs.ts` - Removed old fields from sourceConfig construction (historic migration script)
- `src/components/channels/ResearchConfigForm.tsx` - DELETED (dead code since Phase 11)
- `tests/lib/research/exa.test.ts` - Removed contentTypeMix, maxDraftsPerRun, scheduleHours from baseConfig
- `tests/lib/research/orchestrator.test.ts` - Same cleanup
- `tests/lib/research/reddit.test.ts` - Same cleanup
- `tests/lib/research/substack-monitor.test.ts` - Same cleanup

## Decisions Made
- Used `shortFormPercent` (integer 0-100) instead of keeping the `contentTypeMix` object — simpler, SQL-queryable, matches Phase 14 override pattern
- Made `ResearchConfig` legacy fields (`contentTypeMix`, `maxDraftsPerRun`, `scheduleHours`) optional rather than removing them — `channels.researchConfig` stored JSON still contains these fields and `runResearchForChannel` spreads it without field validation
- Stripped migrated keys from sourceConfig JSON immediately in the same migration (no transition period)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ResearcherForm.tsx TypeScript errors caused by schema change**
- **Found during:** Task 1 (TypeScript compile check after schema update)
- **Issue:** ResearcherForm.tsx used contentTypeMix, maxDraftsPerRun, scheduleHours on ResearchSourceConfig which were removed
- **Fix:** Removed old fields from DEFAULT_SOURCE_CONFIG; added maxDraftsPerRun and shortFormPercent as separate top-level state; updated prop type and payload
- **Files modified:** src/components/research/ResearcherForm.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** f934a43 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed migrate-research-configs.ts TypeScript error**
- **Found during:** Task 1 (TypeScript compile check after schema update)
- **Issue:** Historical migration script still assigned contentTypeMix/maxDraftsPerRun/scheduleHours to ResearchSourceConfig
- **Fix:** Removed 3 old fields from the sourceConfig construction in the migration script
- **Files modified:** src/db/migrate-research-configs.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** f934a43 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed research/[id]/page.tsx TypeScript error**
- **Found during:** Task 1 (TypeScript compile check after ResearcherForm.tsx update)
- **Issue:** Page passed researcher object to ResearcherForm without new required maxDraftsPerRun/shortFormPercent props
- **Fix:** Added maxDraftsPerRun and shortFormPercent to the researcher object passed to ResearcherForm
- **Files modified:** src/app/(app)/research/[id]/page.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** f934a43 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - TypeScript errors directly caused by schema interface changes)
**Impact on plan:** All auto-fixes necessary for TypeScript correctness. No scope creep — all affected files were directly caused by the ResearchSourceConfig cleanup.

## Issues Encountered
- `tests/db/schema.test.ts` has 9 pre-existing failures due to missing DB credentials in the test environment (SASL auth error). These are unrelated to this plan's changes and existed before and after our work.

## User Setup Required
None - no external service configuration required. Database migration applied automatically via `pnpm db:migrate`.

## Next Phase Readiness
- Schema is clean: researchers table has maxDraftsPerRun and shortFormPercent as typed columns
- ResearchSourceConfig is source-only (subreddits, feeds, queries, exclusions)
- Phase 13 draft generation engine can read researcher.maxDraftsPerRun directly via SQL
- Phase 14 automation config can override researcher.maxDraftsPerRun per schedule (AUTO-03)
- No blockers

## Self-Check: PASSED

- FOUND: src/db/migrations/0004_early_dreaming_celestial.sql
- FOUND: src/components/channels/ResearchConfigForm.tsx DELETED
- FOUND: .planning/phases/12-config-cleanup/12-01-SUMMARY.md
- FOUND commit: f934a43
- FOUND commit: 9d35b40

---
*Phase: 12-config-cleanup*
*Completed: 2026-03-03*
