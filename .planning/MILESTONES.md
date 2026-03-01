# Milestones

## v1.1 Research Overhaul (In Progress)

**Phases:** 8-11 (4 phases)
**Requirements:** 15 defined
**Started:** 2026-03-01

**Goal:** Research configs become standalone named entities with multi-channel support, a dedicated Research page, and live step-by-step progress during runs.

**Replaces:** v1.1 Twitter/X & Cleanup (scrapped, moved to v1.2+; archived in milestones/)

---

## v1.0 MVP (Shipped: 2026-03-01)

**Phases completed:** 5 phases (17 plans)
**Requirements:** 40/40 satisfied
**Timeline:** 2026-02-27 → 2026-03-01

**Key accomplishments:**
- Pluggable provider system — publishers and research adapters are drop-in modules with auto-discovery
- Single-user authentication with Auth.js v5 (credentials + JWT sessions) and full API route protection
- Polished UI with dark/light mode, skeleton loading, toast notifications, draft review signals
- Docker Compose zero-manual-step self-hosting with migration gating and health checks
- Helm chart for k3s deployment with migration hooks, CronJobs, and optional TLS
- AI usage audit dashboard with cost aggregation by channel and operation type

**Tech debt carried:** 10 items (see milestones/v1.0-MILESTONE-AUDIT.md)

---

