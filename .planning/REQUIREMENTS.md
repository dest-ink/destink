# Requirements: Orbitl

**Defined:** 2026-02-28
**Core Value:** Automated, high-quality content that sounds like the creator wrote it — from research to published post, hands-off except for final approval.

## v1.1 Requirements

Requirements for v1.1 milestone (Twitter/X & Cleanup). Each maps to roadmap phases.

### Twitter Publisher

- [ ] **TWIT-01**: User can create a Twitter/X channel with OAuth 1.0a credentials (API Key, API Secret, Access Token, Access Token Secret)
- [ ] **TWIT-02**: User can publish a single tweet from the publish queue
- [ ] **TWIT-03**: User can publish a thread (sequential reply chain) from the publish queue
- [ ] **TWIT-04**: User sees actionable error messages for Twitter API failures (auth expired, rate limited, forbidden)
- [ ] **TWIT-05**: Twitter credentials are encrypted at rest using existing AES-256 encryption

### Content Generation

- [ ] **GEN-01**: User can generate a tweet draft (hook/body/CTA structure, ≤280 chars per segment) from channel research
- [ ] **GEN-02**: Tweet generation uses voice-adapted conciseness (short sentences, declarative phrasing, no hedging)
- [ ] **GEN-03**: User can generate a thread from an approved long-form draft via one-click "Generate thread" action
- [ ] **GEN-04**: Generated threads follow hook → value tweets → CTA structure (5-10 tweets)
- [ ] **GEN-05**: User can pick from 3 alternate opening hook options for generated threads

### Draft Review

- [ ] **REVIEW-01**: User sees tweet drafts as a card-by-card thread preview (not a text blob)
- [ ] **REVIEW-02**: Each tweet card shows character count with green/yellow/red indicator
- [ ] **REVIEW-03**: User can edit individual tweets within a thread before approving

### Tech Debt

- [ ] **DEBT-01**: "Publish now" button dispatches draft to publisher immediately (not a stub)
- [ ] **DEBT-02**: Retry on failed queue items resets retryCount to 0 (not increment)
- [ ] **DEBT-03**: DISABLE_INTERNAL_CRON env var prevents internal cron from running when set
- [ ] **DEBT-04**: Scheduler window hours respect channel's configured timezone
- [ ] **DEBT-05**: CreateChannelForm shows specific error messages (duplicate name, missing fields) instead of generic errors

## Future Requirements

Deferred to v1.2+. Tracked but not in current roadmap.

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
| OAuth 2.0 PKCE for Twitter | OAuth 1.0a is simpler for self-hosted single-user; no redirect/refresh complexity |
| Tweet analytics/metrics | Requires paid X API tier ($100+/mo); contradicts open-source constraint |
| Media/image uploads | Chunked upload flow adds significant complexity; defer to v1.2 |
| Twitter native scheduling | Orbitl already has scheduling; duplicating in provider adds no value |
| Thread reordering after generation | Standard draft editor handles editing; card preview is for review |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TWIT-01 | — | Pending |
| TWIT-02 | — | Pending |
| TWIT-03 | — | Pending |
| TWIT-04 | — | Pending |
| TWIT-05 | — | Pending |
| GEN-01 | — | Pending |
| GEN-02 | — | Pending |
| GEN-03 | — | Pending |
| GEN-04 | — | Pending |
| GEN-05 | — | Pending |
| REVIEW-01 | — | Pending |
| REVIEW-02 | — | Pending |
| REVIEW-03 | — | Pending |
| DEBT-01 | — | Pending |
| DEBT-02 | — | Pending |
| DEBT-03 | — | Pending |
| DEBT-04 | — | Pending |
| DEBT-05 | — | Pending |

**Coverage:**
- v1.1 requirements: 18 total
- Mapped to phases: 0
- Unmapped: 18

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after initial definition*
