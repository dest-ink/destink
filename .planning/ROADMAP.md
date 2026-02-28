# Roadmap: Orbitl

## Overview

Tasks 1.1–7.3 are complete on the `feature/build` branch. This roadmap covers the remaining work to reach v1 launch: fixing four known defects before containerizing, refactoring hardcoded publishers and research adapters into a pluggable drop-in system, adding authentication and polishing the UI for real users, then delivering Docker Compose deployment with an observability dashboard. Each phase builds on the previous — cleanup before build, interfaces before implementations, auth before public deployment.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Cleanup & Foundation** - Fix four known code defects and add test coverage before any new code is written (completed 2026-02-27)
- [x] **Phase 2: Pluggable Provider System** - Refactor publishers and research adapters into auto-discovered drop-in modules (completed 2026-02-28)
- [ ] **Phase 3: Authentication & UI Polish** - Add single-user auth and make every screen production-ready
- [ ] **Phase 4: Deployment & Observability** - Docker Compose self-hosting and AI usage dashboard

## Phase Details

### Phase 1: Cleanup & Foundation
**Goal**: The codebase is clean, correct, and safe to containerize — known defects are resolved and the queue runner is tested
**Depends on**: Nothing (first phase)
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04, CLEAN-05, CLEAN-06
**Success Criteria** (what must be TRUE):
  1. Job scripts (`publish.ts`, `research.ts`) exit cleanly without `process.exit(0)` — DB pool closes via `pool.end()` in `finally` blocks
  2. Queue items stuck in `publishing` status are automatically recovered on the next daemon cycle, not left permanently frozen
  3. The daemon responds to SIGTERM with a graceful shutdown — in-flight publishes complete, DB connections close, no zombie processes
  4. A daily summary job runs via `npm run job:daily-summary` and logs a digest of research, drafts, and publishes
  5. Queue runner test suite passes (`tests/lib/publishing/queue-runner.test.ts`) covering normal publish, failure handling, and stuck-item recovery
**Plans**: 4 plans
- [x] 01-01-PLAN.md — Fix pool lifecycle and add stuck item recovery (CLEAN-01, CLEAN-02)
- [x] 01-02-PLAN.md — Graceful daemon shutdown and daily summary (CLEAN-03, CLEAN-04, CLEAN-05)
- [x] 01-03-PLAN.md — Queue runner test suite (CLEAN-06)
- [ ] 01-04-PLAN.md — Gap closure: fix TypeScript type errors in queue runner tests (CLEAN-06)

### Phase 2: Pluggable Provider System
**Goal**: Publishers and research adapters are drop-in modules — a contributor adds a new platform by creating one file, with no changes to core orchestration code
**Depends on**: Phase 1
**Requirements**: PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-06, PUB-07, RES-01, RES-02, RES-03, RES-04, RES-05, RES-06
**Success Criteria** (what must be TRUE):
  1. Dropping a new `*.provider.ts` file into the publishers directory causes it to be discovered and registered at startup with no other code changes required
  2. Dropping a new `*.adapter.ts` file into the research adapters directory causes it to be fanned out alongside existing adapters, with no other code changes required
  3. The queue runner dispatches to the correct publisher by looking up `channel.platform` in the registry — no platform-specific `if/else` chains remain in `queue-runner.ts`
  4. The research orchestrator fans out to all registered adapters via `registry.getAll()` — no hardcoded adapter imports remain in `orchestrator.ts`
  5. A provider with a missing required interface method is rejected at startup with a clear error, not silently loaded and broken at publish time
**Plans**: 4 plans
Plans:
- [ ] 02-01-PLAN.md — Provider contracts and generic Registry class (PUB-01, PUB-07, RES-01)
- [ ] 02-02-PLAN.md — Publisher providers, registry, and queue-runner dispatch (PUB-02, PUB-03, PUB-04, PUB-05, PUB-06)
- [ ] 02-03-PLAN.md — Research adapters and adapter registry (RES-03, RES-04, RES-05, RES-06)
- [ ] 02-04-PLAN.md — Integration wiring: orchestrator, engine, daemon, instrumentation, channels API (RES-02)

### Phase 3: Authentication & UI Polish
**Goal**: The application requires login before any data is accessible, and every screen is polished enough to hand to a real user
**Depends on**: Phase 2
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09
**Success Criteria** (what must be TRUE):
  1. Unauthenticated requests to any `/api/**` route return 401 — the application is safe to expose over a network
  2. A user can log in with email and password, and their session persists across browser refresh without re-authenticating
  3. A user can log out from any page and is redirected to the login screen
  4. Every list view (channels, drafts, queue) shows a helpful empty state with a specific next-step call to action when no items exist
  5. Draft review displays the voice confidence score, headline options picker, and research source attribution — the three key signals that distinguish Orbitl output from generic AI content
  6. Per-channel cost data is visible in the channel dashboard, and retry affordances appear on failed queue items
**Plans**: TBD

### Phase 4: Deployment & Observability
**Goal**: A creator can self-host the complete Orbitl stack on a single machine with one command, and monitor AI usage and cost from a dashboard
**Depends on**: Phase 3
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06, OBS-01, OBS-02
**Success Criteria** (what must be TRUE):
  1. `docker compose up` on a fresh clone with a populated `.env` starts PostgreSQL, runs migrations, and brings up the web and daemon services — no manual steps required
  2. All services have health checks; the web service does not start until the database is ready and migrations are complete
  3. The `/audit` dashboard page displays token usage and cost aggregated by channel and operation type, drawn from the existing `aiAuditLog` table
  4. A Helm chart exists in `deploy/helm/` with templates for web, daemon, and CronJob resources, enabling deployment to k3s
  5. A `docs/k3s-deployment.md` guide walks through deploying to k3s from scratch
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Cleanup & Foundation | 4/4 | Complete   | 2026-02-27 |
| 2. Pluggable Provider System | 4/4 | Complete   | 2026-02-28 |
| 3. Authentication & UI Polish | 0/TBD | Not started | - |
| 4. Deployment & Observability | 0/TBD | Not started | - |
