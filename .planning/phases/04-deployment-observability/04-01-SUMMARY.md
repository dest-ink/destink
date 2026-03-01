---
phase: 04-deployment-observability
plan: 01
subsystem: infra
tags: [docker, docker-compose, nextjs, standalone, drizzle, health-check]

# Dependency graph
requires:
  - phase: 03-authentication-ui-polish
    provides: Auth.js v5 setup (AUTH_SECRET needed in .env.example)
  - phase: 03.1-fix-cronjob-registry-initialization
    provides: Daemon entry point and bootstrap pattern (Dockerfile.daemon must include tsx devDep)
provides:
  - Docker Compose stack with zero-manual-step startup
  - Next.js standalone output image (minimal ~150MB production build)
  - Migration-gated service startup via migrate service
  - Health check endpoint at /api/health (unauthenticated)
  - Consistent .env convention across all services
affects: [04-02, 04-03, helm-chart]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Multi-stage Next.js standalone Dockerfile (deps -> builder -> runner)
    - Compose service_completed_successfully for migration gating
    - Compose service_healthy for postgres gating
    - Unauthenticated /api/health route for Docker/k8s probes

key-files:
  created:
    - src/app/api/health/route.ts
  modified:
    - next.config.ts
    - docker/Dockerfile.web
    - docker/Dockerfile.daemon
    - docker-compose.yml
    - .env.example

key-decisions:
  - "Migrate service uses Dockerfile.jobs (full npm ci) not Dockerfile.web (standalone strips modules) — simpler and guaranteed drizzle-kit access"
  - "Dockerfile.web still includes drizzle-kit/drizzle-orm copies for potential migrate service reuse — belt-and-suspenders approach"
  - "No middleware.ts exists at Next.js root — /api/health is unauthenticated by default without exclusion rules needed"
  - "AUTH_SECRET added to .env.example — required by Auth.js v5, was missing from example file"

patterns-established:
  - "service_completed_successfully: migrate service gates web and daemon to prevent startup before schema is ready"
  - "All compose services use .env (not .env.local) — production convention, local dev convention aligns"
  - "node server.js for standalone Next.js — not npm start which requires package.json and non-standalone node_modules"

requirements-completed: [DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04]

# Metrics
duration: 8min
completed: 2026-03-01
---

# Phase 4 Plan 01: Docker Compose Self-Hosting Foundation Summary

**Next.js standalone output, migration-gated compose stack, and unauthenticated /api/health endpoint enabling zero-step `docker compose up` from a fresh clone**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-01T02:36:28Z
- **Completed:** 2026-03-01T02:44:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `next.config.ts` outputs standalone build — web image drops from ~400MB to ~150MB
- Migration service gates web and daemon startup via `service_completed_successfully` — schema always ready before app starts
- `/api/health` endpoint added, unauthenticated, used by Docker HEALTHCHECK and compose healthcheck probe
- All compose services switched from `.env.local` to `.env` for consistent production and self-hosting convention
- `AUTH_SECRET` added to `.env.example` with generation instructions

## Task Commits

Each task was committed atomically:

1. **Task 1: Next.js standalone output, Dockerfiles, and health endpoint** - `7c85a6a` (feat)
2. **Task 2: Docker Compose migration service, health checks, and env convention** - `490f253` (feat)

**Plan metadata:** (docs commit — see final_commit)

## Files Created/Modified

- `next.config.ts` - Added `output: 'standalone'` to minimize production image size
- `docker/Dockerfile.web` - Full rewrite: multi-stage standalone build, node server.js CMD, HEALTHCHECK, drizzle artifacts copied
- `docker/Dockerfile.daemon` - Removed `--omit=dev` from npm ci so tsx devDependency is available
- `src/app/api/health/route.ts` - New: GET handler returning `{status: 'ok'}`, unauthenticated
- `docker-compose.yml` - Added migrate service, service_completed_successfully gates, web healthcheck, .env convention
- `.env.example` - Added header comment and AUTH_SECRET variable

## Decisions Made

- **Migrate service image choice:** Used `Dockerfile.jobs` (full `npm ci`, copies all source) rather than reusing `Dockerfile.web` (standalone output strips unused modules). Dockerfile.jobs has guaranteed access to drizzle-kit and drizzle.config.ts without cherry-picking.
- **No middleware exclusion needed:** Next.js project has no `middleware.ts` file — /api/health is unauthenticated by default. Individual API routes use explicit `auth()` wrappers, not global middleware.
- **AUTH_SECRET in .env.example:** Was missing from the example file despite Auth.js v5 requiring it. Added with generation instructions (`openssl rand -base64 33`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `docker compose config` validated without errors on first attempt.

## User Setup Required

None - no external service configuration required. Existing `.env` / `.env.local` files have all needed variables.

## Next Phase Readiness

- Docker Compose stack is production-ready for self-hosting
- `docker compose up` will: start postgres, run migrations, then start web and daemon
- Foundation ready for Phase 4 Plan 02 (Helm chart) and Plan 03 (observability)

---
*Phase: 04-deployment-observability*
*Completed: 2026-03-01*
