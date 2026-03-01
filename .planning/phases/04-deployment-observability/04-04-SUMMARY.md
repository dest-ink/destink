---
phase: 04-deployment-observability
plan: "04"
subsystem: infra
tags: [k3s, kubernetes, helm, cert-manager, lets-encrypt, tls, traefik, docker]

requires:
  - phase: 04-deployment-observability-plan-03
    provides: Helm chart at deploy/helm/orbitl/ with values.yaml, Chart.yaml, and all templates

provides:
  - "Step-by-step k3s deployment guide at docs/k3s-deployment.md"
  - "Image build/import workflow for single-node k3s (docker save | k3s ctr images import)"
  - "TLS configuration pattern with cert-manager and Let's Encrypt ClusterIssuer"
  - "Upgrade workflow and troubleshooting reference"

affects: [future-operators, self-hosters, release-process]

tech-stack:
  added: []
  patterns:
    - "docker save | k3s ctr images import for single-node clusters avoiding registry setup"
    - "my-values.yaml pattern — user-owned values file not committed to git"
    - "helm install then helm upgrade for TLS after cert-manager is ready"

key-files:
  created:
    - docs/k3s-deployment.md
  modified: []

key-decisions:
  - "imagePullPolicy: Never on locally-imported images — prevents k8s from attempting remote pull"
  - "Two-phase TLS setup — initial install without TLS, upgrade after cert-manager/ClusterIssuer ready"
  - "DISABLE_INTERNAL_CRON env var documented as escape hatch for double-scheduling with daemon's node-cron"
  - "Guide uses traefik as ingressClassName — correct k3s default, provider-agnostic framing"

patterns-established:
  - "docs/ directory for operator-facing deployment guides"
  - "Values customization via cp values.yaml my-values.yaml + git-ignore pattern for secrets"

requirements-completed: [DEPLOY-06]

duration: 2min
completed: "2026-03-01"
---

# Phase 4 Plan 04: k3s Deployment Guide Summary

**400-line step-by-step k3s deployment guide covering image build/import, Helm install, cert-manager TLS, upgrades, and troubleshooting**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-01T02:42:13Z
- **Completed:** 2026-03-01T02:43:32Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `docs/k3s-deployment.md` with 400 lines covering all 9 required sections
- Documents the complete path from `kubectl cluster-info` working to HTTPS serving traffic
- Covers single-node image workflow (docker save | k3s ctr images import) with multi-node registry note
- Includes copy-pasteable ClusterIssuer YAML for Let's Encrypt via Traefik HTTP-01 challenge

## Task Commits

Each task was committed atomically:

1. **Task 1: Write k3s deployment guide** - `a5e671c` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `docs/k3s-deployment.md` - Complete k3s deployment guide: prerequisites, image build/import, namespace, values config, helm install, verification, TLS with cert-manager, upgrading, troubleshooting, values reference table

## Decisions Made

- Used two-phase TLS setup: initial `helm install` without TLS, then enable TLS after cert-manager and ClusterIssuer are ready and `helm upgrade` applies it — clearer sequencing for operators
- Documented `DISABLE_INTERNAL_CRON` env var as the escape hatch for double-scheduling (daemon node-cron vs k8s CronJobs) — not currently wired in daemon but documents the intended pattern
- `imagePullPolicy: Never` explicitly called out in values config section — required for locally-imported images or k8s will fail to pull

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — this plan produces documentation only.

## Next Phase Readiness

Phase 4 is complete. All 4 plans executed:
- 04-01: Docker Compose, Dockerfiles, health endpoint
- 04-02: /audit page with AuditSummaryCards and AuditTabs (OBS-01, OBS-02)
- 04-03: Helm chart at deploy/helm/orbitl/ (DEPLOY-05)
- 04-04: k3s deployment guide at docs/k3s-deployment.md (DEPLOY-06)

v1.0 milestone deployment and observability requirements are fully satisfied.

---
*Phase: 04-deployment-observability*
*Completed: 2026-03-01*
