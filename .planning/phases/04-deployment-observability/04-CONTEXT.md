# Phase 4: Deployment & Observability - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

A creator can self-host the complete Orbitl stack on a single machine with one command (`docker compose up`), deploy to k3s via Helm chart, and monitor AI usage and cost from a dashboard at `/audit`. Includes Docker Compose polish, Helm chart creation, k3s deployment guide, and audit dashboard implementation.

</domain>

<decisions>
## Implementation Decisions

### Audit Dashboard
- Summary cards at top (total cost, total tokens, total calls) with detailed table below
- Dual breakdown: by channel AND by operation type as two views/tabs
- Static server-rendered page (Next.js server component) — no WebSockets or polling, just refresh to update
- Data sourced from existing `aiAuditLog` table which already tracks model, tokens, cost, channelId, operation

### Claude's Discretion
- Migration strategy for Docker Compose (init service vs entrypoint script)
- Whether CronJob tasks run as separate containers or stay inside the daemon (current node-cron pattern)
- Secrets handling in Docker Compose (.env file approach expected, details flexible)
- Whether to include dev tooling (Drizzle Studio) via compose profiles
- Helm chart configurability level (minimal viable vs production-lite)
- Whether Helm chart bundles PostgreSQL or expects external DB (toggle via values.yaml encouraged)
- Helm chart secrets approach (plain values.yaml vs external secret ref)
- Migration handling in k8s (Job with helm hooks vs init container)
- k3s guide assumed knowledge level (zero to deployed vs k3s already running)
- TLS/HTTPS coverage in the guide (cert-manager vs HTTP only)
- Backup/restore inclusion in the guide
- Cloud provider targeting (provider-agnostic vs specific)
- Audit dashboard default time range
- Chart styling and visual design for the dashboard

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `aiAuditLog` table (`src/db/schema.ts:107`): Already tracks operation, model, promptTokens, completionTokens, costUsd, channelId, entityType, entityId, createdAt
- `src/lib/ai/audit.ts`: `logAiCall()` and `computeCost()` already handle audit logging with Anthropic pricing
- `/audit` page stub (`src/app/(app)/audit/page.tsx`): Placeholder exists, just needs real implementation
- `loading.tsx` exists for the audit route — Suspense-ready
- Existing UI components: Radix UI primitives, shadcn/ui patterns, Tailwind CSS, lucide-react icons

### Established Patterns
- Next.js server components for data fetching (no client-side state management needed)
- Drizzle ORM for all database queries with type-safe schema
- Tailwind CSS + shadcn/ui component library for all UI
- Console-based logging with context prefixes (`[daemon]`, `[queue-runner]`, etc.)
- `node-cron` for scheduled tasks inside daemon process

### Integration Points
- Docker Compose already exists (`docker-compose.yml`) with postgres, web, daemon services and health checks
- Three Dockerfiles exist: `docker/Dockerfile.web` (multi-stage), `docker/Dockerfile.daemon`, `docker/Dockerfile.jobs`
- `npm run db:migrate` runs Drizzle migrations
- Daemon entry point: `src/daemon/index.ts`
- Job runners: `src/jobs/publish.ts`, `src/jobs/research.ts`
- `.env.example` serves as template for required environment variables

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-deployment-observability*
*Context gathered: 2026-02-28*
