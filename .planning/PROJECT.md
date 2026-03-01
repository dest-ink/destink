# Orbitl

## What This Is

Orbitl is an open-source social content generator — a complete publishing agency that automates research, ranking, content generation, approvals, and posting. Solo creators configure their voice and persona so the writing agent produces genuinely personal content, then publish to any platform through a pluggable provider system. Self-hosted via Docker Compose or Kubernetes (k3s).

## Core Value

Automated, high-quality content that sounds like the creator wrote it — from research to published post, hands-off except for final approval.

## Requirements

### Validated

- ✓ Channel management (create/configure content channels with topics and voice) — v1.0
- ✓ Voice pipeline (analyze writing samples, build persona profile, assemble system prompts) — v1.0
- ✓ Multi-source research (Exa, Reddit, Substack adapters with topic ranking) — v1.0
- ✓ AI-powered draft generation (context builder, Claude integration, prompt assembly) — v1.0
- ✓ Draft review UI (review, edit, approve/reject generated drafts) — v1.0
- ✓ Publish queue with timeline view — v1.0
- ✓ Scheduling logic (configurable publish windows per channel) — v1.0
- ✓ Daemon publish loop (background worker that processes the queue) — v1.0
- ✓ Substack publisher (provider module) — v1.0
- ✓ LinkedIn publisher (provider module) — v1.0
- ✓ CronJob entry points for publish and research jobs — v1.0
- ✓ Database schema with encryption for credentials — v1.0
- ✓ AI audit logging (token usage, cost tracking) — v1.0
- ✓ Pluggable publisher provider system (drop-in module, auto-discovered) — v1.0
- ✓ Pluggable research adapter system (same drop-in pattern as publishers) — v1.0
- ✓ Single-user authentication (email/password, JWT sessions) — v1.0
- ✓ Dark/light mode design system with toast notifications — v1.0
- ✓ Skeleton loading, empty states, actionable error messages — v1.0
- ✓ Draft review signals (voice confidence, headline picker, source attribution) — v1.0
- ✓ Per-channel cost data and retry affordances — v1.0
- ✓ Docker Compose deployment (zero-manual-step self-hosting) — v1.0
- ✓ Helm chart for k3s deployment — v1.0
- ✓ AI usage/audit dashboard — v1.0
- ✓ k3s deployment guide — v1.0
- ✓ DB connection lifecycle cleanup and queue runner tests — v1.0
- ✓ Graceful daemon shutdown (SIGTERM) and daily summary job — v1.0

### Active

#### Current Milestone: v1.1 Research Overhaul

**Goal:** Research configs become standalone named entities with multi-channel support, a dedicated Research page, and live step-by-step progress during runs.

**Target features:**
- Standalone `researchers` table with name + config (decoupled from channels)
- Many-to-many researcher↔channel linking via join table
- Data migration: move existing per-channel research configs to new researchers
- Research page in sidebar nav (`/research`)
- Research list page with researcher cards
- Create/edit researcher with channel multi-select
- Live SSE progress panel (step-by-step adapter log, errors inline)
- Progress event infrastructure in orchestrator + engine
- Channel page cleanup (remove Research Config tab, link to /research instead)

### Out of Scope

- Mobile app — web-first, self-hosted
- SaaS/multi-tenant hosting — open source, self-hosted only
- Payment/billing — free and open source
- Real-time collaboration — solo creator tool
- Social media analytics/metrics — publishing only, not analytics
- Auto-publish without review — contradicts approval-centric design
- Built-in image generation — scope explosion, use external tools

## Context

**Current state:** v1.0 shipped. 5 phases (17 plans) complete. ~78k lines across 390 files.

**Tech stack:** Next.js 16, TypeScript, Drizzle ORM, PostgreSQL, Tailwind CSS 4, Radix UI, Auth.js v5, next-themes. AI via Anthropic Claude API. Infrastructure: Docker Compose, Helm chart for k3s.

**Architecture highlights:**
- Pluggable provider system: `Registry<T>` with auto-discovery via `loadDirectory()` for both publishers and research adapters
- Shared `initRegistries()` bootstrap for all process entry points (daemon, job scripts, instrumentation)
- Dual-extension discovery (.ts + .js) for dev and production builds
- Server-rendered audit dashboard with inline Drizzle aggregation queries

**Known tech debt:** 10 items tracked in v1.0-MILESTONE-AUDIT.md (publish-now stub, DISABLE_INTERNAL_CRON not implemented, scheduler timezone TODO, etc.)

## Constraints

- **Tech stack**: Next.js 16, TypeScript, Drizzle ORM, PostgreSQL, Tailwind CSS 4 — established, don't change
- **AI provider**: Anthropic Claude — existing integration, keep for now
- **Open source**: All features must work without paid dependencies beyond the AI API key
- **Self-hosted**: Must run on a single machine via Docker Compose; Helm for k3s scaling
- **Voice quality**: Generated content must be customizable enough that it doesn't read as generic AI output

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Drop-in provider modules with auto-discovery | Lowest friction for contributors — implement interface, drop file, done | ✓ Good — 2 publishers, 4 adapters working |
| Both Docker Compose and Helm | Compose for solo creators, Helm for teams/scaling | ✓ Good — both shipped |
| Research adapters also pluggable | Consistency with publisher pattern — one extensibility model | ✓ Good |
| Writing samples + config knobs for voice | Samples establish baseline tone, knobs fine-tune | ✓ Good (voice pipeline built) |
| PostgreSQL with Drizzle ORM | Type-safe, migration-friendly, proven stack | ✓ Good |
| Auth.js v5 with Credentials provider | Single-user self-hosted — no OAuth complexity needed | ✓ Good |
| Server component data fetching (no API routes for pages) | Next.js pattern — server components query DB directly | ✓ Good |
| Shared bootstrap for registry init | Single entry point prevents CronJob dispatch failures | ✓ Good — fixed via Phase 3.1 |
| Next.js standalone output for Docker | Minimal ~150MB production image vs ~1GB with full node_modules | ✓ Good |

---
*Last updated: 2026-03-01 after v1.1 Research Overhaul milestone start*
