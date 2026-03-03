---
phase: 12-config-cleanup
verified: 2026-03-03T06:10:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
human_verification:
  - test: "Load an existing researcher in the edit form and visually inspect the slider"
    expected: "4 sections visible (Research Identity, Sources, Draft Settings, Channels), slider labeled Short-form / Long-form with a percentage split like '70% / 30%', no Schedule (hours) field visible anywhere"
    why_human: "Visual layout, slider interactivity, and absence of removed fields cannot be confirmed by grep alone"
  - test: "Move the slider and save the researcher, then reload the page"
    expected: "The new shortFormPercent value and maxDraftsPerRun value persist after reload"
    why_human: "Round-trip persistence requires a live browser + running database"
---

# Phase 12: Config Cleanup Verification Report

**Phase Goal:** Promote maxDraftsPerRun and contentTypeMix from the researchers' sourceConfig JSON blob to top-level typed columns, remove scheduleHours entirely, update all backend consumers, clean up dead code, and restructure the ResearcherForm with a Short-form/Long-form slider.
**Verified:** 2026-03-03T06:10:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `maxDraftsPerRun` is a top-level integer column on the researchers table | VERIFIED | `src/db/schema.ts` line 102: `maxDraftsPerRun: integer('max_drafts_per_run').default(3).notNull()` |
| 2 | `shortFormPercent` is a top-level integer column on the researchers table (0-100, default 70) | VERIFIED | `src/db/schema.ts` line 103: `shortFormPercent: integer('short_form_percent').default(70).notNull()` |
| 3 | `scheduleHours` does not exist in `ResearchSourceConfig` type or sourceConfig JSON | VERIFIED | `ResearchSourceConfig` has exactly 4 fields. `scheduleHours` exists only as optional in `ResearchConfig` (backward-compat for legacy channel JSON) and is stripped from sourceConfig in migration |
| 4 | Existing researcher rows have their JSON values migrated to new columns | VERIFIED | Migration `0004_early_dreaming_celestial.sql` contains DDL + `UPDATE "researchers" SET max_drafts_per_run = COALESCE(...)` back-fill + JSON key stripping UPDATE |
| 5 | API POST accepts `maxDraftsPerRun` and `shortFormPercent` as top-level fields | VERIFIED | `src/app/api/researchers/route.ts` lines 77-78: `maxDraftsPerRun: body.maxDraftsPerRun ?? 3, shortFormPercent: body.shortFormPercent ?? 70` |
| 6 | API PUT accepts `maxDraftsPerRun` and `shortFormPercent` as top-level fields | VERIFIED | `src/app/api/researchers/[id]/route.ts` lines 66-67: `if ('maxDraftsPerRun' in body) updates.maxDraftsPerRun = body.maxDraftsPerRun;` and same for `shortFormPercent` |
| 7 | `buildResearchConfig` reads from researcher top-level columns | VERIFIED | `src/lib/research/engine.ts` lines 64-88: function signature includes `maxDraftsPerRun: number; shortFormPercent: number;`, return object reads `researcher.maxDraftsPerRun` and `researcher.shortFormPercent` |
| 8 | All 4 plan-targeted test fixtures cleaned of removed optional fields | VERIFIED | `tests/lib/research/exa.test.ts`, `orchestrator.test.ts`, `reddit.test.ts`, `substack-monitor.test.ts` — none contain `contentTypeMix`, `maxDraftsPerRun`, or `scheduleHours` |
| 9 | Dead code `ResearchConfigForm.tsx` deleted | VERIFIED | `src/components/channels/ResearchConfigForm.tsx` does not exist |
| 10 | TypeScript compiles cleanly | VERIFIED | `pnpm tsc --noEmit` exits 0, zero errors |
| 11 | Slider component exists as a substantive shadcn-style Radix wrapper | VERIFIED | `src/components/ui/slider.tsx` (21 lines): uses `@radix-ui/react-slider` with Root, Track, Range, Thumb sub-components |
| 12 | ResearcherForm is split into 4 visual sections with correct labels | VERIFIED | JSX contains h3 headings "Research Identity", "Sources", "Draft Settings", "Channels" with `border-t border-border` dividers |
| 13 | Short-form/Long-form slider replaces old Note % input | VERIFIED | Lines 224-238: `<span>Short-form</span>`, `{shortFormPercent}% / {100 - shortFormPercent}%`, `<span>Long-form</span>`, `<Slider min={0} max={100} step={5} ...>`, helper text present |
| 14 | Schedule (hours) field absent from ResearcherForm | VERIFIED | `grep -n scheduleHours src/components/research/ResearcherForm.tsx` returns no results |
| 15 | Form submit payload sends `maxDraftsPerRun` and `shortFormPercent` at top level (not inside sourceConfig) | VERIFIED | Lines 93-104: payload object has `maxDraftsPerRun` and `shortFormPercent` as direct keys, `sourceConfig` only contains the 4 source fields |

**Score:** 15/15 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` | researchers table with `maxDraftsPerRun` + `shortFormPercent` columns; cleaned `ResearchSourceConfig` (4 fields) | VERIFIED | Both integer columns present; `ResearchSourceConfig` has exactly subreddits, substackFeeds, searchQueryTemplates, excludedDomains |
| `src/db/migrations/0004_early_dreaming_celestial.sql` | DDL + back-fill + JSON key stripping | VERIFIED | All 3 statements present: ALTER TABLE DDL, UPDATE back-fill with COALESCE, UPDATE JSON stripping with `-` operator |
| `src/lib/research/engine.ts` | `buildResearchConfig` reading from top-level columns | VERIFIED | Signature takes `maxDraftsPerRun: number; shortFormPercent: number;` directly; return object reads from `researcher.maxDraftsPerRun` |
| `src/app/api/researchers/route.ts` | POST accepting `maxDraftsPerRun` and `shortFormPercent` at top level | VERIFIED | Both fields in the `.values({...})` call with proper defaults |
| `src/app/api/researchers/[id]/route.ts` | PUT updating both new fields when present | VERIFIED | Two `if ('...' in body)` guards for the new fields |
| `src/components/ui/slider.tsx` | shadcn-style Radix slider wrapper, 15+ lines | VERIFIED | 21 lines, 'use client', Radix primitive, Tailwind styling |
| `src/components/research/ResearcherForm.tsx` | Sectioned form with Short-form/Long-form slider | VERIFIED | 4 sections, slider, helper text, no scheduleHours |
| `src/app/(app)/research/[id]/page.tsx` | Passes `maxDraftsPerRun` and `shortFormPercent` as props | VERIFIED | Lines 61-62 pass both fields to `<ResearcherForm>` from the DB row |
| `src/components/channels/ResearchConfigForm.tsx` | DELETED | VERIFIED | File does not exist |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/db/schema.ts` | `src/db/migrations/0004_early_dreaming_celestial.sql` | drizzle-kit DDL from schema changes | WIRED | `max_drafts_per_run integer DEFAULT 3 NOT NULL` in migration matches schema definition |
| `src/lib/research/engine.ts` | `src/db/schema.ts` | `buildResearchConfig` reads `researcher.maxDraftsPerRun` and `researcher.shortFormPercent` | WIRED | Pattern `researcher\.maxDraftsPerRun` found in engine.ts line 83; `researcher\.shortFormPercent` line 84 |
| `src/app/api/researchers/route.ts` | `src/db/schema.ts` | POST/PUT insert/update `maxDraftsPerRun` and `shortFormPercent` as top-level values | WIRED | `maxDraftsPerRun: body.maxDraftsPerRun ?? 3` in POST; both guarded updates in PUT |
| `src/components/research/ResearcherForm.tsx` | `src/components/ui/slider.tsx` | `import { Slider } from '@/components/ui/slider'` | WIRED | Import at line 10: `import { Slider } from '@/components/ui/slider'`; used at line 230 |
| `src/components/research/ResearcherForm.tsx` | `/api/researchers` | fetch payload includes `maxDraftsPerRun` and `shortFormPercent` at top level | WIRED | `payload` object (lines 93-104) contains both fields; sent via `fetch(url, { body: JSON.stringify(payload) })` |
| `src/app/(app)/research/[id]/page.tsx` | `src/components/research/ResearcherForm.tsx` | passes `maxDraftsPerRun` and `shortFormPercent` as props | WIRED | Lines 61-62: `maxDraftsPerRun: researcher.maxDraftsPerRun, shortFormPercent: researcher.shortFormPercent` in the props object |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CFG-01 | 12-01, 12-02 | maxDraftsPerRun moved from research source config to draft generation / automation settings | SATISFIED | Column promoted to top level; no longer in `ResearchSourceConfig`; API and engine updated; form sends it as top-level field |
| CFG-02 | 12-01, 12-02 | notePercent renamed to "Note vs Article %" with clear description | SATISFIED | `contentTypeMix` replaced by `shortFormPercent` (integer 0-100) in schema; form shows "Short-form" and "Long-form" labels with percentage split display and helper text explaining the purpose |
| CFG-03 | 12-01, 12-02 | scheduleHours removed from research source config (replaced by automation config) | SATISFIED | `scheduleHours` absent from `ResearchSourceConfig`; stripped from JSON blob in migration; absent from ResearcherForm UI; remains as optional in `ResearchConfig` only for backward-compat with legacy channel JSON |

All 3 requirements marked Done in REQUIREMENTS.md — confirmed accurate.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/lib/research/adapters/exa.adapter.test.ts` | 19-21 | `contentTypeMix`, `maxDraftsPerRun`, `scheduleHours` still in `mockConfig` | Info | Not a blocker — these fields are optional in `ResearchConfig` and the adapter test still passes (adapters don't read these fields). This file was NOT in the plan's `files_modified` list. |
| `tests/lib/research/adapters/reddit.adapter.test.ts` | 19-21 | Same as above | Info | Same reason — not a blocker |
| `tests/lib/research/adapters/substack-monitor.adapter.test.ts` | 19-21 | Same as above | Info | Same reason — not a blocker |
| `tests/lib/research/adapters/brainstorm.adapter.test.ts` | 29-31 | Same as above | Info | Same reason — not a blocker |

**Note:** The 4 files above are in `tests/lib/research/adapters/` — a different directory from the 4 files the plan targeted (`tests/lib/research/exa.test.ts`, `orchestrator.test.ts`, `reddit.test.ts`, `substack-monitor.test.ts`). The plan's 4 target files are clean. The adapter test files contain stale optional fields that compile and run without error because `ResearchConfig` declares those fields as `?`. No TypeScript errors, no test failures from these files.

**Pre-existing DB test failures (not caused by Phase 12):** `tests/db/schema.test.ts` (9 tests) and `tests/api/channels.test.ts` (4 tests) fail with `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` — missing DB credentials in test environment. Confirmed pre-existing per Plan 01 SUMMARY.

---

### Human Verification Required

#### 1. Visual Form Layout

**Test:** Start `pnpm dev`, navigate to `http://localhost:3021/research`, click an existing researcher.
**Expected:** Form displays 4 sections separated by horizontal dividers — "Research Identity" (name/topics/keywords), "Sources" (subreddits/feeds/domains/templates), "Draft Settings" (slider + max drafts input), "Channels" (multi-select). No "Schedule (hours)" field visible anywhere.
**Why human:** Visual section layout and field absence cannot be confirmed purely by grep.

#### 2. Slider Interaction

**Test:** In Draft Settings, drag the slider left and right.
**Expected:** The percentage display updates reactively (e.g., "80% / 20%"), slider thumb moves, step increments of 5.
**Why human:** Real-time interactivity requires a browser.

#### 3. Persist Round-Trip

**Test:** Change the slider to 40% and max drafts to 7, click "Save Researcher", then reload the page.
**Expected:** Form reloads with shortFormPercent = 40 and maxDraftsPerRun = 7.
**Why human:** Round-trip DB persistence requires a live database.

---

### Gaps Summary

No gaps. All automated checks pass. All 15 observable truths are verified. All 3 requirements (CFG-01, CFG-02, CFG-03) are satisfied by concrete code evidence. TypeScript compiles clean. The 4 plan-targeted test suites pass. Dead code is deleted. The schema, migration, engine, API routes, form, and page props are all correctly wired.

Three items are flagged for human verification (visual layout, slider interactivity, DB round-trip) — these are not blockers but require a running browser + database session to confirm.

---

_Verified: 2026-03-03T06:10:00Z_
_Verifier: Claude (gsd-verifier)_
