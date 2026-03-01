# Roadmap: Orbitl

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 + 3.1 (shipped 2026-03-01)
- 🚧 **v1.1 Twitter/X & Cleanup** — Phases 5-7 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-03-01</summary>

- [x] Phase 1: Cleanup & Foundation (4/4 plans) — completed 2026-02-27
- [x] Phase 2: Pluggable Provider System (4/4 plans) — completed 2026-02-28
- [x] Phase 3: Authentication & UI Polish (4/4 plans) — completed 2026-02-28
- [x] Phase 3.1: Fix CronJob Registry Init (1/1 plan) — completed 2026-02-28
- [x] Phase 4: Deployment & Observability (4/4 plans) — completed 2026-03-01

</details>

### 🚧 v1.1 Twitter/X & Cleanup (In Progress)

**Milestone Goal:** Add Twitter/X as a publishing platform with short-form content and thread generation, while eliminating v1.0 queue correctness bugs that would cause observable failures on Twitter.

- [ ] **Phase 5: Foundation — DB Migration + Tech Debt** - Correct queue semantics and enum values before any Twitter work begins
- [ ] **Phase 6: Twitter Publisher + Content Generation** - Full Twitter publishing stack and tweet/thread content generation
- [ ] **Phase 7: Thread Review UI** - Card-by-card thread preview with character counts and inline editing

## Phase Details

### Phase 5: Foundation — DB Migration + Tech Debt
**Goal**: Queue behavior is correct and the database schema supports Twitter before any new feature code ships
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04, DEBT-05
**Success Criteria** (what must be TRUE):
  1. Clicking "Publish now" on a queued item immediately dispatches it to the correct publisher — the item does not sit in "publishing" status waiting for the daemon
  2. Clicking "Retry" on a failed item resets its retry counter so it can attempt up to three retries again without immediately re-failing
  3. Running the daemon with DISABLE_INTERNAL_CRON=true produces no internal cron schedules — safe to run alongside Kubernetes CronJobs without duplicate posts
  4. A channel configured for 9:00–17:00 in America/Chicago schedules posts within that window in Chicago local time, not UTC
  5. Submitting a channel creation form with a duplicate name shows "A channel with that name already exists" instead of a generic error
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: Twitter Publisher + Content Generation
**Goal**: Users can create a Twitter channel, generate tweet and thread drafts, and publish them to Twitter/X
**Depends on**: Phase 5
**Requirements**: TWIT-01, TWIT-02, TWIT-03, TWIT-04, TWIT-05, GEN-01, GEN-02, GEN-03, GEN-04, GEN-05
**Success Criteria** (what must be TRUE):
  1. User can create a Twitter/X channel by entering OAuth 1.0a credentials (API Key, API Secret, Access Token, Access Token Secret) — credentials are stored encrypted at rest
  2. User can publish a single tweet from the publish queue and it appears on their Twitter/X profile
  3. User can publish a thread from the publish queue and it appears as a sequential reply chain on their Twitter/X profile
  4. User sees a specific, actionable error message when a Twitter API call fails — distinguishing bad credentials, monthly cap exhausted, and rate limit from each other
  5. User can generate a tweet draft from channel research — the draft follows a hook/body/CTA structure and every segment is 280 characters or fewer
  6. User can trigger "Generate thread" on an approved long-form draft and receive a structured 5-10 tweet thread where each tweet is a complete, standalone thought
  7. User sees 3 alternate opening hook options for a generated thread and can pick the one that best fits their voice
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

### Phase 7: Thread Review UI
**Goal**: Users review tweet drafts and threads in a purpose-built card interface that makes character limits and per-tweet editing visible
**Depends on**: Phase 6
**Requirements**: REVIEW-01, REVIEW-02, REVIEW-03
**Success Criteria** (what must be TRUE):
  1. Tweet drafts and threads render as individual numbered cards — not as a single text blob — so each tweet is independently scannable
  2. Each tweet card shows a character count indicator that is green when under 240 characters, yellow from 240-270, and red above 270
  3. User can click into any individual tweet card and edit its text before approving the thread
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Cleanup & Foundation | v1.0 | 4/4 | Complete | 2026-02-27 |
| 2. Pluggable Provider System | v1.0 | 4/4 | Complete | 2026-02-28 |
| 3. Authentication & UI Polish | v1.0 | 4/4 | Complete | 2026-02-28 |
| 3.1. Fix CronJob Registry Init | v1.0 | 1/1 | Complete | 2026-02-28 |
| 4. Deployment & Observability | v1.0 | 4/4 | Complete | 2026-03-01 |
| 5. Foundation — DB Migration + Tech Debt | v1.1 | 0/? | Not started | - |
| 6. Twitter Publisher + Content Generation | v1.1 | 0/? | Not started | - |
| 7. Thread Review UI | v1.1 | 0/? | Not started | - |

---
*Full v1.0 details: .planning/milestones/v1.0-ROADMAP.md*
