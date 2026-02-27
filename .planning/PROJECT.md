# Orbitl

## What This Is

Orbitl is an open-source social content generator — a complete publishing agency that automates research, ranking, content generation, approvals, and posting. Solo creators configure their voice and persona so the writing agent produces genuinely personal content, then publish to any platform through a pluggable provider system. Self-hosted via Docker Compose or Kubernetes.

## Core Value

Automated, high-quality content that sounds like the creator wrote it — from research to published post, hands-off except for final approval.

## Requirements

### Validated

<!-- Shipped and confirmed — exists in codebase on feature/build branch. -->

- ✓ Channel management (create/configure content channels with topics and voice) — Phase 1-2
- ✓ Voice pipeline (analyze writing samples, build persona profile, assemble system prompts) — Phase 2
- ✓ Multi-source research (Exa, Reddit, Substack adapters with topic ranking) — Phase 3
- ✓ AI-powered draft generation (context builder, Claude integration, prompt assembly) — Phase 4
- ✓ Draft review UI (review, edit, approve/reject generated drafts) — Phase 5
- ✓ Publish queue with timeline view — Phase 5
- ✓ Scheduling logic (configurable publish windows per channel) — Phase 6
- ✓ Daemon publish loop (background worker that processes the queue) — Phase 6
- ✓ Substack publisher — Phase 7
- ✓ LinkedIn publisher — Phase 7
- ✓ CronJob entry points for publish and research jobs — Phase 7
- ✓ Database schema with encryption for credentials — Phase 1
- ✓ AI audit logging (token usage, cost tracking) — Phase 1

### Active

<!-- Current scope — building toward these for v1. -->

- [ ] Pluggable publisher provider system (drop-in module, auto-discovered)
- [ ] Refactor Substack publisher to provider module (reference implementation)
- [ ] Refactor LinkedIn publisher to provider module (reference implementation)
- [ ] Pluggable research adapter system (same drop-in pattern as publishers)
- [ ] Refactor Exa/Reddit/Substack research adapters to pluggable modules
- [ ] Polished, beautiful UI (frontend-design skill)
- [ ] Docker Compose deployment (simple self-hosting for solo creators)
- [ ] Helm chart + k3s deployment (scaling option)
- [ ] AI usage/audit dashboard
- [ ] Daily summary job
- [ ] Proper DB connection cleanup in job scripts
- [ ] Queue runner test coverage
- [ ] Dockerfiles for web and daemon

### Out of Scope

- Mobile app — web-first, self-hosted
- SaaS/multi-tenant hosting — open source, self-hosted only
- Payment/billing — free and open source
- Real-time collaboration — solo creator tool
- Social media analytics/metrics — publishing only, not analytics

## Context

Orbitl was built from a detailed implementation plan in Claude Desktop (tasks 1.1-7.3 complete on `feature/build` branch in `.worktrees/build/`). The codebase is a full-stack Next.js 16 app with TypeScript, Drizzle ORM, PostgreSQL, and Tailwind CSS 4 + Radix UI. AI integration uses Anthropic's Claude API directly.

The existing publishers (Substack, LinkedIn) and research adapters (Exa, Reddit, Substack) are functional but hardcoded. The v1 goal is to refactor these into a pluggable provider system where contributors can add new platforms by dropping in a module file.

A code review of task 7.3 identified 4 fixes needed before the codebase is clean: concurrency policy comment, DB connection cleanup, daily summary job, and queue runner tests.

## Constraints

- **Tech stack**: Next.js 16, TypeScript, Drizzle ORM, PostgreSQL, Tailwind CSS 4 — established, don't change
- **AI provider**: Anthropic Claude — existing integration, keep for v1
- **Open source**: All features must work without paid dependencies beyond the AI API key
- **Self-hosted**: Must run on a single machine via Docker Compose; Helm optional for scaling
- **Voice quality**: Generated content must be customizable enough that it doesn't read as generic AI output

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Drop-in provider modules with auto-discovery | Lowest friction for contributors — implement interface, drop file, done | — Pending |
| Both Docker Compose and Helm | Compose for solo creators, Helm for teams/scaling | — Pending |
| Research adapters also pluggable | Consistency with publisher pattern — one extensibility model | — Pending |
| Writing samples + config knobs for voice | Samples establish baseline tone, knobs fine-tune | ✓ Good (voice pipeline built) |
| PostgreSQL with Drizzle ORM | Type-safe, migration-friendly, proven stack | ✓ Good |

---
*Last updated: 2026-02-26 after initialization*
