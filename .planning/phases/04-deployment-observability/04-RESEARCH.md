# Phase 4: Deployment & Observability - Research

**Researched:** 2026-02-28
**Domain:** Docker Compose, Helm/k3s, Next.js standalone output, Drizzle migrations in containers, audit dashboard (Next.js server components + Drizzle aggregations)
**Confidence:** HIGH (Docker/Helm patterns well-documented; all project-specific code verified against source)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Audit Dashboard:** Summary cards at top (total cost, total tokens, total calls) with detailed table below
- **Audit Dashboard:** Dual breakdown: by channel AND by operation type as two views/tabs
- **Audit Dashboard:** Static server-rendered page (Next.js server component) — no WebSockets or polling, just refresh to update
- **Audit Dashboard:** Data sourced from existing `aiAuditLog` table which already tracks model, tokens, cost, channelId, operation

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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPLOY-01 | Dockerfile for web service (Next.js standalone output, Debian slim) | Standalone output config in next.config.ts; multi-stage Dockerfile pattern from official Next.js docs |
| DEPLOY-02 | Dockerfile for daemon service | Existing Dockerfile.daemon reviewed; needs `tsx` compile step, `SIGTERM` is already handled |
| DEPLOY-03 | Docker Compose with PostgreSQL, migration service, web, daemon | `service_completed_successfully` pattern for migration service; existing docker-compose.yml as base |
| DEPLOY-04 | Health checks (pg_isready for DB, liveness/readiness for services) | DB already has `pg_isready` healthcheck; Next.js needs `/api/health` route + Docker `HEALTHCHECK` |
| DEPLOY-05 | Helm chart (Chart.yaml, values.yaml, templates for web/daemon/CronJobs) | Helm hook pattern for pre-install/pre-upgrade migration Job; CronJob template for publish/research/daily-summary |
| DEPLOY-06 | k3s deployment guide (docs/k3s-deployment.md) | k3s + Traefik (built-in) + cert-manager; provider-agnostic guide |
| OBS-01 | AI usage/audit dashboard page (/audit) with token usage and cost aggregation | Existing page stub; Drizzle groupBy aggregation pattern; Tabs + Card + Table via existing shadcn/ui components |
| OBS-02 | Audit API route for dashboard data | Follows established `auth()` wrapper pattern in `/api/`; returns channel and operation breakdowns |
</phase_requirements>

---

## Summary

Phase 4 is a deployment and observability polish phase. The bulk of the infrastructure already exists: three Dockerfiles, a working docker-compose.yml with a PostgreSQL health check, and three Drizzle migration files ready to apply. The gaps are: (1) the web Dockerfile does not use Next.js standalone output, (2) docker-compose.yml has no migration service — web and daemon start before migrations run, (3) web and daemon have no health checks beyond the DB, (4) no Helm chart exists in `deploy/helm/`, (5) no k3s guide exists, and (6) the `/audit` page is a stub.

The audit dashboard is the most code-intensive task but the lowest technical risk: the `aiAuditLog` table is already instrumented, the `coalesce(sum(...))` aggregation pattern is proven in `channels/[id]/page.tsx`, and `Tabs` + `Card` components already exist in the UI library. Two Drizzle `groupBy` queries (one by `channelId`, one by `operation`) feed a server component directly.

The Helm chart and k3s guide are the highest-effort new assets. The recommended approach is a minimal-viable Helm chart with: `web` Deployment, `daemon` Deployment, optional `postgresql` sub-chart toggle, a migration pre-install/pre-upgrade Job hook, and one CronJob per job type. The k3s guide should assume k3s is already installed (not zero-to-cluster) and cover: secrets, `kubectl apply`, `helm install`, and TLS via cert-manager + Let's Encrypt.

**Primary recommendation:** Fix Docker Compose first (standalone output + migration service + health checks), then build the Helm chart, then write the k3s guide, then implement the audit dashboard — in that order, as the Docker work unblocks everything else.

---

## Standard Stack

### Core (no new dependencies needed)
| Tool/Library | Version | Purpose | Why Standard |
|---|---|---|---|
| Next.js standalone output | `output: 'standalone'` in next.config.ts | Minimal production Docker image | Official Next.js pattern; copies only required files from `.next/standalone` |
| `npx drizzle-kit migrate` | drizzle-kit ^0.31.9 (already installed) | Run migrations in Docker | Already used in dev via `npm run db:migrate`; reads `drizzle.config.ts` |
| Docker Compose `service_completed_successfully` | Compose 2.17.0+ | Gate web/daemon on migration success | Official condition type; replaces fragile `wait-for-it.sh` scripts |
| Helm 3 | 3.x | Kubernetes package manager | Standard for k3s chart deployment; k3s ships with Helm Controller |
| Traefik Ingress | Built into k3s | HTTP routing + TLS termination | k3s includes Traefik by default; no additional install |
| cert-manager | 1.17.0+ | Automatic Let's Encrypt TLS | Standard for k3s TLS; Traefik alone loses certs on pod restart |
| Drizzle `groupBy` + `sql` | drizzle-orm ^0.45.1 (already installed) | Audit dashboard aggregation | Established pattern — already used in channels/[id]/page.tsx |
| Radix UI `@radix-ui/react-tabs` | ^1.1.13 (already installed) | Channel vs operation tab switching | Already in package.json and src/components/ui/tabs.tsx |

### No New npm Packages Required
The audit dashboard uses only existing dependencies: drizzle-orm, @radix-ui/react-tabs, shadcn/ui Card, Tailwind. No new installs needed for any Phase 4 work.

### For Helm chart (no npm — just YAML files)
The Helm chart is created as YAML templates in `deploy/helm/orbitl/`. No Node.js dependencies involved.

---

## Architecture Patterns

### Recommended File Structure for Phase 4

```
deploy/
└── helm/
    └── orbitl/
        ├── Chart.yaml
        ├── values.yaml
        └── templates/
            ├── _helpers.tpl
            ├── web-deployment.yaml
            ├── web-service.yaml
            ├── daemon-deployment.yaml
            ├── migrate-job.yaml          # pre-install,pre-upgrade hook
            ├── cronjob-publish.yaml
            ├── cronjob-research.yaml
            ├── cronjob-daily-summary.yaml
            ├── ingress.yaml
            └── secret.yaml
docs/
└── k3s-deployment.md
src/
└── app/
    ├── api/
    │   └── audit/
    │       └── route.ts                 # OBS-02: GET /api/audit?view=channel|operation
    └── (app)/
        └── audit/
            ├── page.tsx                 # OBS-01: replace stub with server component
            └── loading.tsx              # already exists
```

### Pattern 1: Docker Compose Migration Service (Claude's Discretion — RECOMMENDED)

**What:** Dedicated `migrate` service that runs `npx drizzle-kit migrate` and exits 0. Web and daemon depend on it with `condition: service_completed_successfully`.

**Why this over entrypoint script:** Cleaner separation of concerns; compose logs migrations separately; idempotent (`drizzle-kit migrate` is a no-op if already migrated); restarts independently.

**Example:**
```yaml
# docker-compose.yml addition
services:
  migrate:
    build:
      context: .
      dockerfile: docker/Dockerfile.web   # same image has drizzle-kit
    command: npx drizzle-kit migrate
    env_file:
      - path: .env
        required: false
    environment:
      DATABASE_URL: postgresql://orbitl:orbitl@postgres:5432/orbitl
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"

  web:
    depends_on:
      postgres:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully

  daemon:
    depends_on:
      postgres:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
```

**Source:** https://docs.docker.com/compose/how-tos/startup-order/ — official Docker Compose startup order docs.

### Pattern 2: Next.js Standalone Output Dockerfile

**What:** Add `output: 'standalone'` to `next.config.ts`, then copy from `.next/standalone` in the runner stage. Use `node server.js` as CMD, not `npm start`. Required for DEPLOY-01.

**Current problem:** `Dockerfile.web` copies from `.next` (full output), not `.next/standalone`. No `output: 'standalone'` in `next.config.ts`. This creates a bloated image and doesn't follow the official recommended production pattern.

**Example:**
```dockerfile
# docker/Dockerfile.web — corrected
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Copy standalone output (minimal, no full node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3021
ENV PORT=3021
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
```

**Source:** https://nextjs.org/docs/app/getting-started/deploying — official Next.js deployment docs (updated 2026-02-27).

**Critical:** `next.config.ts` must add `output: 'standalone'` or the `.next/standalone` directory won't be generated.

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: 'standalone',     // ADD THIS
  webpack: (config, { dev }) => { ... },
};
```

### Pattern 3: Docker Health Checks for Web and Daemon Services

**What:** Add `HEALTHCHECK` instruction to Dockerfiles AND a `/api/health` route in Next.js. Daemon health check is a process-alive check.

**Why:** DEPLOY-04 requires liveness/readiness for services (DB already has `pg_isready`).

**Next.js health endpoint:**
```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
```

**Dockerfile.web health check (added to runner stage):**
```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3021/api/health || exit 1
```

**docker-compose.yml web service addition:**
```yaml
web:
  healthcheck:
    test: ["CMD-SHELL", "wget -qO- http://localhost:3021/api/health || exit 1"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 30s
```

**Daemon health check** — daemon is a long-running Node process with no HTTP server. Use a file-based liveness touch pattern or simply rely on Docker's `restart: unless-stopped` policy. The daemon already handles SIGTERM (CLEAN-03 complete). For Compose, no healthcheck is needed beyond depends_on migration completion.

**Source:** Verified against Next.js self-hosting guide; standard Alpine wget pattern.

### Pattern 4: Helm Chart — Migration via Pre-Install Hook

**What:** A Kubernetes Job with `helm.sh/hook: pre-install,pre-upgrade` annotation runs `npx drizzle-kit migrate` before any Deployment is created. Helm blocks until the Job completes successfully.

**Why:** Ensures DB schema is applied before web and daemon pods start — same guarantee as Docker Compose's `service_completed_successfully`.

**Example: `deploy/helm/orbitl/templates/migrate-job.yaml`**
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: "{{ .Release.Name }}-db-migrate"
  labels:
    {{- include "orbitl.labels" . | nindent 4 }}
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: "{{ .Values.web.image.repository }}:{{ .Values.web.image.tag }}"
          command: ["npx", "drizzle-kit", "migrate"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: "{{ .Release.Name }}-secret"
                  key: DATABASE_URL
```

**Source:** https://helm.sh/docs/topics/charts_hooks/ — official Helm hooks documentation.

### Pattern 5: Helm Chart — CronJob for Scheduled Jobs

**What:** One Kubernetes CronJob per job type (publish, research, daily-summary). `concurrencyPolicy: Forbid` matches existing behavior documented in CLEAN-04.

**Claude's Discretion — RECOMMENDATION:** Keep `node-cron` inside daemon for Docker Compose deployments (no change to daemon). For Helm/k3s, add Kubernetes CronJobs that invoke the same job scripts in separate containers using `Dockerfile.jobs`. This avoids dual scheduling when running in k8s.

**Example: `deploy/helm/orbitl/templates/cronjob-publish.yaml`**
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: "{{ .Release.Name }}-publish"
  labels:
    {{- include "orbitl.labels" . | nindent 4 }}
spec:
  schedule: "{{ .Values.cronJobs.publish.schedule }}"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: publish
              image: "{{ .Values.jobs.image.repository }}:{{ .Values.jobs.image.tag }}"
              command: ["npx", "tsx", "src/jobs/publish.ts"]
              envFrom:
                - secretRef:
                    name: "{{ .Release.Name }}-secret"
```

**Source:** https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/ — Kubernetes official docs.

### Pattern 6: Audit Dashboard — Two Drizzle GroupBy Queries

**What:** Server component fetches two aggregated result sets from `aiAuditLog`. One groups by `channelId`, one groups by `operation`. Summary cards compute totals across all rows (a third aggregate query or computed from the grouped results).

**The established pattern** (from `src/app/(app)/channels/[id]/page.tsx`):
```typescript
// coalesce + sum for numeric columns; cast count to number
const [costResult] = await db
  .select({
    totalCost: sql<string>`coalesce(sum(${aiAuditLog.costUsd}), '0')`,
    totalPromptTokens: sql<number>`coalesce(sum(${aiAuditLog.promptTokens}), 0)`,
    totalCompletionTokens: sql<number>`coalesce(sum(${aiAuditLog.completionTokens}), 0)`,
    operationCount: sql<number>`count(*)`,
  })
  .from(aiAuditLog)
  .where(eq(aiAuditLog.channelId, id));
```

**Audit dashboard — by channel groupBy query:**
```typescript
// src/app/api/audit/route.ts or inline in page.tsx
import { db } from '@/db/client';
import { aiAuditLog, channels } from '@/db/schema';
import { sql } from 'drizzle-orm';

const byChannel = await db
  .select({
    channelId: aiAuditLog.channelId,
    totalCost: sql<string>`coalesce(sum(${aiAuditLog.costUsd}), '0')`,
    totalTokens: sql<number>`coalesce(sum(${aiAuditLog.promptTokens} + ${aiAuditLog.completionTokens}), 0)`,
    callCount: sql<number>`cast(count(*) as int)`,
  })
  .from(aiAuditLog)
  .groupBy(aiAuditLog.channelId)
  .orderBy(sql`sum(${aiAuditLog.costUsd}) desc nulls last`);

const byOperation = await db
  .select({
    operation: aiAuditLog.operation,
    totalCost: sql<string>`coalesce(sum(${aiAuditLog.costUsd}), '0')`,
    totalTokens: sql<number>`coalesce(sum(${aiAuditLog.promptTokens} + ${aiAuditLog.completionTokens}), 0)`,
    callCount: sql<number>`cast(count(*) as int)`,
  })
  .from(aiAuditLog)
  .groupBy(aiAuditLog.operation)
  .orderBy(sql`sum(${aiAuditLog.costUsd}) desc nulls last`);
```

**Source:** https://orm.drizzle.team/docs/select — Drizzle ORM official docs; confirmed against working pattern in channels/[id]/page.tsx.

**Key nuance:** `costUsd` is a Postgres `numeric` column. Drizzle returns it as a `string`. Must parse with `parseFloat()` — same as the channel cost summary. `promptTokens`/`completionTokens` are `integer` but Postgres `count(*)` returns `bigint`; cast to int or use `Number()`.

### Pattern 7: Audit Page — Tabs Architecture

**What:** The `/audit` page uses the existing `Tabs` component (already `"use client"` — `@radix-ui/react-tabs`). The server component fetches both datasets, passes them as props to a client shell, which renders two tabs.

**Tabs component is already installed:** `src/components/ui/tabs.tsx` wraps `@radix-ui/react-tabs` with `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`.

**Preferred architecture (matches existing pattern in `DraftsClientShell`):**
```typescript
// src/app/(app)/audit/page.tsx — server component
export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const [summary, byChannel, byOperation] = await Promise.all([
    fetchAuditSummary(),
    fetchAuditByChannel(),
    fetchAuditByOperation(),
  ]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">AI Usage</h1>
      <AuditSummaryCards summary={summary} />
      <AuditTabs byChannel={byChannel} byOperation={byOperation} />
    </div>
  );
}
```

`AuditTabs` is a `"use client"` component that wraps `Tabs` with the two breakdown tables.

**Source:** Pattern verified against `src/app/(app)/drafts/page.tsx` + `DraftsClientShell.tsx` server/client split pattern.

### Pattern 8: Helm Chart values.yaml — PostgreSQL Toggle

**What:** `postgresql.enabled: true` deploys a bundled PostgreSQL StatefulSet (or Bitnami sub-chart). When `false`, `externalDatabase.url` is used instead. The migration Job always reads `DATABASE_URL` from the secret.

**Recommended minimal values.yaml:**
```yaml
web:
  image:
    repository: orbitl-web
    tag: latest
  replicas: 1
  port: 3021

daemon:
  image:
    repository: orbitl-daemon
    tag: latest
  replicas: 1

jobs:
  image:
    repository: orbitl-jobs
    tag: latest

cronJobs:
  publish:
    schedule: "*/5 * * * *"
    enabled: true
  research:
    schedule: "0 2 * * *"
    enabled: true
  dailySummary:
    schedule: "0 8 * * *"
    enabled: true

postgresql:
  enabled: true          # false = use externalDatabase
  image: postgres:17-alpine
  storageSize: 5Gi

externalDatabase:
  url: ""               # set when postgresql.enabled=false

env:
  ANTHROPIC_API_KEY: ""
  ENCRYPTION_KEY: ""
  EXA_API_KEY: ""
  # ... other secrets
```

**Source:** Pattern verified against Bitnami chart conventions and official Helm docs.

### Pattern 9: k3s Deployment Guide Scope

**Claude's Discretion — RECOMMENDATION:**
- **Assumed knowledge:** k3s is already running on a single node (guide starts from `kubectl cluster-info` working)
- **TLS:** Include cert-manager + Let's Encrypt via Traefik IngressRoute (standard k3s stack)
- **Backup/restore:** Omit (out of scope for MVP guide)
- **Provider:** Provider-agnostic (a VPS with public IP is the assumed context)
- **Structure:**
  1. Prerequisites (k3s running, `helm` installed, Docker image registry access)
  2. Build and push images (or load locally with `k3s ctr images import`)
  3. Create namespace and secret
  4. `helm install` with values override
  5. Verify deployment (kubectl rollout status)
  6. Configure TLS with cert-manager

### Anti-Patterns to Avoid

- **Don't run `drizzle-kit generate` in Docker** — `generate` creates new migration files, `migrate` applies existing ones. Production containers should only call `migrate`.
- **Don't copy `.next/` directly without standalone mode** — produces images 400MB+ with all `node_modules`. With standalone, the runner stage is ~150MB.
- **Don't use `latest` tag in Helm chart default values** — best practice is pinned tags. The `values.yaml` defaults can use `latest` for dev but the guide should show explicit tag overrides.
- **Don't put secrets in `values.yaml` committed to git** — the k3s guide must show creating a `kubectl create secret generic` before `helm install` and using `secretKeyRef` references.
- **Don't poll `/audit` on a timer** — the user's decision is static server-rendered with manual refresh. `export const dynamic = 'force-dynamic'` on the page ensures each request gets fresh data.
- **Don't use `npm start` as CMD in standalone Dockerfile** — standalone output uses `node server.js`, not `npm start`. `npm start` calls `next start` which expects a full `.next/` directory.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wait for DB before migrations | Custom `wait-for-it.sh` | `depends_on: condition: service_healthy` | Official Compose feature; healthcheck already configured on postgres |
| Wait for migrations before app | Custom sleep loop | `depends_on: condition: service_completed_successfully` | Official Compose feature since v2.17; zero-exit-code guarantee |
| DB schema migration in k8s | Init container with manual SQL | Helm pre-install/pre-upgrade Job hook | Helm blocks release until Job completes; built-in retry via `backoffLimit` |
| Scheduling in k8s | Keep node-cron in daemon | Kubernetes CronJob | k8s CronJobs are auditable, have history, support `Forbid` concurrencyPolicy natively |
| Dashboard aggregation queries | Custom SQL strings | Drizzle `sql<T>` template tag + `groupBy` | Type-safe, injection-safe, same pattern already proven in channels/[id]/page.tsx |
| Tab switching in audit UI | Custom CSS show/hide | `@radix-ui/react-tabs` (already installed) | Accessible keyboard navigation, already in `src/components/ui/tabs.tsx` |
| TLS in k3s | Manual certificate files | cert-manager + Let's Encrypt via Traefik | Auto-renewal, stored in k8s Secrets (not Traefik pod filesystem) |

**Key insight:** Every "don't hand-roll" item here is solved by official tooling already present in the project (Compose, Helm, Drizzle, Radix UI). Phase 4 is integration work, not library selection.

---

## Common Pitfalls

### Pitfall 1: Standalone Output Not Configured in next.config.ts
**What goes wrong:** `docker/Dockerfile.web` runner stage copies from `.next/standalone` but that directory doesn't exist because `output: 'standalone'` is not set in `next.config.ts`. Build succeeds but the standalone directory is empty.
**Why it happens:** The current `next.config.ts` has no `output` key. The current Dockerfile copies from `.next` (not `.next/standalone`), so it "works" without standalone mode.
**How to avoid:** Add `output: 'standalone'` to `next.config.ts` FIRST, then update the Dockerfile SECOND. Both changes must land together.
**Warning signs:** After Dockerfile update, `node server.js` fails with "Cannot find module" — means standalone wasn't generated.

### Pitfall 2: .env File Name Mismatch
**What goes wrong:** `docker-compose.yml` references `.env.local` as the env file (current state), but a fresh clone with only a `.env` file (as documented in `.env.example`) causes env_file to silently skip and all API keys are missing.
**Why it happens:** Current compose uses `path: .env.local, required: false` which is a dev convenience. For self-hosting, the convention should be `.env` with `required: false` fallback.
**How to avoid:** Update compose to reference `.env` (not `.env.local`) as the primary env_file. The self-hosting docs should say "copy `.env.example` to `.env` and populate."
**Warning signs:** Services start but API calls fail with auth errors.

### Pitfall 3: Migration Job Races with PostgreSQL
**What goes wrong:** The migrate service starts, PostgreSQL container is running but not yet accepting connections (still in startup), `drizzle-kit migrate` fails, migrate service exits non-zero, web never starts.
**Why it happens:** `service_healthy` on postgres is required. If migration service only depends on `service_started` (not `service_healthy`), it may race.
**How to avoid:** Migration service must declare `depends_on: postgres: condition: service_healthy`. The postgres service already has a `pg_isready` healthcheck.
**Warning signs:** `docker compose up` shows migrate container exiting immediately with error about connection refused.

### Pitfall 4: Next.js Health Check Fails Due to Bind Address
**What goes wrong:** Kubernetes readiness probe sends request to pod IP but `node server.js` binds to `127.0.0.1` (localhost). Health check times out, pod is removed from service endpoints, traffic stops.
**Why it happens:** Next.js standalone server default bind address is localhost in some configurations.
**How to avoid:** Set `ENV HOSTNAME=0.0.0.0` in Dockerfile before `CMD ["node", "server.js"]`. Verified by Next.js community discussion.
**Warning signs:** Pod shows `Running` but readiness probe fails; curl from within pod works but from outside doesn't.

### Pitfall 5: Helm Hook Job Not Cleaned Up
**What goes wrong:** On second `helm upgrade`, old Job from pre-install hook still exists. Helm creates a new Job with same name — conflicts if delete policy not set.
**Why it happens:** Default Helm behavior doesn't delete Jobs from previous hook runs.
**How to avoid:** Use `"helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded` on the migration Job annotation.
**Warning signs:** `helm upgrade` fails with "Job already exists" error.

### Pitfall 6: costUsd Returns String, Not Number
**What goes wrong:** Dashboard shows `NaN` or `"0.0000"` string instead of formatted number.
**Why it happens:** Drizzle returns Postgres `numeric` columns as JavaScript strings. `sum()` of numeric is also a string. Must `parseFloat()`.
**How to avoid:** Mirror the established pattern in `channels/[id]/page.tsx`: `parseFloat(result.totalCost)`. Already documented in STATE.md decisions.
**Warning signs:** `typeof costResult.totalCost === 'string'`; direct arithmetic produces NaN.

### Pitfall 7: Audit Page Misses `export const dynamic = 'force-dynamic'`
**What goes wrong:** Next.js caches the server component render indefinitely (static generation). Audit dashboard shows stale data even after new AI calls.
**Why it happens:** Next.js App Router statically renders server components by default when no dynamic APIs (cookies, headers) are used.
**How to avoid:** Add `export const dynamic = 'force-dynamic';` at the top of `src/app/(app)/audit/page.tsx`. Same pattern as `channels/page.tsx` and `channels/[id]/page.tsx`.
**Warning signs:** Dashboard shows data that doesn't update between page refreshes.

---

## Code Examples

### Drizzle GroupBy Aggregation (Audit Dashboard)
```typescript
// Source: https://orm.drizzle.team/docs/select + existing pattern in channels/[id]/page.tsx
import { db } from '@/db/client';
import { aiAuditLog } from '@/db/schema';
import { sql } from 'drizzle-orm';

// Summary totals (no groupBy)
const [summary] = await db
  .select({
    totalCost: sql<string>`coalesce(sum(${aiAuditLog.costUsd}), '0')`,
    totalTokens: sql<number>`coalesce(sum(${aiAuditLog.promptTokens} + ${aiAuditLog.completionTokens}), 0)`,
    callCount: sql<number>`cast(count(*) as int)`,
  })
  .from(aiAuditLog);

// By operation type
const byOperation = await db
  .select({
    operation: aiAuditLog.operation,
    totalCost: sql<string>`coalesce(sum(${aiAuditLog.costUsd}), '0')`,
    totalTokens: sql<number>`coalesce(sum(${aiAuditLog.promptTokens} + ${aiAuditLog.completionTokens}), 0)`,
    callCount: sql<number>`cast(count(*) as int)`,
  })
  .from(aiAuditLog)
  .groupBy(aiAuditLog.operation)
  .orderBy(sql`sum(${aiAuditLog.costUsd}) desc nulls last`);

// By channel
const byChannel = await db
  .select({
    channelId: aiAuditLog.channelId,
    totalCost: sql<string>`coalesce(sum(${aiAuditLog.costUsd}), '0')`,
    totalTokens: sql<number>`coalesce(sum(${aiAuditLog.promptTokens} + ${aiAuditLog.completionTokens}), 0)`,
    callCount: sql<number>`cast(count(*) as int)`,
  })
  .from(aiAuditLog)
  .groupBy(aiAuditLog.channelId)
  .orderBy(sql`sum(${aiAuditLog.costUsd}) desc nulls last`);

// Parse results (costUsd is numeric → string in JS)
const totalCostUsd = parseFloat(summary.totalCost);
```

### Docker Compose Migration Service
```yaml
# Source: https://docs.docker.com/compose/how-tos/startup-order/
services:
  postgres:
    image: postgres:17-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orbitl"]
      interval: 5s
      timeout: 5s
      retries: 5

  migrate:
    build:
      context: .
      dockerfile: docker/Dockerfile.web
    command: npx drizzle-kit migrate
    environment:
      DATABASE_URL: postgresql://orbitl:orbitl@postgres:5432/orbitl
    env_file:
      - path: .env
        required: false
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"

  web:
    depends_on:
      postgres:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully

  daemon:
    depends_on:
      postgres:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
```

### Next.js Standalone Dockerfile (corrected)
```dockerfile
# Source: https://nextjs.org/docs/app/getting-started/deploying
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3021
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3021/api/health || exit 1
EXPOSE 3021
CMD ["node", "server.js"]
```

### Helm Chart.yaml (minimal viable)
```yaml
# deploy/helm/orbitl/Chart.yaml
apiVersion: v2
name: orbitl
description: Self-hosted AI content creation tool
type: application
version: 0.1.0
appVersion: "0.1.0"
```

### Kubernetes CronJob concurrencyPolicy (from Kubernetes docs)
```yaml
# Source: https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid   # matches CLEAN-04 requirement
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `wait-for-it.sh` entrypoint loops | `service_completed_successfully` condition | Compose v2.17 (2022) | No custom scripts; compose handles ordering natively |
| Full `node_modules` in Docker image | Next.js `output: 'standalone'` | Next.js 12.1 (2022) | Image size reduction ~60-70%; only required deps copied |
| `npm start` in production Docker | `node server.js` (standalone server) | Next.js 12.1 | Direct node invocation; no npm overhead |
| Manual certificate files in Traefik | cert-manager + Let's Encrypt | cert-manager v1.0 (2020), widely adopted 2022+ | Certs auto-renew; stored in k8s Secrets not Traefik filesystem |
| Helm v2 / Tiller | Helm v3 (no Tiller) | Helm 3.0 (2019) | Tiller is gone; all interaction is client-side |

**Still current (not deprecated):**
- `drizzle-kit migrate` is the correct production command (not `push`, not `generate`)
- `@radix-ui/react-tabs` is used as-is (no deprecation in Radix UI 1.x)
- k3s ships with Traefik as default Ingress (as of k3s v1.28+)

---

## Open Questions

1. **Daemon in k8s: keep node-cron or use Kubernetes CronJobs?**
   - What we know: Daemon runs node-cron for publish (every 5min), research (daily), daily-summary (daily). k8s CronJobs are the Kubernetes-native pattern. Running both would double-schedule.
   - What's unclear: Whether the user wants daemon to remain unchanged (Docker Compose compatible) and k8s CronJobs to replace it in Helm deployment.
   - Recommendation: In Helm chart, create CronJob resources for each job type AND set `daemon.cronEnabled: false` in values.yaml to disable node-cron when running in k8s. For Docker Compose, daemon keeps node-cron unchanged. This is the cleanest separation.

2. **channelId = null in audit aggregation (system-level AI calls)**
   - What we know: Some `aiAuditLog` rows have `channelId = null` (e.g., system-level brainstorm research not tied to a specific channel). The by-channel groupBy will include a `null` bucket.
   - What's unclear: Whether to display null-channel rows as "System / Unattributed" or filter them out.
   - Recommendation: Include them, label as "Unattributed" in the UI when `channelId` is null. Show channel name by joining with `channels` table or by displaying the ID truncated.

3. **Helm chart image registry**
   - What we know: The chart needs image references. For self-hosting, images must be built and accessible (registry or `k3s ctr images import`).
   - What's unclear: Whether the k3s guide should cover pushing to Docker Hub, a private registry, or just local import.
   - Recommendation: k3s guide covers local image import (`docker save | k3s ctr images import`) as the simplest path for single-node self-hosting; mention Docker Hub as an alternative.

---

## Sources

### Primary (HIGH confidence)
- https://nextjs.org/docs/app/getting-started/deploying — Next.js deployment guide (updated 2026-02-27); standalone output, Docker patterns
- https://nextjs.org/docs/app/guides/self-hosting — Next.js self-hosting guide; HOSTNAME=0.0.0.0 requirement, ENV variables
- https://docs.docker.com/compose/how-tos/startup-order/ — Official Docker Compose startup order; `service_completed_successfully` condition
- https://helm.sh/docs/topics/charts_hooks/ — Official Helm hooks docs; pre-install/pre-upgrade Job pattern
- https://orm.drizzle.team/docs/select — Drizzle ORM docs; groupBy and aggregation functions
- https://orm.drizzle.team/docs/drizzle-kit-migrate — drizzle-kit migrate command reference
- https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/ — Kubernetes CronJob spec; `concurrencyPolicy: Forbid`
- Project source code (`docker-compose.yml`, `docker/Dockerfile.*`, `src/db/schema.ts`, `src/lib/ai/audit.ts`, `src/app/(app)/channels/[id]/page.tsx`) — verified against actual codebase

### Secondary (MEDIUM confidence)
- https://k3s.rocks/https-cert-manager-letsencrypt/ — cert-manager + Let's Encrypt on k3s (verified by multiple sources)
- https://docs.k3s.io/add-ons/helm — k3s Helm Controller docs
- WebSearch results for Helm CronJob best practices (cross-verified against Kubernetes official docs)

### Tertiary (LOW confidence — needs validation)
- Specific k3s Traefik IngressRoute YAML syntax (k3s versions vary; planner should verify against installed k3s version)
- Bitnami postgresql sub-chart integration in values.yaml (confirmed pattern but specific chart version may differ)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all existing project tools verified against source
- Docker Compose patterns: HIGH — official Docker docs + existing docker-compose.yml verified
- Helm chart patterns: MEDIUM-HIGH — official Helm docs + community patterns; specific k3s Traefik CRD syntax is LOW
- Audit dashboard: HIGH — Drizzle groupBy from official docs; UI components confirmed in codebase
- Pitfalls: HIGH — derived from actual code inspection (Pitfall 1-2 from reading current files; Pitfall 6 from STATE.md decisions)

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (stable ecosystem — Helm, Docker Compose, k3s patterns are slow-moving)
