---
phase: 13-draft-generation
verified: 2026-03-03T15:24:30Z
status: passed
score: 18/18 must-haves verified
re_verification: false
human_verification:
  - test: "Click Generate Drafts button on a completed run and observe SSE log"
    expected: "Log shows draft-start (blue), draft-complete (green), drafts-done (green) events; button replaces with 'Drafts Generated (N)' badge and 'View drafts' link"
    why_human: "SSE streaming UI behavior and visual rendering cannot be verified programmatically"
  - test: "Enable autoDraft toggle, save researcher, run research — observe the research SSE log"
    expected: "After 'Run complete' log line, additional 'Generating draft N/M: [title]...' lines appear automatically, followed by 'N drafts created' line"
    why_human: "Auto-draft requires a live research run and SSE stream observation"
  - test: "Click Generate Drafts on a run that already has drafts generated (or click twice)"
    expected: "A yellow log line appears: 'Drafts already generated for this run' — button should not crash"
    why_human: "409 response handling requires a real HTTP interaction to confirm correct client-side behavior"
  - test: "Navigate to /research/[id]/runs and verify runs with generated drafts show badge"
    expected: "Runs that have drafts show a green 'N draft(s)' badge in the runs list row"
    why_human: "Visual badge rendering requires browser confirmation"
---

# Phase 13: Draft Generation Verification Report

**Phase Goal:** Build the draft generation engine that converts top-ranked research topics into content drafts, with auto-generation support and manual trigger capability.
**Verified:** 2026-03-03T15:24:30Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | autoDraft boolean column exists on researchers table with default false | VERIFIED | `src/db/schema.ts:105` — `autoDraft: boolean('auto_draft').default(false).notNull()`; migration `0005_tranquil_omega_sentinel.sql` — `ALTER TABLE "researchers" ADD COLUMN "auto_draft" boolean DEFAULT false NOT NULL` |
| 2 | generateDraftsForRun() creates drafts from a run's top-ranked topics, one per channel, using shortFormPercent ratio | VERIFIED | `src/lib/generation/batch.ts:57-170` — full implementation with assignContentTypes, DB inserts with correct fields and status |
| 3 | assignContentTypes() deterministically assigns note/article based on shortFormPercent, favoring short-form on ties | VERIFIED | `src/lib/generation/batch.ts:31-44` — Math.round ratio logic; all 8 unit tests pass including 50% tie scenario |
| 4 | Title-based dedup skips topics that already have a draft for the same channel | VERIFIED | `src/lib/generation/batch.ts:76-105` — loads last 10 draft titles, builds existingTitles Set, skips on match and emits draft-skipped |
| 5 | draftsGenerated jsonb on researchRuns is populated with generated draft IDs | VERIFIED | `src/lib/generation/batch.ts:155-160` — updates researchRuns.draftsGenerated when generatedIds.length > 0 |
| 6 | All generated drafts have status pending_review | VERIFIED | `src/lib/generation/batch.ts:139` — `status: 'pending_review'` set explicitly in insert (not relying on DB default) |
| 7 | Progress event types for draft generation are defined and exported | VERIFIED | `src/lib/research/progress.ts:12-16` — all 5 types (draft-start, draft-complete, draft-error, draft-skipped, drafts-done) with correct shapes |
| 8 | When autoDraft is true, completing a research run automatically generates drafts | VERIFIED | `src/lib/research/engine.ts:209-229` — `if (researcher.autoDraft)` block calls generateDraftsForRun after run-complete, failures caught without affecting run status |
| 9 | POST /api/researchers/[id]/runs/[runId]/generate-drafts returns SSE stream | VERIFIED | `src/app/api/researchers/[id]/runs/[runId]/generate-drafts/route.ts:46-80` — ReadableStream with SSE headers, delegates to generateDraftsForRun |
| 10 | Manual trigger endpoint returns 409 if drafts already generated | VERIFIED | `src/app/api/researchers/[id]/runs/[runId]/generate-drafts/route.ts:35-41` — guard checks `run.draftsGenerated` non-empty array, returns 409 JSON |
| 11 | PUT /api/researchers/[id] accepts and persists autoDraft field | VERIFIED | `src/app/api/researchers/[id]/route.ts:68` — `if ('autoDraft' in body) updates.autoDraft = body.autoDraft` |
| 12 | Draft event types render in ResearchRunPanel | VERIFIED | `src/components/research/ResearchRunPanel.tsx:123-152` — all 5 draft event cases with correct colors (blue, green, destructive, muted, green/yellow) |
| 13 | GenerateDraftsButton exists with SSE log and badge/button toggle | VERIFIED | `src/components/research/GenerateDraftsButton.tsx:1-194` — 194-line component, full SSE consumer, badge/button conditional render, router.refresh() |
| 14 | After drafts generated, button replaced by 'Drafts Generated (N)' badge + 'View drafts' link | VERIFIED | `src/components/research/GenerateDraftsButton.tsx:154-164` — conditional on `draftsGenerated && draftsGenerated.length > 0` |
| 15 | autoDraft toggle appears in ResearcherForm Draft Settings section | VERIFIED | `src/components/research/ResearcherForm.tsx:257-271` — checkbox with label "Auto-generate drafts after each run", autoDraft in payload |
| 16 | RunsList shows drafts badge for runs with draftsGenerated | VERIFIED | `src/components/research/RunsList.tsx:20, 74-81` — draftsGenerated in Run interface; green badge conditional render |
| 17 | Run detail page passes draftsGenerated and researcherId to RunDetail | VERIFIED | `src/app/(app)/research/[id]/runs/[runId]/page.tsx:34, 66-67` — draftsGenerated selected from DB; both props passed to RunDetail |
| 18 | Runs page selects and passes draftsGenerated to RunsList | VERIFIED | `src/app/(app)/research/[id]/runs/page.tsx:35, 47` — draftsGenerated in DB select; passed in serializedRuns map |

**Score:** 18/18 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` | autoDraft column on researchers table | VERIFIED | Line 105: `autoDraft: boolean('auto_draft').default(false).notNull()` |
| `src/db/migrations/0005_tranquil_omega_sentinel.sql` | Migration for autoDraft column | VERIFIED | File exists; `ALTER TABLE "researchers" ADD COLUMN "auto_draft" boolean DEFAULT false NOT NULL` |
| `src/lib/generation/batch.ts` | generateDraftsForRun() and assignContentTypes() | VERIFIED | 170 lines; exports DraftBatchResult, assignContentTypes, generateDraftsForRun |
| `src/lib/research/progress.ts` | Draft generation event types in ResearchProgressEvent union | VERIFIED | 5 draft types at lines 12-16 |
| `tests/lib/generation/batch.test.ts` | Tests for assignContentTypes (min 30 lines) | VERIFIED | 127 lines; 8 tests all passing |
| `src/lib/research/engine.ts` | Auto-draft hook after run-complete | VERIFIED | Lines 209-229; imports and calls generateDraftsForRun when autoDraft=true |
| `src/app/api/researchers/[id]/runs/[runId]/generate-drafts/route.ts` | Manual trigger SSE endpoint exporting POST | VERIFIED | 82 lines; exports POST via auth(); SSE stream + 409 guard |
| `src/app/api/researchers/[id]/route.ts` | PUT handler accepts autoDraft | VERIFIED | Line 68: autoDraft field added |
| `src/components/research/ResearchRunPanel.tsx` | Draft event handling with draft-start case | VERIFIED | Lines 123-152; all 5 draft cases handled |
| `src/components/research/GenerateDraftsButton.tsx` | Client component with Generate Drafts button + badge | VERIFIED | 194 lines; full SSE consumer, badge/button toggle, router.refresh() |
| `src/components/research/RunDetail.tsx` | Contains GenerateDraftsButton | VERIFIED | Line 3 import, lines 76-82 render in summary card |
| `src/components/research/ResearcherForm.tsx` | autoDraft toggle checkbox | VERIFIED | Lines 257-271; checkbox + label + payload inclusion |
| `src/components/research/RunsList.tsx` | draftsGenerated badge on run rows | VERIFIED | Lines 20, 74-81; field in interface, conditional badge render |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/generation/batch.ts` | `src/lib/generation/generator.ts` | `import generateDraft` | WIRED | Line 5: `import { generateDraft } from '@/lib/generation/generator'`; called at line 112 |
| `src/lib/generation/batch.ts` | `src/db/schema.ts` | `import drafts, researchRuns, channels` | WIRED | Lines 3-4: imports drafts, channels, researchRuns; used in DB queries |
| `src/lib/generation/batch.ts` | `src/lib/research/progress.ts` | uses ResearchProgressEvent / OnProgress | WIRED | Line 7: `import type { OnProgress }`; used as onProgress parameter type |
| `src/lib/research/engine.ts` | `src/lib/generation/batch.ts` | `import generateDraftsForRun` | WIRED | Line 13: `import { generateDraftsForRun } from '@/lib/generation/batch'`; called at line 213 |
| `src/app/api/researchers/[id]/runs/[runId]/generate-drafts/route.ts` | `src/lib/generation/batch.ts` | `import generateDraftsForRun` | WIRED | Line 6: `import { generateDraftsForRun }`; called at line 52 |
| `src/components/research/ResearchRunPanel.tsx` | `src/lib/research/progress.ts` | import ResearchProgressEvent, draft event handling | WIRED | Line 4: `import type { ResearchProgressEvent }`; draft-start case at line 123 |
| `src/components/research/GenerateDraftsButton.tsx` | `src/app/api/researchers/[id]/runs/[runId]/generate-drafts/route.ts` | fetch POST to SSE endpoint | WIRED | Line 55: `fetch('/api/researchers/${researcherId}/runs/${runId}/generate-drafts', { method: 'POST' })` |
| `src/app/(app)/research/[id]/runs/[runId]/page.tsx` | `src/components/research/RunDetail.tsx` | passes draftsGenerated and researcherId | WIRED | Lines 34, 66-67: draftsGenerated selected from DB and passed as prop |
| `src/components/research/ResearcherForm.tsx` | `src/app/api/researchers/[id]/route.ts` | sends autoDraft in PUT payload | WIRED | Line 101: `autoDraft` in payload; line 110: PUT to `/api/researchers/${researcher.id}` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DRAFT-01 | 13-02, 13-03 | User can click "Generate Drafts" on a research run to create drafts from top-ranked topics | SATISFIED | GenerateDraftsButton component POSTs to generate-drafts endpoint; SSE log shows generation events; badge replaces button after completion |
| DRAFT-02 | 13-01, 13-02 | Research engine auto-generates drafts after a run completes, respecting maxDraftsPerRun setting | SATISFIED | engine.ts calls generateDraftsForRun when researcher.autoDraft=true; maxDraftsPerRun passed to assignContentTypes as count parameter |
| DRAFT-03 | 13-01 | Draft generation uses contentTypeMix (note vs article ratio) to determine content types | SATISFIED | assignContentTypes() pure function with Math.round ratio; 8 unit tests covering all scenarios pass |
| DRAFT-04 | 13-01 | Drafts are only created for channels linked to the researcher | SATISFIED | generateDraftsForRun() takes channelId; engine.ts calls it per-channel inside the per-channel loop; generate-drafts endpoint verifies run belongs to researcher |
| DRAFT-05 | 13-01, 13-03 | The draftsGenerated field on research runs is populated with generated draft IDs | SATISFIED | batch.ts updates researchRuns.draftsGenerated; run detail page and runs list page select and display this field |
| DRAFT-06 | 13-01 | All generated drafts are created with pending_review status | SATISFIED | batch.ts:139 — `status: 'pending_review'` set explicitly in insert values |

No orphaned requirements found — all 6 DRAFT requirements are claimed by plans and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/research/ResearcherForm.tsx` | 151, 179, 189, 199, 213 | HTML `placeholder` attribute on input fields | Info | Input placeholder text for UX guidance — not a code stub, legitimate use |

No blockers or warnings found. The only `placeholder` matches are HTML input placeholder attributes for user-facing form hints, not code stubs.

### Human Verification Required

#### 1. Generate Drafts SSE Flow

**Test:** Navigate to a completed research run at /research/[id]/runs/[runId]. Click the "Generate Drafts" button.
**Expected:** SSE log panel appears below the button, showing blue "Generating draft N/M: [title]..." lines, green "Draft N/M created: [title]" lines, and a final "N drafts created" summary. After stream closes, the button is replaced by a green "Drafts Generated (N)" badge and a "View drafts" link.
**Why human:** SSE streaming UI rendering, scroll behavior, and the button-to-badge transition cannot be verified programmatically.

#### 2. Auto-Draft SSE Log During Research Run

**Test:** Enable the "Auto-generate drafts after each run" checkbox in ResearcherForm, save, then click "Run Research" on the runs page.
**Expected:** The ResearchRunPanel SSE log shows the standard research events (adapter-start, adapter-result, etc.), followed by draft generation events (Generating draft 1/N..., Draft created..., N drafts created) after the "Run complete" line. The stream remains open through draft generation.
**Why human:** Requires a live research run and real-time SSE observation.

#### 3. 409 Re-Generation Guard (Client Behavior)

**Test:** Navigate to a run that already has drafts generated. Click "Generate Drafts" (or navigate to one that shows the badge and trigger via direct API call).
**Expected:** A yellow log line appears: "Drafts already generated for this run". No crash or unhandled error state.
**Why human:** 409 guard requires a real HTTP round-trip to confirm client-side error handling behavior.

#### 4. Drafts Badge in Runs List

**Test:** Navigate to /research/[id]/runs after drafts have been generated for one or more runs.
**Expected:** Runs with generated drafts show a small green "N draft(s)" badge in the right-hand stats area of each run row.
**Why human:** Visual badge rendering requires browser confirmation.

### Gaps Summary

No gaps found. All 18 must-have truths are verified against actual code:

- **Plan 01 (Engine):** `src/lib/generation/batch.ts` fully implements `generateDraftsForRun()` and `assignContentTypes()`. Migration `0005` exists and contains the correct SQL. `src/lib/research/progress.ts` has all 5 draft event types. 8 unit tests pass.
- **Plan 02 (Wiring):** `src/lib/research/engine.ts` has the auto-draft hook inside the per-channel loop. The `generate-drafts` SSE endpoint exists with researcher+run loading and 409 guard. PUT handler accepts `autoDraft`. ResearchRunPanel handles all 5 draft event types.
- **Plan 03 (UI):** `GenerateDraftsButton` is a substantive 194-line component with full SSE consumption, badge/button toggle, and router.refresh(). RunDetail embeds it. ResearcherForm has the autoDraft checkbox and includes it in the PUT payload. RunsList shows the drafts badge. All server pages select and pass `draftsGenerated` from the DB.
- **TypeScript:** `npx tsc --noEmit` passes cleanly.
- **Tests:** All 8 `batch.test.ts` tests pass.
- **Commits:** All 7 commits (7586583, 9d241a7, e0183b1, 8c6325a, 079b9e2, d8de9f1, 94d8f5d) verified in git log.

---

_Verified: 2026-03-03T15:24:30Z_
_Verifier: Claude (gsd-verifier)_
