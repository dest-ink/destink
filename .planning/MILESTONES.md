# Milestones

## v1.2 Content Pipeline Automation (Shipped: 2026-03-30)

**Phases completed:** 4 phases, 8 plans, 13 tasks

**Key accomplishments:**

- Promoted maxDraftsPerRun and shortFormPercent to top-level researcher columns via SQL migration with back-fill and JSON key stripping, cleaned ResearchSourceConfig to 4 source fields, and deleted dead ResearchConfigForm.tsx
- ResearcherForm restructured into 4 labeled sections with a Short-form/Long-form Radix slider replacing the old Note % number input, and Schedule (hours) removed
- Batch draft engine (generateDraftsForRun + assignContentTypes) with autoDraft schema column, Drizzle migration, and 5 draft progress event types extending the research SSE stream
- Auto-draft hook, manual trigger SSE endpoint, and ResearchRunPanel draft event handling wired into the research pipeline using the batch engine from Plan 01
- Generate Drafts button with SSE progress log on run detail page, Drafts Generated badge, autoDraft toggle in ResearcherForm, and draft count badges in RunsList
- router.refresh() added to ResearchRunPanel finally block so runs list page updates automatically after SSE stream closes
- automationSchedules Drizzle table with FK cascade to researchers, cron-utils module with INTERVAL_PRESETS and getNextRunAt, and migration applied to dev database

---

## v1.1 Research Overhaul (Shipped: 2026-03-01)

**Phases completed:** 4 phases (4 plans)
**Requirements:** 15/15 satisfied
**Timeline:** 2026-03-01

**Key accomplishments:**

- Standalone researchers table decoupled from channels with many-to-many join table
- Data migration script for existing per-channel research configs
- Full CRUD API for researchers with channel multi-select
- SSE-based live progress streaming during research runs
- Research page in sidebar nav with list, create/edit, and run panel
- Channel detail page cleaned up (Research Config tab removed)

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
