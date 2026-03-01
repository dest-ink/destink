# Roadmap: Orbitl

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 + 3.1 (shipped 2026-03-01)
- ✅ **v1.1 Research Overhaul** — Phases 8-11 (shipped 2026-03-01)

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

### ✅ v1.1 Research Overhaul (Shipped 2026-03-01)

**Milestone Goal:** Research configs become standalone named entities with multi-channel support, a dedicated Research page, and live step-by-step progress during runs.

- [x] **Phase 8: Research Schema & Migration** - New tables + data migration from per-channel configs
- [x] **Phase 9: Research API & Progress Infrastructure** - CRUD routes, SSE endpoint, orchestrator progress events
- [x] **Phase 10: Research Page UI** - Sidebar nav, list page, create/edit forms, live run panel
- [x] **Phase 11: Channel Page Cleanup** - Remove Research Config tab, update channel overview

## Phase Details

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
**Goal**: Channel detail page no longer has a Research Config tab — research is managed from /research
**Depends on**: Phase 10
**Requirements**: CLEAN-01, CLEAN-02
**Success Criteria** (what must be TRUE):
  1. The channel detail page tabs no longer include "Research Config"
  2. The channel overview tab shows a link to /research instead of a "Run Research" button
  3. No orphaned imports or dead code from the removed ResearchConfigForm

Plans:
- [x] 11-01: Remove Research Config tab + update OverviewTab

## Progress

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

---
*Full v1.0 details: .planning/milestones/v1.0-ROADMAP.md*
*Scrapped v1.1 Twitter details: .planning/milestones/v1.1-twitter-ROADMAP.md*
