# Requirements: Orbitl

**Defined:** 2026-03-01
**Core Value:** Automated, high-quality content that sounds like the creator wrote it — from research to published post, hands-off except for final approval.

## v1.1 Requirements

Requirements for v1.1 milestone (Research Overhaul). Each maps to roadmap phases.

### Research Entity

- [x] **RES-01**: User can create a named researcher with topics, keywords, and source config
- [x] **RES-02**: User can link a researcher to one or more channels via checkbox multi-select
- [x] **RES-03**: User can edit an existing researcher's name, config, and channel assignments
- [x] **RES-04**: User can delete a researcher (cascades join table, nullifies run history)
- [x] **RES-05**: Existing per-channel research configs are migrated to standalone researchers

### Research Page

- [x] **PAGE-01**: User sees "Research" in the sidebar nav between Channels and Drafts
- [x] **PAGE-02**: Research list page shows all researchers with linked channel badges and last run info
- [x] **PAGE-03**: User can navigate to create a new researcher from the Research page
- [x] **PAGE-04**: User can navigate to a researcher detail page to edit config and run research

### Live Progress

- [x] **PROG-01**: User can click "Run Research" on a researcher and see a live step-by-step log
- [x] **PROG-02**: Each adapter start/result/error streams as a separate log line with color coding
- [x] **PROG-03**: Topic ranking step appears in the log before completion
- [x] **PROG-04**: Errors display inline in the log (red) without crashing the UI

### Channel Cleanup

- [x] **CLEAN-01**: Research Config tab is removed from channel detail page
- [x] **CLEAN-02**: Channel overview links to /research instead of showing run button

## Future Requirements

Deferred to v1.2+. Tracked but not in current roadmap.

### Twitter/X Publisher (from scrapped v1.1)

- **TWIT-01**: User can create a Twitter/X channel with OAuth 1.0a credentials
- **TWIT-02**: User can publish a single tweet from the publish queue
- **TWIT-03**: User can publish a thread (sequential reply chain) from the publish queue
- **TWIT-04**: User sees actionable error messages for Twitter API failures
- **TWIT-05**: Twitter credentials are encrypted at rest using existing AES-256 encryption

### Twitter Content Generation (from scrapped v1.1)

- **GEN-01**: User can generate a tweet draft (hook/body/CTA, ≤280 chars per segment) from channel research
- **GEN-02**: Tweet generation uses voice-adapted conciseness
- **GEN-03**: User can generate a thread from an approved long-form draft
- **GEN-04**: Generated threads follow hook → value tweets → CTA structure (5-10 tweets)
- **GEN-05**: User can pick from 3 alternate opening hook options for generated threads

### Twitter Draft Review (from scrapped v1.1)

- **REVIEW-01**: User sees tweet drafts as a card-by-card thread preview
- **REVIEW-02**: Each tweet card shows character count with green/yellow/red indicator
- **REVIEW-03**: User can edit individual tweets within a thread before approving

### Tech Debt (from scrapped v1.1)

- **DEBT-01**: "Publish now" button dispatches draft to publisher immediately (not a stub)
- **DEBT-02**: Retry on failed queue items resets retryCount to 0
- **DEBT-03**: DISABLE_INTERNAL_CRON env var prevents internal cron from running
- **DEBT-04**: Scheduler window hours respect channel's configured timezone
- **DEBT-05**: CreateChannelForm shows specific error messages

### Media

- **MEDIA-01**: User can attach images to tweets
- **MEDIA-02**: User can attach images to thread tweets

### Publishers

- **PUB-01**: User can publish to Bluesky
- **PUB-02**: User can publish to Mastodon

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-tenant researcher sharing | Single-user self-hosted tool — no sharing model needed |
| Research scheduling (auto-run) | Manual trigger with live progress is the v1.1 UX; scheduling is v1.2 |
| Research result caching/dedup | Over-engineering for v1.1; add if duplicates become a problem |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RES-01 | Phase 8 | Done |
| RES-02 | Phase 9 | Done |
| RES-03 | Phase 9 | Done |
| RES-04 | Phase 9 | Done |
| RES-05 | Phase 8 | Done |
| PAGE-01 | Phase 10 | Done |
| PAGE-02 | Phase 10 | Done |
| PAGE-03 | Phase 10 | Done |
| PAGE-04 | Phase 10 | Done |
| PROG-01 | Phase 9 | Done |
| PROG-02 | Phase 9 | Done |
| PROG-03 | Phase 9 | Done |
| PROG-04 | Phase 9 | Done |
| CLEAN-01 | Phase 11 | Done |
| CLEAN-02 | Phase 11 | Done |

**Coverage:**
- v1.1 requirements: 15 total
- Mapped to phases: 15
- Completed: 15

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 — all 15 requirements implemented*
