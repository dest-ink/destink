# Pitfalls Research

**Domain:** Open-source self-hosted content generation and publishing automation — plugin system refactor, containerized deployment, UI polish
**Researched:** 2026-02-26
**Confidence:** HIGH (Docker/Next.js self-hosting from official docs), MEDIUM (plugin patterns from community sources + code analysis), HIGH (known issues from CONCERNS.md codebase audit)

---

## Critical Pitfalls

### Pitfall 1: NEXT_PUBLIC_ Environment Variables Are Baked Into the Docker Image at Build Time

**What goes wrong:**
Any environment variable prefixed with `NEXT_PUBLIC_` is inlined as a literal string value into the compiled JavaScript bundle during `next build`. The Docker image carries those frozen values. If you then try to override them at container runtime via `docker-compose.yml` or a Helm values file, the browser-side code ignores the runtime values entirely and uses what was baked in at build time. This breaks the 12-Factor App contract (one image, multiple environments) and forces a full rebuild for every environment change.

**Why it happens:**
Developers assume that because server-side environment variables are read at runtime, all env vars behave the same way. Next.js's distinction between `NEXT_PUBLIC_` (build-time, client-inlined) and all other variables (runtime, server-only) is non-obvious and poorly surfaced in errors.

**How to avoid:**
- Keep `NEXT_PUBLIC_` variables to an absolute minimum. For Orbitl, the only legitimate candidates are API base URLs used in client components.
- Read configuration in server components or API routes using `process.env` without the prefix — these are truly runtime and can be overridden per environment.
- If a `NEXT_PUBLIC_` value genuinely must differ between environments, use a Docker entrypoint script that rewrites a placeholder token in the bundle at container start time, or use the official `with-docker-multi-env` pattern from the Next.js examples repo.
- Verify the official Next.js self-hosting documentation when setting up the Dockerfile: https://nextjs.org/docs/app/guides/self-hosting

**Warning signs:**
- A Docker image is rebuilt for each environment (dev, staging, prod) rather than promoted.
- `NEXT_PUBLIC_` values in `docker-compose.yml` appear to do nothing.
- The app always hits the wrong API URL regardless of compose overrides.

**Phase to address:** Docker Compose deployment phase — establish this pattern in the base Dockerfile before adding any further env config complexity.

---

### Pitfall 2: `depends_on` Without `condition: service_healthy` Causes Race Conditions on Container Start

**What goes wrong:**
`depends_on: postgres` in Docker Compose only waits for the Postgres container to start — not for PostgreSQL the service inside it to be ready to accept connections. Orbitl's web and daemon containers both run `drizzle-kit migrate` or attempt DB connections immediately on startup. If they start before PostgreSQL is ready, they crash, and Docker Compose does not automatically restart them in the right order.

**Why it happens:**
This is Docker Compose's documented default behavior that is widely misunderstood. Many tutorials show `depends_on` without the `condition` clause, making it look complete.

**How to avoid:**
Use `condition: service_healthy` paired with a `healthcheck` on the Postgres service:
```yaml
postgres:
  image: postgres:16
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
    interval: 5s
    timeout: 5s
    retries: 10
    start_period: 10s

web:
  depends_on:
    postgres:
      condition: service_healthy
```

**Warning signs:**
- Web or daemon container exits with a DB connection error on first `docker compose up`.
- Works locally on fast machines but fails on CI where startup is slower.
- Compose output shows the web container starting before postgres logs show "ready to accept connections."

**Phase to address:** Docker Compose deployment phase — must be in the initial Compose file, not retrofitted.

---

### Pitfall 3: The Job Scripts (`publish.ts`, `research.ts`) Do Not Close the Database Connection Pool

**What goes wrong:**
Short-lived job scripts that run and exit (Kubernetes CronJobs, one-shot scripts) share the same `Pool` singleton from `src/db/client.ts`. When the script's `main()` function resolves, the Node.js process stays alive indefinitely because the pool holds open TCP connections to PostgreSQL. This is confirmed in the existing codebase: `publish.ts` and `research.ts` call `process.exit(0)` as a workaround — a hard exit that skips cleanup. Hard exits in Kubernetes CronJob pods can leave PostgreSQL backend processes in an idle/terminated state, leaking connections on the server side.

**Why it happens:**
The `Pool` singleton was designed for a long-running web server where connections stay open for the life of the process. Job scripts share that singleton without knowing they need to drain it. The node-postgres documentation states explicitly: call `pool.end()` at the end of a script — this drains the pool, disconnects all clients, and shuts down internal timers so the process exits cleanly.

**How to avoid:**
Each job entry point must call `pool.end()` (or `db.$client.end()` via the Drizzle pool accessor) in a `finally` block before exiting:
```typescript
async function main(): Promise<void> {
  try {
    await runPublishQueue();
  } finally {
    await pool.end(); // drain connections, allow clean exit
  }
}
```
The `db.ts` module should export the `pool` alongside `db` so job scripts can call `pool.end()` without reaching into internals.

**Warning signs:**
- Job scripts require `process.exit(0)` to terminate.
- `pg` connection count on the PostgreSQL server climbs after each CronJob run.
- Kubernetes pods for CronJobs show `OOMKilled` or hang after the task logic completes.

**Phase to address:** Cleanup / known issues phase — this is already identified in CONCERNS.md and must be the first thing addressed before containerizing jobs.

---

### Pitfall 4: Plugin Interface Versioning — Breaking Changes Kill Contributed Providers on Upgrade

**What goes wrong:**
The drop-in provider pattern works well for the first release. On the second release, the host app adds a required field to the `PublisherProvider` or `ResearchAdapter` interface (e.g., adds `healthCheck(): Promise<boolean>` for the UI). Every community-contributed provider that doesn't implement the new method now fails at runtime with a cryptic `TypeError: provider.healthCheck is not a function`. Contributors have no way to know the interface changed. This is a common failure mode in plugin-based open-source tools — the host app evolves faster than contributors track it.

**Why it happens:**
Interface contracts in TypeScript only exist at compile time. At runtime, nothing enforces that a dynamically loaded provider module implements every method of the interface. Auto-discovery via filesystem glob means providers are loaded at startup without validation, so errors surface at the worst possible time: when a publish is attempted, not when the server starts.

**How to avoid:**
- Add a provider validation step in the auto-discovery loader that checks each loaded module against the required interface at startup, with a clear error message listing which methods are missing: `Provider 'my-platform' is missing required method: healthCheck`.
- Include a `version` field in the provider manifest or export (e.g., `export const PROVIDER_API_VERSION = 1`) and reject providers that declare an incompatible version.
- Treat the provider interface as a public API: version it, document changes, and use an additive-only approach (never remove required methods, only add optional ones with defaults).
- Ship a `provider-contract.test.ts` test file that contributors can run against their implementation to verify compliance before submitting.

**Warning signs:**
- The first time a method is added to the provider interface, existing providers are not updated.
- No runtime validation of loaded providers exists in the auto-discovery code.
- No `PROVIDER_API_VERSION` constant or similar compatibility guard.

**Phase to address:** Plugin system refactor phase — the validation layer must be built into the initial auto-discovery implementation, not added later.

---

### Pitfall 5: Daemon Has No Graceful Shutdown — SIGTERM from Kubernetes Kills In-Flight Publishes

**What goes wrong:**
The daemon (`src/daemon/index.ts`) uses `node-cron` to run a tick every minute. When Kubernetes terminates the pod (rolling update, scale-down, node eviction), it sends `SIGTERM`. Node.js will exit after the configured `terminationGracePeriodSeconds`. If a publish tick is in progress — writing to `publishQueue` status, calling Substack or LinkedIn APIs — the process is killed mid-operation. The queue item is left in `publishing` status indefinitely (the stuck-item bug already noted in CONCERNS.md), requiring manual recovery.

**Why it happens:**
The cron tick starts but the daemon has no `process.on('SIGTERM')` handler. Kubernetes treats the process as stopped once it exits, regardless of whether cleanup ran. Compounding this: if the daemon is run via `npm start` or similar, npm itself may exit before Node.js can finish cleanup, immediately triggering SIGKILL on the child process.

**How to avoid:**
Add a SIGTERM handler that:
1. Stops accepting new cron ticks (set a `isShuttingDown` flag).
2. Waits for the current `tick()` promise to resolve.
3. Closes the DB pool.
4. Exits cleanly.

Run the daemon directly as `node dist/daemon/index.js` (not via npm/yarn) so signals propagate correctly to the Node.js process.

```typescript
let isShuttingDown = false;

process.on('SIGTERM', async () => {
  isShuttingDown = true;
  // wait for current tick if running, then exit
  if (isProcessing) {
    const waitForTick = setInterval(() => {
      if (!isProcessing) {
        clearInterval(waitForTick);
        pool.end().then(() => process.exit(0));
      }
    }, 500);
  } else {
    await pool.end();
    process.exit(0);
  }
});
```

**Warning signs:**
- Daemon container image entrypoint is `npm start` or `yarn start` rather than directly invoking the compiled JS.
- No `process.on('SIGTERM')` handler in `daemon/index.ts`.
- Queue items occasionally appear stuck in `publishing` status after pod restarts.

**Phase to address:** Docker / daemon phase — before deploying to any container environment.

---

### Pitfall 6: Stuck Items in `publishing` Status With No Recovery Mechanism

**What goes wrong:**
The queue-runner's inner `catch` block already logs: "item may be stuck" (line 98-103 of `queue-runner.ts`). If the DB update to set retry state fails, the item is frozen in `publishing` status. Nothing ever resets it. The queue-runner's `WHERE status = 'queued'` query skips stuck items permanently. Manual DB intervention is required.

**Why it happens:**
Error handling for the error handler is skipped (the outer try/catch catches the publish failure; the inner try/catch catches the retry-update failure but has no further recovery). This is a known gap explicitly called out in CONCERNS.md.

**How to avoid:**
Add a recovery query at the top of each `runPublishQueue()` call that resets any items stuck in `publishing` for longer than a configurable timeout window (e.g., 30 minutes):
```typescript
await db
  .update(publishQueue)
  .set({ status: 'queued', errorMessage: 'Reset after stuck timeout' })
  .where(
    and(
      eq(publishQueue.status, 'publishing'),
      lte(publishQueue.updatedAt, new Date(Date.now() - STUCK_TIMEOUT_MS))
    )
  );
```
This should be idempotent and run before the main item selection query.

**Warning signs:**
- Queue items in `publishing` status that are hours or days old.
- Items disappear from the queue UI without a `published` or `failed` record.
- Manual `UPDATE publish_queue SET status = 'queued'` commands appear in runbooks.

**Phase to address:** Cleanup / known issues phase — implement alongside the DB connection cleanup fix.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| In-memory `isProcessing` flag for daemon concurrency | Simple, zero dependencies | Breaks with multiple pods; state lost on crash | Only acceptable while guaranteed single-instance; must be replaced before any horizontal scaling |
| `process.exit(0)` in job scripts to force termination | Script exits reliably | Skips DB cleanup, leaks server-side connections, masks bugs | Never — replace with `pool.end()` + clean exit |
| Hardcoded platform dispatch in queue-runner (`if substack... else if linkedin`) | Simple to read | Every new provider requires modifying core queue-runner logic | Never — this is exactly what the plugin system refactor fixes |
| `max: 10` DB pool ceiling in `client.ts` | Prevents resource exhaustion | Pool exhaustion under moderate load (3-4 research adapters + API requests) | Acceptable at MVP scale; must be monitored and raised with observability in place |
| Console.log-based logging throughout | Zero setup | Unstructured, unsearchable in production; no log levels or correlation IDs | Acceptable until containerized; structured logs (JSON) are required before deploying to any environment where logs are aggregated |
| Hardcoded Anthropic pricing in `audit.ts` | Simple cost tracking | Cost estimates become wrong after any pricing change | Never acceptable for anything shown to users; move to config file immediately |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| LinkedIn API | Using access tokens that expire without a refresh mechanism; tokens fail silently and publishing succeeds from the app's perspective until the next run | Store token expiry alongside credentials; add a pre-publish token validation step; surface credential expiry warnings in the UI before publish fails |
| Substack API (`substack-api` package) | Assuming `article` content type works — the package only supports Notes; articles require the private API | Document clearly in provider: only `contentType: 'note'` is supported; throw immediately with a descriptive message for `article` (already done) |
| PostgreSQL via `pg` pool | Acquiring a client with `pool.connect()` and not releasing it in a `finally` block leaks the connection permanently | Prefer `pool.query()` for simple queries (no manual release needed); for transactions, always use `try/finally { client.release() }` |
| Exa research API | No pinned version in `package.json`; Exa-js v2.5.0 may become unsupported | Pin the version; add a vendor abstraction layer (`search-adapter.ts`) so swapping providers does not require changes to calling code |
| Anthropic Claude API | Hardcoding model versions that may be deprecated; no per-channel model override | Store model preference in `channels.generationConfig` JSONB; allow override without code changes |
| Docker + NEXT_PUBLIC_ env vars | Setting `NEXT_PUBLIC_API_URL` in `docker-compose.yml` environment block expecting it to work at runtime | Only non-`NEXT_PUBLIC_` vars can be overridden at runtime; use server components or API routes to read and proxy config to client |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full-table scan on drafts/queue pages | Page load slows progressively as data grows; high DB CPU on every page view | Add cursor-based pagination with `LIMIT`/`OFFSET` and DB indexes on `status`, `scheduledFor`, `createdAt` | At ~500 drafts per channel; sooner on slower hardware |
| Client-side filtering of all drafts in `useMemo` | UI freezes on every filter interaction; large JS heap | Move filtering to server via URL query params; fetch only filtered results | At ~200 draft records in state |
| All four research adapters running in parallel with no rate limiting | 429 responses from Exa (rate-limited to ~500 req/month); Reddit fetch failures | Add per-adapter request budgeting; prioritize adapters; cache results with TTL | At first production run if Exa budget is tight |
| DB pool exhaustion under concurrent load | Requests hang indefinitely; pool wait queue grows; `pg` connection timeout errors | Monitor active connections; set pool `max` to 25-50; add connection pool monitoring | At 3-4 concurrent research jobs + active API traffic |
| ISR/filesystem cache not shared between multiple Next.js pod replicas | Stale data served from one pod; cache misses on another pod | Configure a custom `cacheHandler` pointing to Redis or shared storage if ever running multiple web pods | The moment a second web pod is deployed |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| All API routes (`/api/**`) lack authentication | Anyone with network access can trigger expensive AI operations, read all content, modify queue | Add auth middleware before this ships to any environment accessible beyond localhost; NextAuth or custom JWT |
| Single `CREDENTIALS_ENCRYPTION_KEY` with no rotation mechanism | Key compromise exposes all stored platform tokens | Implement versioned key identifiers stored alongside ciphertext; plan a rotation script; consider external secret management |
| Raw prompt/response text in AI audit logs | If audit log DB is exposed, proprietary content and user writing samples are leaked | Store only metadata (token count, model, operation type); never store prompt or response text |
| Provider plugin loaded from filesystem without validation | A maliciously crafted provider module could execute arbitrary code at startup | Validate provider module exports against the interface contract immediately after load; do not execute any provider code before validation; sandbox is not available in Node.js without significant complexity, so strict directory enforcement and interface checking is the practical defense |
| LinkedIn credentials parsed with `typeof` checks rather than schema validation | Malformed credentials crash at runtime with unhelpful errors | Use `zod` schema validation for all credential parsing in all providers; throw descriptive errors before any API call |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent failure when a research adapter returns empty results | User sees no content opportunities with no explanation; assumes the product is broken | Show per-adapter success/failure status in the UI; distinguish "no results found" from "adapter failed with error X" |
| No credential validation feedback before publishing | User configures a channel with bad credentials, approves a draft, waits 24 hours, gets a failure with no actionable message | Add a "test connection" action when saving channel credentials; validate credentials are decryptable and the platform API responds before saving |
| No draft version history | User rejects a draft and cannot recover it; accidental rejections are permanent | Soft-delete drafts; keep `draft_versions` table; show "restore previous version" in the review UI |
| Timezone bug in scheduler shows wrong publish times | User sees a scheduled time that does not match what actually publishes | Fix server-local-time bug in `scheduler.ts` (CONCERNS.md) before shipping publish scheduling to any user |
| First-run experience requires manual DB setup, env file configuration, and migration run with no guidance | Contributors and self-hosters give up before seeing the product work | `docker compose up` must work with a single command; seed data or a clear first-run wizard; `.env.example` with every required variable documented |

---

## "Looks Done But Isn't" Checklist

- [ ] **Plugin auto-discovery**: Provider files are loaded but are they validated against the interface contract at startup? Without runtime validation, a mis-implemented provider silently fails at publish time.
- [ ] **Docker Compose**: Does `docker compose up` complete without errors on a fresh clone with a populated `.env`? Test on a machine where no local Postgres or Node is installed.
- [ ] **DB connection cleanup**: Do job scripts (`publish.ts`, `research.ts`) exit without `process.exit(0)`? Run them and watch if the process hangs — if it does, pool cleanup is missing.
- [ ] **Stuck item recovery**: Does `runPublishQueue()` reset `publishing` items older than the timeout window at the start of each run? Check for items with `status = 'publishing'` and `updated_at` > 30 minutes ago in a test run where the DB update is killed mid-flight.
- [ ] **Daemon graceful shutdown**: Does the daemon container respond to `docker stop` (SIGTERM) within 10 seconds without leaving DB connections open? Test by running `docker stop` during an active publish tick.
- [ ] **SIGTERM propagation**: Is the daemon Dockerfile entrypoint `CMD ["node", "dist/daemon/index.js"]` (direct, receives signals) rather than `CMD ["npm", "start"]` (npm swallows signals)?
- [ ] **Helm secrets**: Are Kubernetes `Secret` objects used for `DATABASE_URL`, `CREDENTIALS_ENCRYPTION_KEY`, and `ANTHROPIC_API_KEY`? None of these should appear in `values.yaml` or committed chart files.
- [ ] **Health checks**: Do the web and daemon Kubernetes deployments define `livenessProbe` and `readinessProbe`? Without them, Kubernetes cannot detect a hung pod and will not restart it.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| NEXT_PUBLIC_ values wrong in deployed image | HIGH | Rebuild and redeploy Docker image with correct build args; no config-only fix possible |
| DB connection leak from job scripts | LOW | Drain idle connections with `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle'`; fix code and redeploy |
| Stuck `publishing` queue items | LOW | `UPDATE publish_queue SET status = 'queued' WHERE status = 'publishing' AND updated_at < NOW() - INTERVAL '1 hour'`; items will retry on next tick |
| Plugin interface breaking change breaks contributed providers | MEDIUM | Pin the old interface in a compat shim; bump `PROVIDER_API_VERSION`; issue a migration guide; accept both old and new interface shapes during transition period |
| Daemon killed mid-publish by SIGTERM | LOW | Stuck-item recovery query (above) resets the item; it will republish on next tick — check for duplicate posts on the platform |
| Pool exhaustion under load | MEDIUM | Increase `max` in pool config and restart; add read replica to offload query load; add connection monitoring to catch this before production |
| Credentials encryption key compromise | HIGH | Rotate key, re-encrypt all stored credentials, revoke and re-issue all platform tokens, audit access logs |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| NEXT_PUBLIC_ baked at build time | Docker Compose deployment | Deploy image with different env; confirm browser uses runtime value |
| `depends_on` without health check | Docker Compose deployment | `docker compose up` from scratch on slow CI; verify no startup-race errors |
| DB connection leak in job scripts | Cleanup / known issues (before containerizing) | Run `publish.ts` without `process.exit`; confirm process exits in < 5s |
| Plugin interface breaking changes | Plugin system refactor | Add runtime validation test; run against a provider missing a method |
| Daemon SIGTERM not handled | Docker / daemon Dockerfile phase | `docker stop` during active tick; verify clean exit and no stuck queue items |
| Stuck `publishing` items | Cleanup / known issues | Simulate DB failure mid-publish; verify recovery query resets item on next run |
| Credentials parsed without schema validation | Plugin system refactor (provider interface spec) | Pass malformed credentials JSON; verify descriptive error, no crash |
| Timezone bug in scheduler | Cleanup / known issues | Configure channel in non-server timezone; verify publish fires at correct wall-clock time |
| No auth on API routes | Cleanup / known issues (security hardening) | `curl` unauthenticated against `/api/channels`; should return 401 |
| Helm secrets in values.yaml | Helm chart phase | `grep -r "password\|secret\|key" helm/values.yaml`; should return nothing sensitive |

---

## Sources

- Next.js Self-Hosting Official Documentation (verified current, 2026-02-24): https://nextjs.org/docs/app/guides/self-hosting
- Next.js Deploying Official Documentation: https://nextjs.org/docs/app/getting-started/deploying
- Next.js GitHub Discussions — NEXT_PUBLIC_ runtime env vars: https://github.com/vercel/next.js/discussions/17641
- Next.js GitHub Discussions — Docker runtime env: https://github.com/vercel/next.js/discussions/39080
- Docker Compose startup ordering: https://docs.docker.com/compose/how-tos/startup-order/
- Docker Compose health check with depends_on: https://oneuptime.com/blog/post/2026-01-16-docker-compose-depends-on-healthcheck/view
- node-postgres Pool documentation: https://node-postgres.com/apis/pool and https://node-postgres.com/features/pooling
- node-postgres connection leak issues: https://github.com/brianc/node-postgres/issues/1882
- Node.js graceful shutdown with SIGTERM: https://blog.risingstack.com/graceful-shutdown-node-js-kubernetes/
- Node.js Docker signal handling best practices: https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/docker/graceful-shutdown.md
- Helm secrets management: https://cycode.com/blog/helm-secret-scanning/
- Helm chart best practices: https://www.baeldung.com/ops/helm-charts-best-practices
- Drizzle ORM common mistakes: https://medium.com/@lior_amsalem/3-biggest-mistakes-with-drizzle-orm-1327e2531aff
- PostgreSQL zero-downtime migrations: https://xata.io/blog/zero-downtime-schema-migrations-postgresql
- TypeScript plugin interface versioning: https://www.semver-ts.org/
- Orbitl CONCERNS.md codebase audit: .planning/codebase/CONCERNS.md (HIGH confidence — direct code analysis)
- Orbitl queue-runner.ts direct analysis: .worktrees/build/src/lib/publishing/queue-runner.ts
- Orbitl daemon/index.ts direct analysis: .worktrees/build/src/daemon/index.ts
- Orbitl jobs/publish.ts direct analysis: .worktrees/build/src/jobs/publish.ts
- Orbitl db/client.ts direct analysis: .worktrees/build/src/db/client.ts

---
*Pitfalls research for: open-source self-hosted content generation/publishing automation — plugin system, Docker/Helm deployment, UI polish milestone*
*Researched: 2026-02-26*
