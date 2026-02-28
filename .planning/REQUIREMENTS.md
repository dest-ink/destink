# Requirements: Orbitl

**Defined:** 2026-02-27
**Core Value:** Automated, high-quality content that sounds like the creator wrote it — from research to published post, hands-off except for final approval.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Cleanup & Foundation

- [x] **CLEAN-01**: Job scripts close DB connection pool before process.exit (pg Pool leak fix)
- [x] **CLEAN-02**: Stuck queue items in `publishing` status are recovered on daemon restart
- [x] **CLEAN-03**: Daemon handles SIGTERM for graceful shutdown in containerized environments
- [x] **CLEAN-04**: Publish job documents `concurrencyPolicy: Forbid` requirement
- [x] **CLEAN-05**: Daily summary job implemented (`src/jobs/daily-summary.ts` + npm script)
- [x] **CLEAN-06**: Queue runner has test coverage (`tests/lib/publishing/queue-runner.test.ts`)

### Pluggable Publishers

- [x] **PUB-01**: Publisher provider interface defined with TypeScript contract
- [ ] **PUB-02**: Publisher registry with Map-based lookup by platform key
- [ ] **PUB-03**: Auto-discovery of `*.provider.ts` files in publishers directory
- [ ] **PUB-04**: Substack publisher refactored to provider module (reference implementation)
- [ ] **PUB-05**: LinkedIn publisher refactored to provider module (reference implementation)
- [ ] **PUB-06**: Runtime interface validation at startup (reject malformed providers)
- [x] **PUB-07**: PROVIDER_API_VERSION constant for compatibility gating

### Pluggable Research Adapters

- [x] **RES-01**: Research adapter interface defined with TypeScript contract
- [ ] **RES-02**: Research adapter registry with fan-out dispatch (all adapters run in parallel)
- [ ] **RES-03**: Auto-discovery of `*.adapter.ts` files in research adapters directory
- [ ] **RES-04**: Exa adapter refactored to pluggable module
- [ ] **RES-05**: Reddit adapter refactored to pluggable module
- [ ] **RES-06**: Substack research adapter refactored to pluggable module

### Authentication

- [ ] **AUTH-01**: User can log in with email and password
- [ ] **AUTH-02**: User session persists across browser refresh
- [ ] **AUTH-03**: Unauthenticated requests to API routes are rejected
- [ ] **AUTH-04**: User can log out from any page

### UI Polish

- [ ] **UI-01**: Distinctive, polished visual design applied across all pages (frontend-design skill)
- [ ] **UI-02**: Empty states with clear next-step calls to action on all list views
- [ ] **UI-03**: Skeleton loading on async operations (research, generation, publishing)
- [ ] **UI-04**: Actionable, platform-specific error messages (not generic 500s)
- [ ] **UI-05**: Retry affordances on queue failures
- [ ] **UI-06**: Voice confidence score badges displayed on drafts
- [ ] **UI-07**: Headline option picker for draft generation
- [ ] **UI-08**: Research source attribution display on drafts
- [ ] **UI-09**: Per-channel cost data visible in channel dashboard

### Deployment

- [ ] **DEPLOY-01**: Dockerfile for web service (Next.js standalone output, Debian slim)
- [ ] **DEPLOY-02**: Dockerfile for daemon service
- [ ] **DEPLOY-03**: Docker Compose with PostgreSQL, migration service, web, daemon
- [ ] **DEPLOY-04**: Health checks (pg_isready for DB, liveness/readiness for services)
- [ ] **DEPLOY-05**: Helm chart (Chart.yaml, values.yaml, templates for web/daemon/CronJobs)
- [ ] **DEPLOY-06**: k3s deployment guide (`docs/k3s-deployment.md`)

### Observability

- [ ] **OBS-01**: AI usage/audit dashboard page (`/audit`) with token usage and cost aggregation
- [ ] **OBS-02**: Audit API route for dashboard data

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Providers

- **PROV-01**: Draft preview rendered in target platform style (provider `preview()` method)
- **PROV-02**: Platform-specific content format validation before publishing
- **PROV-03**: Provider marketplace / community registry

### Analytics

- **ANAL-01**: Post performance tracking (views, engagement per platform)
- **ANAL-02**: Content calendar visualization
- **ANAL-03**: Voice drift detection (compare generated content against persona over time)

### Infrastructure

- **INFRA-01**: Structured logging (pino) for production observability
- **INFRA-02**: Zod 4 upgrade when stable
- **INFRA-03**: Rate limiting on API routes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile app | Web-first, self-hosted tool |
| SaaS/multi-tenant | Open source, self-hosted only |
| Payment/billing | Free and open source |
| Real-time collaboration | Solo creator tool |
| Social media analytics | Publishing only, not analytics |
| Auto-publish without review | Contradicts approval-centric design |
| Built-in image generation | Scope explosion, use external tools |
| Comment management | Publishing only, not engagement |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 | Phase 1 | Complete |
| CLEAN-02 | Phase 1 | Complete |
| CLEAN-03 | Phase 1 | Complete |
| CLEAN-04 | Phase 1 | Complete |
| CLEAN-05 | Phase 1 | Complete |
| CLEAN-06 | Phase 1 | Complete |
| PUB-01 | Phase 2 | Complete |
| PUB-02 | Phase 2 | Pending |
| PUB-03 | Phase 2 | Pending |
| PUB-04 | Phase 2 | Pending |
| PUB-05 | Phase 2 | Pending |
| PUB-06 | Phase 2 | Pending |
| PUB-07 | Phase 2 | Complete |
| RES-01 | Phase 2 | Complete |
| RES-02 | Phase 2 | Pending |
| RES-03 | Phase 2 | Pending |
| RES-04 | Phase 2 | Pending |
| RES-05 | Phase 2 | Pending |
| RES-06 | Phase 2 | Pending |
| AUTH-01 | Phase 3 | Pending |
| AUTH-02 | Phase 3 | Pending |
| AUTH-03 | Phase 3 | Pending |
| AUTH-04 | Phase 3 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| UI-05 | Phase 3 | Pending |
| UI-06 | Phase 3 | Pending |
| UI-07 | Phase 3 | Pending |
| UI-08 | Phase 3 | Pending |
| UI-09 | Phase 3 | Pending |
| DEPLOY-01 | Phase 4 | Pending |
| DEPLOY-02 | Phase 4 | Pending |
| DEPLOY-03 | Phase 4 | Pending |
| DEPLOY-04 | Phase 4 | Pending |
| DEPLOY-05 | Phase 4 | Pending |
| DEPLOY-06 | Phase 4 | Pending |
| OBS-01 | Phase 4 | Pending |
| OBS-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 after roadmap creation — all 40 requirements mapped*
