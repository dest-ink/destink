# Project Research Summary

**Project:** Orbitl — Pluggable Provider System, UI Polish, and Containerized Deployment
**Domain:** Self-hosted AI content generation and publishing automation with extensible plugin architecture
**Researched:** 2026-02-26
**Confidence:** MEDIUM-HIGH

## Executive Summary

Orbitl is a self-hosted, AI-powered content pipeline that takes a creator through research, topic ranking, voice-matched draft generation, human review, and scheduled publishing. Phases 1-7 are complete; this milestone adds three things: (1) a drop-in pluggable provider system for publishers and research adapters, (2) UI polish that makes the existing functionality feel production-ready, and (3) Docker Compose deployment that makes self-hosting a single-command operation. Research confirms that all three are achievable without introducing new runtime dependencies beyond Docker itself — the plugin system uses TypeScript interfaces, a Map-based registry, and `fs.readdirSync` already available in the codebase.

The recommended architecture is a Registry + Strategy pattern: two registries (one for publisher providers, one for research adapters), convention-based auto-discovery via filename suffix (`.provider.ts`, `.adapter.ts`), and module-level singleton initialization at startup. This pattern is verified at production scale by Slash Engineering's 1M+ LoC TypeScript codebase and mirrors Payload CMS and Fastify's plugin models. The "drop a file, done" contributor experience is achievable — but it requires runtime interface validation at load time to prevent silent failures when interface methods change in future releases.

The critical risk profile centers on four known code-level issues that must be fixed before containerizing: (1) job scripts require `process.exit(0)` instead of clean DB pool shutdown, (2) queue items can get permanently stuck in `publishing` status with no recovery, (3) the daemon has no SIGTERM handler, and (4) the scheduler has a server-local-time timezone bug. None of these are architectural — they are discrete fixes. Address them first, before writing Dockerfiles, to avoid baking broken behavior into containers.

---

## Key Findings

### Recommended Stack

The existing stack (Next.js 16.1.6, TypeScript 5, Drizzle ORM, PostgreSQL, Zod 3.25.x, Radix UI, Tailwind CSS 4, node-cron, Anthropic SDK) is locked and not re-evaluated. New additions for this milestone are minimal: no new runtime npm packages are needed for the plugin system. Containerization requires two Dockerfiles (`Dockerfile.web` using `output: standalone`, `Dockerfile.daemon` compiled with tsc), Docker Compose v2, and a minimal custom Helm chart with Bitnami PostgreSQL as a subchart for the optional k3s path.

See `.planning/research/STACK.md` for full details and Dockerfiles.

**Core technologies (new additions only):**
- TypeScript `interface` + `satisfies` operator: define provider contracts — catches violations at assignment site, better DX than abstract classes
- `Map<string, Provider>` registry + `fs.readdirSync`: plugin auto-discovery — zero dependencies, native Node.js 20 built-ins
- `node:22-bookworm-slim` Docker base image: glibc-compatible, avoids Alpine musl issues with `pg` native module
- `output: standalone` (Next.js config): enables minimal Docker image without `npm install` in the runner stage
- Docker Compose v2: single-machine orchestration with `condition: service_healthy` startup ordering
- Custom Helm chart + Bitnami PostgreSQL subchart: minimal k3s deployment path, deferred to v2+

**Critical version constraints:**
- Do NOT upgrade to Zod 4 during this milestone — `zod/v4` subpath has breaking changes in error API
- `output: standalone` is incompatible with custom `server.js` — the daemon must remain a separate process
- `postgres:17-alpine` is acceptable for Docker Compose DB (PostgreSQL team maintains the Alpine image; musl concern does not apply to the DB binary)
- Daemon Helm deployment must be `replicas: 1` — multiple daemon instances would fire duplicate cron ticks

### Expected Features

Research identifies a clear boundary between what must ship for v1 to feel complete and what can follow in v1.x. Orbitl's competitive moat — voice-matched pipeline with pluggable extensibility — is not shared by any competitor. Buffer owns analytics/scheduling; Postiz/Mixpost own multi-platform self-hosting; no tool combines AI voice cloning from writing samples + research automation + drop-in provider extensibility.

See `.planning/research/FEATURES.md` for full feature matrix and competitor analysis.

**Must have (table stakes for v1 launch):**
- Pluggable publisher provider interface — Substack + LinkedIn refactored as reference implementations; auto-discovery from filesystem
- Pluggable research adapter interface — Exa, Reddit, Substack monitor adapters refactored; consistent extensibility model
- Single-user authentication — required before Docker deployment recommendation; any network-accessible instance is otherwise open
- Docker Compose deployment — `docker compose up` brings up web + daemon + PostgreSQL; includes `.env.example`
- UI polish on critical flows — draft review, queue management, channel setup; empty states; loading states; actionable error messages
- Timezone-aware scheduling — correctness bug, not polish; "9am" must mean user's 9am
- DB connection cleanup — clean shutdown for daemon and job runners; prerequisite for Docker

**Should have (competitive differentiators, v1.x):**
- Headline picker UI — `headlineOptions[]` already generated; just needs picker component
- Voice confidence badge — score already computed; needs UI treatment with tooltip
- Research source transparency — sources stored in `researchRuns`; surface in draft review
- AI usage dashboard — aggregate spend by channel/operation; data already in `aiAuditLog`
- Daily/weekly summary job — automated digest of what was researched, drafted, published
- Data export — JSON export of drafts, channels, audit log; self-hosted user expectation
- Retry UI for failed queue items — backend handles retries; just needs a button in queue view

**Defer to v2+:**
- Helm chart — defer until users actually request k3s/Kubernetes scaling
- Additional publisher providers (Twitter/X, Medium, Ghost, Bluesky) — let community contribute via pluggable system
- Additional research adapters (RSS, Hacker News, custom webhooks)
- Multi-user auth — only if solo-creator assumption is invalidated

**Anti-features (explicitly exclude):**
- Social analytics/engagement metrics — different product; link to native platform analytics
- Real-time multi-user collaboration — scope expands 3x; contradicts solo-creator positioning
- Auto-publish without human review — destroys trust; human-in-the-loop is the product's safety moat
- Built-in image generation — requires separate AI provider, media storage; major scope expansion
- Mobile app — responsive web is sufficient; PWA installable if needed

### Architecture Approach

The recommended architecture is two registries (Publisher + Research Adapter), each with a typed interface, a Map-based registry class, a glob-based startup loader, and a module-level singleton for initialization. The build order is strict: define interfaces first, build registries second, build loaders third, then migrate existing implementations as reference providers, then update queue-runner and orchestrator to use registry dispatch instead of if/else chains. This sequence ensures each step is independently testable.

See `.planning/research/ARCHITECTURE.md` for full patterns, code examples, and anti-patterns.

**Major components:**
1. `PublisherRegistry` — maps `channel.platform` string to `PublisherProvider`; dispatches publish calls; replaces if/else chain in `queue-runner.ts`
2. `ResearchAdapterRegistry` — holds all research adapters; fans out to all registered adapters via `getAll()` + `Promise.allSettled`; replaces hardcoded imports in `orchestrator.ts`
3. `PublisherProvider` interface — contract: `platform`, `formatContent()`, `publish()`, `validateCredentials()`; enforced with `satisfies` operator at definition site
4. `ResearchAdapter` interface — contract: `name`, `isConfigured()`, `search()`; `isConfigured()` enables graceful skip when adapter has no API key configured
5. Startup loader (`loader.ts` per domain) — globs `*.provider.ts` / `*.adapter.ts` directories; dynamically imports; registers; runs once at process start
6. `init.ts` singleton — for Next.js API routes where dynamic filesystem import at request time is restricted; ensures providers loaded exactly once per process

**Key architectural decisions:**
- Interface + object literal + `satisfies` over abstract class inheritance — simpler, no class hierarchy required, easier for contributors
- Registry throws on unknown platform (hard failure) rather than silently no-oping — surfaces misconfiguration immediately
- Research adapter registry uses `getAll()` fan-out; publisher registry uses `get(key)` single lookup — different dispatch semantics for different use cases
- Next.js App Router requires startup singleton pattern for provider loading (cannot glob filesystem at request time); daemon uses true async glob
- `platformEnum` in `schema.ts` is a Postgres enum locked to current values — new platforms require a schema migration even if the provider file auto-discovers

### Critical Pitfalls

Six critical pitfalls are identified. Four are pre-existing code issues that must be fixed before containerizing. Two are new risks introduced by this milestone's features.

See `.planning/research/PITFALLS.md` for full detail, recovery strategies, and the "Looks Done But Isn't" checklist.

1. **DB connection pool not closed in job scripts** — `publish.ts` and `research.ts` use `process.exit(0)` as a workaround; replace with `pool.end()` in `finally` blocks before building Docker images. This is confirmed in CONCERNS.md.

2. **Stuck `publishing` queue items with no recovery** — queue-runner's inner catch has no further recovery; items freeze in `publishing` state permanently. Add a recovery query at the top of each `runPublishQueue()` call that resets items stuck longer than a configurable timeout (30 min).

3. **Daemon has no SIGTERM handler** — Kubernetes/Docker sends SIGTERM on pod termination; daemon exits mid-publish leaving DB connections open and queue items stuck. Add `process.on('SIGTERM')` handler with `isShuttingDown` flag. Run daemon directly as `node dist/daemon/index.js`, not via npm (npm swallows signals).

4. **`NEXT_PUBLIC_` env vars are baked into Docker image at build time** — runtime `docker-compose.yml` overrides are silently ignored for `NEXT_PUBLIC_` vars. Minimize their use; read config in server components or API routes using unprefixed `process.env`.

5. **`depends_on` without `condition: service_healthy` causes startup race conditions** — Docker Compose's default `depends_on` waits for container start, not DB readiness. Use `condition: service_healthy` + postgres `healthcheck` block. Research confirms a dedicated `migrate` service with `condition: service_completed_successfully` is the correct Drizzle migration pattern.

6. **Plugin interface versioning — breaking changes kill contributed providers** — adding a required method to `PublisherProvider` breaks all existing drop-in providers at runtime with a cryptic `TypeError`. Build runtime interface validation into the loader at startup (check each loaded module against required interface shape); treat the provider interface as a versioned public API.

---

## Implications for Roadmap

Based on research, a 4-phase structure is recommended. The ordering is driven by dependency analysis: known code defects must be fixed before containerizing; provider interfaces must be defined before migrating existing implementations; Docker must work before Helm is relevant.

### Phase 1: Known Issues and Foundation Cleanup

**Rationale:** Four known code defects (CONCERNS.md items) are prerequisites for containerization and would cause Docker deployments to fail silently or leave broken state. Fix these before writing any new code so new features build on a clean foundation.

**Delivers:**
- `pool.end()` in all job script `finally` blocks; no more `process.exit(0)` workarounds
- Stuck-item recovery query in `runPublishQueue()`
- Timezone fix in `scheduler.ts`
- SIGTERM handler in `daemon/index.ts`
- Anthropic pricing moved from hardcoded `audit.ts` to config

**Addresses (from FEATURES.md):** DB connection cleanup (prerequisite for Docker), timezone-aware scheduling (correctness bug)

**Avoids (from PITFALLS.md):** Pitfalls 1 (DB connection leak), 2 (stuck items), 3 (daemon SIGTERM), timing bug in scheduler

**Research flag:** Standard patterns — no additional research needed. All fixes are documented in CONCERNS.md.

### Phase 2: Pluggable Provider System

**Rationale:** This is the architectural heart of the milestone. Build interfaces first (no dependencies), then registries, then loaders, then migrate existing implementations as reference providers, then update callers. ARCHITECTURE.md provides a strict build order that makes each step independently testable. The interface contract is only trustworthy once proven by two real reference implementations (Substack + LinkedIn).

**Delivers:**
- `PublisherProvider` interface + `PublisherRegistry` + startup loader
- `ResearchAdapter` interface + `ResearchAdapterRegistry` + startup loader
- `substack.provider.ts` and `linkedin.provider.ts` as reference publisher implementations
- `exa.adapter.ts`, `reddit.adapter.ts`, `substack-monitor.adapter.ts` as reference research implementations
- `queue-runner.ts` updated to use `registry.get(platform)` — zero platform knowledge in queue runner
- `orchestrator.ts` updated to use `registry.getAll()` fan-out
- Runtime interface validation in loader (guards against future breaking changes)
- Provider contract test file contributors can run locally

**Uses (from STACK.md):** TypeScript `satisfies`, `fs.readdirSync`, dynamic `import()`, Zod for credential schema validation, `init.ts` singleton for Next.js compatibility

**Implements (from ARCHITECTURE.md):** All 6 major components; strict 10-step build order

**Avoids (from PITFALLS.md):** Pitfall 4 (interface versioning / no runtime validation), if/else dispatch anti-pattern

**Research flag:** Standard patterns — HIGH confidence from Slash Engineering, Payload CMS, Fastify references. No additional research needed.

### Phase 3: Authentication and UI Polish

**Rationale:** Auth is required before Docker deployment can be recommended to any user. UI polish (empty states, loading states, actionable errors) is a force multiplier that affects every feature — building shared UI components here means they're available for all polish work. These two concerns can be worked in parallel but logically belong in the same phase as they both gate the "ready for real users" threshold.

**Delivers:**
- Single-user authentication (password or token); middleware protecting all `/api/**` routes
- Empty states with next-step guidance for channels, drafts, queue
- Loading/skeleton states for research and generation flows
- Actionable error messages with platform-specific context (e.g., "LinkedIn token expired — reconnect")
- Retry UI button in queue view
- "Test connection" action when saving channel credentials
- Queue management improvements: cancel, reorder

**Addresses (from FEATURES.md):** Authentication (P1), UI polish (P1), retry UI for queue failures (P2)

**Avoids (from PITFALLS.md):** Security pitfall (unauthenticated API routes); UX pitfalls (silent adapter failure, no credential validation, empty states)

**Research flag:** Auth implementation will likely need phase-level research — pattern choice (NextAuth, custom JWT, passkey) depends on deployment target and session requirements. Recommend `/gsd:research-phase` when planning this phase.

### Phase 4: Docker Compose Deployment

**Rationale:** Depends on all prior phases. Auth must exist (Phase 3), DB cleanup must work (Phase 1), and providers must load cleanly at container startup (Phase 2). With those in place, Docker Compose is straightforward and well-documented.

**Delivers:**
- `Dockerfile.web` (multi-stage, `output: standalone`, `node:22-bookworm-slim`)
- `Dockerfile.daemon` (multi-stage, compiled with tsc, direct `node` entrypoint for signal propagation)
- `docker-compose.yml` with postgres (health check), migrate (one-shot), web, daemon services
- `.env.example` with every required variable documented
- `docker compose up` works on a fresh clone with populated `.env`
- Structured JSON logging (replace console.log before shipping logs to any aggregator)

**Uses (from STACK.md):** `node:22-bookworm-slim`, `postgres:17-alpine`, Docker Compose v2, `output: standalone`, `condition: service_healthy`, `condition: service_completed_successfully`

**Avoids (from PITFALLS.md):** Pitfall 1 (`NEXT_PUBLIC_` baked at build time), Pitfall 5 (`depends_on` without health check), signal propagation pitfall, Helm secrets pitfall

**Research flag:** Standard patterns — HIGH confidence from official Next.js docs, Vercel with-docker example, official Docker Compose docs. No additional research needed.

### Optional Phase 5: v1.x Enhancements (Post-Launch)

**Rationale:** These features are differentiating and valued but not required for v1 launch. All leverage data that already exists in the system — they are display and aggregation work, not new data collection.

**Delivers:**
- Headline picker UI (surfaces existing `headlineOptions[]`)
- Voice confidence badge (surfaces existing score with tooltip)
- Research source transparency in draft review
- AI usage dashboard (aggregate `aiAuditLog` by channel/operation)
- Daily/weekly summary job
- Data export (JSON)

**Deferred to v2+:**
- Helm chart — build only when users request k3s/Kubernetes scaling
- Additional publisher providers — community contribution via pluggable system
- Multi-user auth — only if solo-creator assumption is invalidated

### Phase Ordering Rationale

- **Cleanup before build:** Known defects in job scripts and the daemon would silently break Docker deployments. Fixing them in Phase 1 means every subsequent phase builds on verified foundations.
- **Interfaces before implementations:** ARCHITECTURE.md's build order is strict — define interfaces, then registries, then loaders, then migrate, then update callers. This order ensures each step is testable and no phase depends on an interface that changes in the next step.
- **Auth before Docker:** A Docker Compose deployment without auth makes `/api/channels`, `/api/drafts`, and `/api/queue` publicly accessible over the network. Auth must exist before the deployment is recommended to anyone.
- **Docker before Helm:** The Helm chart wraps Docker images. Docker must work first. Helm is explicitly deferred to v2+.

### Research Flags

Phases likely needing `/gsd:research-phase` during planning:
- **Phase 3 (Auth):** Pattern choice (NextAuth, custom JWT, passkey) is non-trivial; depends on session requirements, upgrade path to multi-user, and Next.js App Router compatibility. Research needed before planning.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Cleanup):** All fixes are explicitly documented in CONCERNS.md; implementation is unambiguous.
- **Phase 2 (Plugin System):** Architecture is fully specified in ARCHITECTURE.md with code examples; HIGH confidence from verified production references.
- **Phase 4 (Docker Compose):** Official Next.js, Docker, and Docker Compose documentation covers all patterns; Dockerfiles are fully specified in STACK.md.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core plugin patterns HIGH (official TypeScript/Node docs); Docker patterns HIGH (official Next.js + Docker docs); Helm patterns MEDIUM (k3s Helm Controller docs + community examples) |
| Features | MEDIUM | No direct user research; drawn from competitor analysis (Buffer, Postiz, Mixpost) and product positioning inference; competitor analysis is solid, priority judgments are opinionated estimates |
| Architecture | HIGH | Registry + Strategy pattern verified against production system (Slash Engineering 1M+ LoC); confirmed by Payload CMS and Fastify official docs; existing codebase directly inspected |
| Pitfalls | HIGH | Critical pitfalls confirmed by direct codebase analysis (CONCERNS.md, queue-runner.ts, daemon/index.ts); Docker pitfalls from official Next.js docs and GitHub Discussions |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Auth implementation pattern:** Research did not evaluate specific auth libraries (NextAuth vs. custom JWT vs. passkey). This must be resolved in Phase 3 planning via `/gsd:research-phase` before implementation begins.
- **`platformEnum` Postgres enum expansion:** Adding new platform providers via the plugin system still requires a DB schema migration to extend the enum. This constraint is noted but a migration strategy for community-contributed providers is not fully designed — needs attention when a third-party provider is first added (v2+).
- **`fast-glob` vs. `readdirSync`:** Research leaves this decision open — `readdirSync` is sufficient for a single flat directory and has no extra dependency; `fast-glob` is warranted only if multi-directory discovery is needed. Decide during Phase 2 planning.
- **Structured logging format:** Research flags the need to move from console.log to structured JSON logging before containerizing, but does not recommend a specific library (pino, winston, etc.). Decide during Phase 4 planning — pino is the standard choice for Node.js + Docker.
- **Helm chart scope:** Deferred to v2+, but when it becomes relevant, the k3s Helm Controller pattern (STACK.md) and secrets management approach (PITFALLS.md) are already specified.

---

## Sources

### Primary (HIGH confidence)
- [Next.js Self-Hosting Guide (official)](https://nextjs.org/docs/app/guides/self-hosting) — Docker deployment, `output: standalone`, env var runtime behavior
- [Next.js `output` config reference (official)](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output) — standalone output mechanics and caveats
- [Vercel with-docker official example](https://github.com/vercel/next.js/tree/canary/examples/with-docker) — multi-stage Dockerfile confirmed with `node:22.14-slim`
- [k3s Helm Controller docs](https://docs.k3s.io/helm) — k3s native Helm support
- [TypeScript `satisfies` operator docs](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html) — interface enforcement at assignment site
- [Payload CMS plugin architecture (official docs)](https://payloadcms.com/docs/plugins/build-your-own) — plugin array registration pattern
- [Fastify plugin system (official docs)](https://fastify.dev/docs/latest/Reference/Plugins/) — encapsulation and explicit registration
- [TypeScript adapter pattern (refactoring.guru)](https://refactoring.guru/design-patterns/adapter/typescript/example) — canonical interface + implements reference
- [Docker Compose startup ordering (official)](https://docs.docker.com/compose/how-tos/startup-order/) — `depends_on` health check behavior
- [node-postgres Pool documentation](https://node-postgres.com/apis/pool) — `pool.end()` requirement for clean script exit
- [Zod v4 release notes](https://zod.dev/v4) — v4 at `zod/v4` subpath; breaking changes confirmed
- Orbitl CONCERNS.md codebase audit — direct code analysis; HIGH confidence

### Secondary (MEDIUM confidence)
- [Slash Engineering: Scaling 1M lines of TypeScript](https://puzzles.slash.com/blog/scaling-1m-lines-of-typescript-registries) — registry + discriminator + loadModules auto-discovery pattern at production scale
- [Snyk: Choosing the best Node.js Docker image](https://snyk.io/blog/choosing-the-best-node-js-docker-image/) — `node:bookworm-slim` vs Alpine recommendation
- [Bitnami PostgreSQL Helm Chart (Artifact Hub)](https://artifacthub.io/packages/helm/bitnami/postgresql) — chart version 18.4.0 current
- [Node.js graceful shutdown with SIGTERM (Rising Stack)](https://blog.risingstack.com/graceful-shutdown-node-js-kubernetes/) — SIGTERM handler pattern
- [Node.js Docker signal handling best practices (goldbergyoni)](https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/docker/graceful-shutdown.md) — direct node entrypoint for signal propagation
- [ArjanCodes: Plugin architecture best practices](https://arjancodes.com/blog/best-practices-for-decoupling-software-using-plugins/) — plugin/provider pattern design
- [Stateful: Node.js plugin system with Map-based registry](https://stateful.com/blog/build-a-plugin-system-with-node) — registry pattern implementation

### Tertiary (MEDIUM-LOW confidence)
- Buffer, Postiz, Mixpost product sites — competitor feature landscape; no instrumented user research available
- [semver-ts.org: TypeScript plugin interface versioning](https://www.semver-ts.org/) — versioning strategy for provider interfaces
- [iodigital: Function registry pattern](https://techhub.iodigital.com/articles/function-registry-pattern-react) — eliminating if/else with registry + canHandle

---

*Research completed: 2026-02-26*
*Ready for roadmap: yes*
