---
phase: 04-deployment-observability
plan: 03
subsystem: infra
tags: [helm, kubernetes, k3s, docker, postgresql, cronjob, deployment]

# Dependency graph
requires:
  - phase: 04-deployment-observability
    provides: Docker images (web, daemon, jobs) and job scripts (publish, research, daily-summary)
provides:
  - Helm chart at deploy/helm/orbitl/ for deploying full Orbitl stack to k3s
  - Pre-install/pre-upgrade migration Job hook running drizzle-kit migrate
  - Web Deployment with /api/health readiness and liveness probes
  - Daemon Deployment with envFrom secret injection
  - Three CronJobs (publish/research/daily-summary) with concurrencyPolicy Forbid
  - Kubernetes Secret template containing all env vars including DATABASE_URL
  - Conditional Ingress with Traefik and optional cert-manager TLS
  - values.yaml toggle between bundled PostgreSQL and external database
affects: [04-04-k3s-deployment-guide]

# Tech tracking
tech-stack:
  added: [helm-chart]
  patterns: [helm-hooks, secretRef-envFrom, secretKeyRef-for-specific-vars, databaseUrl-helper, conditional-resource-rendering]

key-files:
  created:
    - deploy/helm/orbitl/Chart.yaml
    - deploy/helm/orbitl/values.yaml
    - deploy/helm/orbitl/templates/_helpers.tpl
    - deploy/helm/orbitl/templates/secret.yaml
    - deploy/helm/orbitl/templates/web-deployment.yaml
    - deploy/helm/orbitl/templates/web-service.yaml
    - deploy/helm/orbitl/templates/daemon-deployment.yaml
    - deploy/helm/orbitl/templates/migrate-job.yaml
    - deploy/helm/orbitl/templates/cronjob-publish.yaml
    - deploy/helm/orbitl/templates/cronjob-research.yaml
    - deploy/helm/orbitl/templates/cronjob-daily-summary.yaml
    - deploy/helm/orbitl/templates/ingress.yaml
  modified: []

key-decisions:
  - "Migration Job uses web image (not jobs image) — web image contains drizzle-kit and migration files; keeps migrate-job.yaml simple with command override"
  - "orbitl.databaseUrl helper in _helpers.tpl — single source of truth for connection string whether using bundled or external postgres"
  - "Ingress uses ingressClassName: traefik (k3s default) — not nginx, aligned with k3s standard deployment"
  - "Daemon has no readiness/liveness probe — daemon is a process-based service, rely on Kubernetes restart policy rather than HTTP health checks"
  - "All env vars in single Opaque Secret with envFrom secretRef (except DATABASE_URL in migrate Job which uses secretKeyRef) — consistent injection, minimal manifest verbosity"

patterns-established:
  - "secretRef envFrom pattern: all service containers load full secret via envFrom, avoiding per-variable env[] entries"
  - "Helm helper for DATABASE_URL: use orbitl.databaseUrl template helper to toggle between bundled and external postgres"
  - "CronJob enabled flag: wrap entire CronJob YAML in {{- if .Values.cronJobs.X.enabled }} for zero-footprint disabling"
  - "Component label convention: app.kubernetes.io/component added to each resource (web, daemon, migrate, publish, research, daily-summary)"

requirements-completed: [DEPLOY-05]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 4 Plan 03: Helm Chart for Orbitl k3s Deployment Summary

**Minimal-viable Helm chart with web/daemon Deployments, pre-install migration Job hook, three CronJobs with Forbid concurrency, and a Kubernetes Secret containing all env vars including a conditional DATABASE_URL helper**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-28T19:56:19Z
- **Completed:** 2026-02-28T19:58:15Z
- **Tasks:** 2
- **Files modified:** 12 (all created)

## Accomplishments

- Complete Helm chart at `deploy/helm/orbitl/` with Chart.yaml, values.yaml, and 10 templates
- Migration Job as pre-install/pre-upgrade Helm hook with delete-on-success policy, ensuring DB migrations run before any Deployment starts
- Three CronJobs (publish every 5 min, research at 2am, daily-summary at 8am) each with `concurrencyPolicy: Forbid` — matches the established CLEAN-04 requirement
- All secrets in a Kubernetes Secret resource; no env vars hardcoded in templates; services use `envFrom secretRef`
- `orbitl.databaseUrl` helper in _helpers.tpl constructs PostgreSQL connection string for bundled postgres or passes through `externalDatabase.url`
- Conditional Ingress with Traefik ingressClassName and optional cert-manager TLS via `ingress.tls` toggle

## Task Commits

1. **Task 1: Chart metadata, values, and helper templates** - `ef12149` (chore)
2. **Task 2: Deployment, Service, Job, CronJob, Ingress, and Secret templates** - `c7ab878` (feat)

**Plan metadata:** `9281031` (docs: complete Helm chart plan)

## Files Created/Modified

- `deploy/helm/orbitl/Chart.yaml` - Helm chart metadata (apiVersion v2, orbitl, version 0.1.0)
- `deploy/helm/orbitl/values.yaml` - Default values: web/daemon/jobs images, CronJob schedules, PostgreSQL toggle, ingress toggle, env vars
- `deploy/helm/orbitl/templates/_helpers.tpl` - orbitl.name, fullname, labels, selectorLabels, databaseUrl helpers
- `deploy/helm/orbitl/templates/secret.yaml` - Opaque Secret with DATABASE_URL and all API key env vars (b64enc)
- `deploy/helm/orbitl/templates/web-deployment.yaml` - Web Deployment with readiness/liveness probes on /api/health
- `deploy/helm/orbitl/templates/web-service.yaml` - ClusterIP Service port 80 -> 3021
- `deploy/helm/orbitl/templates/daemon-deployment.yaml` - Daemon Deployment, no HTTP probes (process service)
- `deploy/helm/orbitl/templates/migrate-job.yaml` - Pre-install/pre-upgrade Helm hook Job, drizzle-kit migrate, DATABASE_URL from secretKeyRef
- `deploy/helm/orbitl/templates/cronjob-publish.yaml` - Publish CronJob every 5 min, concurrencyPolicy Forbid
- `deploy/helm/orbitl/templates/cronjob-research.yaml` - Research CronJob daily at 2am, concurrencyPolicy Forbid
- `deploy/helm/orbitl/templates/cronjob-daily-summary.yaml` - Daily-summary CronJob at 8am, concurrencyPolicy Forbid
- `deploy/helm/orbitl/templates/ingress.yaml` - Conditional Ingress (networking.k8s.io/v1), Traefik, optional cert-manager TLS

## Decisions Made

- Migration Job uses the web image (not jobs image): the web image contains drizzle-kit and migration files; the jobs image is for runtime job scripts. Sharing the web image for migration keeps the Job command a simple override.
- `orbitl.databaseUrl` is a `_helpers.tpl` template function rather than an inline conditional in secret.yaml — this keeps the Secret template clean and ensures the URL is assembled consistently whether postgres is bundled or external.
- Daemon has no readiness/liveness probe: the daemon is a long-running background process, not an HTTP server. Kubernetes restartPolicy handles recovery without a health probe.
- Ingress defaults to `ingressClassName: traefik` — k3s bundles Traefik as its default ingress controller, so this is the right default for the target platform.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Before deploying, populate the `env:` section in values.yaml (or a separate override file) with real secrets:

```yaml
env:
  ANTHROPIC_API_KEY: "your-key"
  ENCRYPTION_KEY: "32-byte-hex-from-openssl-rand-hex-32"
  EXA_API_KEY: "your-key"
  REDDIT_CLIENT_ID: "your-client-id"
  REDDIT_CLIENT_SECRET: "your-secret"
  LINKEDIN_CLIENT_ID: "your-client-id"
  LINKEDIN_CLIENT_SECRET: "your-secret"
  LINKEDIN_REDIRECT_URI: "https://your-domain/api/auth/linkedin/callback"
  NEXT_PUBLIC_APP_URL: "https://your-domain"
  AUTH_SECRET: "random-32-char-string"
```

## Next Phase Readiness

- Helm chart complete and ready for the k3s deployment guide (Plan 04-04)
- Plan 04-04 can reference chart as `helm install orbitl deploy/helm/orbitl -f values.override.yaml`
- Daemon node-cron double-scheduling concern documented: when CronJobs are enabled in k8s, operators may want to disable node-cron inside the daemon to avoid running jobs twice — this is a configuration note for the k3s guide, not a code change

---
*Phase: 04-deployment-observability*
*Completed: 2026-02-28*

## Self-Check: PASSED

All 12 chart files verified present on disk. Both task commits (ef12149, c7ab878) confirmed in git log.
