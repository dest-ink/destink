# Roadmap: Orbitl

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 + 3.1 (shipped 2026-03-01)
- ✅ **v1.1 Research Overhaul** — Phases 8-11 (shipped 2026-03-01)
- **v1.2 Content Pipeline Automation** — Phases 12-15 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-03-01</summary>

- [x] Phase 1: Cleanup & Foundation (4/4 plans) — completed 2026-02-27
- [x] Phase 2: Pluggable Provider System (4/4 plans) — completed 2026-02-28
- [x] Phase 3: Authentication & UI Polish (4/4 plans) — completed 2026-02-28
- [x] Phase 3.1: Fix CronJob Registry Init (1/1 plan) — completed 2026-02-28
- [x] Phase 4: Deployment & Observability (4/4 plans) — completed 2026-03-01

</details>

<details>
<summary>❌ v1.1 Twitter/X & Cleanup (Phases 5-7) — SCRAPPED, moved to v1.2+</summary>

Replaced by Research Overhaul. Original requirements archived in `.planning/milestones/v1.1-twitter-REQUIREMENTS.md`.

</details>

<details>
<summary>✅ v1.1 Research Overhaul (Phases 8-11) — SHIPPED 2026-03-01</summary>

- [x] **Phase 8: Research Schema & Migration** - New tables + data migration from per-channel configs
- [x] **Phase 9: Research API & Progress Infrastructure** - CRUD routes, SSE endpoint, orchestrator progress events
- [x] **Phase 10: Research Page UI** - Sidebar nav, list page, create/edit forms, live run panel
- [x] **Phase 11: Channel Page Cleanup** - Remove Research Config tab, update channel overview

</details>

### v1.2 Content Pipeline Automation (In Progress)

**Milestone Goal:** Wire up the full research-to-publish pipeline -- research runs generate drafts (manually or on a schedule), all drafts go through approval, and config fields are cleaned up so the UX makes sense.

- [x] **Phase 12: Config Cleanup** - Move, rename, and remove confusing config fields before building on them
- [x] **Phase 13: Draft Generation** - Engine that turns research results into drafts, plus manual trigger UI
- [x] **Phase 13.1: Fix ResearchRunPanel Post-Run Refresh** - Add router.refresh() so runs list updates after research completes (completed 2026-03-14)
- [ ] **Phase 14: Automation Config** - Schema and UI for scheduling research runs with auto-draft toggle
- [ ] **Phase 15: Automation Worker** - Cron worker that executes scheduled research runs and generates drafts

## Phase Details

<details>
<summary>✅ v1.1 Research Overhaul — Phase Details</summary>

### Phase 8: Research Schema & Migration
**Goal**: Standalone researcher entities exist in the database with a many-to-many channel relationship, and existing per-channel configs are migrated
**Depends on**: v1.0 complete
**Requirements**: RES-01 (schema), RES-05
**Success Criteria** (what must be TRUE):
  1. A `researchers` table exists with columns for id, name, topics, keywords, and source config (JSON)
  2. A `researcherChannels` join table exists linking researchers to channels (many-to-many)
  3. The `researchRuns` table has a `researcherId` foreign key (nullable for historical runs)
  4. Running the migration on a database with existing per-channel research configs creates one researcher per channel config and links it to the source channel
  5. Drizzle schema types are generated and the app builds without type errors

Plans:
- [x] 08-01: Schema + migration + data migration script

### Phase 9: Research API & Progress Infrastructure
**Goal**: Full CRUD for researchers via API routes, plus SSE-based live progress streaming during research runs
**Depends on**: Phase 8
**Requirements**: RES-02, RES-03, RES-04, PROG-01, PROG-02, PROG-03, PROG-04
**Success Criteria** (what must be TRUE):
  1. POST /api/researchers creates a researcher with name, config, and channel IDs
  2. PUT /api/researchers/[id] updates a researcher's name, config, and channel assignments
  3. DELETE /api/researchers/[id] removes the researcher, cascades join table rows, and nullifies researcherId on existing runs
  4. POST /api/researchers/[id]/run triggers a research run and returns an SSE stream
  5. The SSE stream emits events for: adapter-start, adapter-result, adapter-error, topic-ranking, run-complete
  6. Errors during a run appear as adapter-error events in the stream (not 500s)
  7. The `callClaude` JSON code fence stripping works correctly (verified by a successful topic ranking step)

Plans:
- [x] 09-01: CRUD routes + SSE endpoint + progress events

### Phase 10: Research Page UI
**Goal**: Users can manage researchers and run research from a dedicated Research page with live progress feedback
**Depends on**: Phase 9
**Requirements**: PAGE-01, PAGE-02, PAGE-03, PAGE-04
**Success Criteria** (what must be TRUE):
  1. "Research" appears in the sidebar nav between Channels and Drafts
  2. The /research page lists all researchers as cards showing name, linked channel badges, and last run timestamp
  3. Clicking "New Researcher" navigates to a form with name, topics, keywords, source config, and channel multi-select
  4. Clicking a researcher card navigates to a detail/edit page with the same form fields plus a "Run Research" button
  5. Clicking "Run Research" opens a live progress panel that shows step-by-step log lines as the run proceeds
  6. Adapter errors appear as red log lines in the progress panel without crashing the page

Plans:
- [x] 10-01: Sidebar nav + list page + create/edit + run panel

### Phase 11: Channel Page Cleanup
**Goal**: Channel detail page no longer has a Research Config tab -- research is managed from /research
**Depends on**: Phase 10
**Requirements**: CLEAN-01, CLEAN-02
**Success Criteria** (what must be TRUE):
  1. The channel detail page tabs no longer include "Research Config"
  2. The channel overview tab shows a link to /research instead of a "Run Research" button
  3. No orphaned imports or dead code from the removed ResearchConfigForm

Plans:
- [x] 11-01: Remove Research Config tab + update OverviewTab

</details>

### Phase 12: Config Cleanup
**Goal**: Config fields are reorganized so draft generation and automation settings live in the right place with clear labels
**Depends on**: v1.1 complete
**Requirements**: CFG-01, CFG-02, CFG-03
**Success Criteria** (what must be TRUE):
  1. maxDraftsPerRun no longer appears in the researcher's source config form -- it lives in a draft generation or automation settings area
  2. The former notePercent field is labeled "Note vs Article %" with a description explaining the difference between notes and articles
  3. scheduleHours no longer exists in the researcher source config (field removed from schema and UI)
  4. Existing researcher configs with these fields still work after migration (no data loss)
**Plans:** 2/2 plans complete

Plans:
- [x] 12-01-PLAN.md — Schema migration, type cleanup, API routes, engine, tests, dead code deletion
- [x] 12-02-PLAN.md — Slider component, form restructuring with sections, UI cleanup

### Phase 13: Draft Generation
**Goal**: Research runs can produce drafts -- either automatically after a run completes or manually via a button -- respecting channel links and content type settings
**Depends on**: Phase 12
**Requirements**: DRAFT-01, DRAFT-02, DRAFT-03, DRAFT-04, DRAFT-05, DRAFT-06
**Success Criteria** (what must be TRUE):
  1. User can click "Generate Drafts" on a completed research run and see drafts created from the top-ranked topics
  2. When auto-draft is enabled, completing a research run automatically generates drafts without user intervention
  3. Generated drafts respect the contentTypeMix setting -- the ratio of notes to articles matches the configured percentage
  4. Drafts are only created for channels linked to the researcher that produced the run (not all channels)
  5. The research run record shows which draft IDs were generated from it (draftsGenerated field populated)
  6. Every generated draft has pending_review status -- no draft skips the approval queue
**Plans:** 3/3 plans complete

Plans:
- [x] 13-01-PLAN.md — Schema migration (autoDraft column), batch generation engine, progress event types, unit tests
- [x] 13-02-PLAN.md — Auto-draft wiring in engine, manual trigger API endpoint, SSE panel event handling
- [x] 13-03-PLAN.md — GenerateDraftsButton component, RunDetail UI, autoDraft toggle, RunsList badge

### Phase 13.1: Fix ResearchRunPanel Post-Run Refresh
**Goal**: After a research run completes, the runs list page refreshes automatically so the new run row and draft badge appear without a manual page reload
**Depends on**: Phase 13
**Requirements**: DRAFT-02 (UI feedback gap closure)
**Gap Closure**: Closes integration gap from v1.2 audit — ResearchRunPanel missing router.refresh()
**Success Criteria** (what must be TRUE):
  1. After a research run completes via ResearchRunPanel, the runs list updates to show the new run without a manual page reload
  2. If auto-draft generated drafts, the draft count badge appears on the new run row immediately
**Plans:** 1/1 plans complete

Plans:
- [ ] 13.1-01-PLAN.md — Add router.refresh() to ResearchRunPanel finally block

### Phase 14: Automation Config
**Goal**: Users can configure when research runs happen automatically and whether those runs generate drafts, all in a dedicated automation settings area separate from research source config
**Depends on**: Phase 13
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-05
**Success Criteria** (what must be TRUE):
  1. User can set an automation schedule for a researcher using a cron expression or interval picker
  2. User can toggle auto-draft generation on or off per automation schedule
  3. User can set max drafts per scheduled run in the automation config (not in source config)
  4. Automation settings live in their own section or page, visually and structurally separate from the researcher's source/topic config
**Plans**: TBD

Plans:
- [ ] 14-01: TBD

### Phase 15: Automation Worker
**Goal**: Scheduled research runs execute automatically at the configured times and generate drafts when auto-draft is enabled
**Depends on**: Phase 14
**Requirements**: AUTO-04
**Success Criteria** (what must be TRUE):
  1. A researcher with an automation schedule runs research automatically at the scheduled time without user interaction
  2. When auto-draft is enabled on the schedule, drafts are generated after the automated research run completes
  3. When auto-draft is disabled on the schedule, the research run completes but no drafts are created
  4. Automated runs appear in the research run history the same way manual runs do
**Plans**: TBD

Plans:
- [ ] 15-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 12 → 13 → 13.1 → 14 → 15

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Cleanup & Foundation | v1.0 | 4/4 | Complete | 2026-02-27 |
| 2. Pluggable Provider System | v1.0 | 4/4 | Complete | 2026-02-28 |
| 3. Authentication & UI Polish | v1.0 | 4/4 | Complete | 2026-02-28 |
| 3.1. Fix CronJob Registry Init | v1.0 | 1/1 | Complete | 2026-02-28 |
| 4. Deployment & Observability | v1.0 | 4/4 | Complete | 2026-03-01 |
| 8. Research Schema & Migration | v1.1 | 1/1 | Complete | 2026-03-01 |
| 9. Research API & Progress Infrastructure | v1.1 | 1/1 | Complete | 2026-03-01 |
| 10. Research Page UI | v1.1 | 1/1 | Complete | 2026-03-01 |
| 11. Channel Page Cleanup | v1.1 | 1/1 | Complete | 2026-03-01 |
| 12. Config Cleanup | v1.2 | Complete    | 2026-03-03 | 2026-03-03 |
| 13. Draft Generation | 3/3 | Complete    | 2026-03-03 | 2026-03-03 |
| 13.1. Fix ResearchRunPanel Refresh | 1/1 | Complete    | 2026-03-14 | - |
| 14. Automation Config | v1.2 | 0/? | Not started | - |
| 15. Automation Worker | v1.2 | 0/? | Not started | - |

---
*Full v1.0 details: .planning/milestones/v1.0-ROADMAP.md*
*Scrapped v1.1 Twitter details: .planning/milestones/v1.1-twitter-ROADMAP.md*
