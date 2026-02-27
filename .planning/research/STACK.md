# Stack Research

**Domain:** Pluggable provider systems and containerized deployment for TypeScript/Next.js content generation app
**Researched:** 2026-02-26
**Confidence:** MEDIUM-HIGH (core patterns HIGH from official docs; Helm/k3s patterns MEDIUM from web sources)

---

## Context

This is a subsequent-milestone research file. The existing app already has:
Next.js 16.1.6, TypeScript 5, Drizzle ORM 0.45.1, PostgreSQL (pg 8.19.0), Tailwind CSS 4, Radix UI, Zod 3.25.x, Vitest, tsx, node-cron, Anthropic SDK.

This research covers only the **new additions** needed for:
1. A pluggable provider/plugin system (publisher + research adapter modules)
2. Containerized deployment (Docker Compose for solo creators; Helm chart for k3s scaling)

Do not re-evaluate the existing stack. The existing choices are locked.

---

## Recommended Stack

### Plugin System — Core Pattern

**Verdict: Use a hand-rolled TypeScript interface + registry + filesystem scan pattern. No external plugin framework needed.**

The 2025/2026 standard for TypeScript/Node.js plugin systems in apps of this scale is to implement the pattern directly using TypeScript interfaces, a central registry, and `fs.readdirSync` + dynamic `import()` for auto-discovery. Third-party plugin frameworks (Plugo, Plop, etc.) add complexity and maintenance overhead without benefit at this codebase size.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript `interface` + `satisfies` | 5.x (existing) | Define the provider contract | `satisfies` operator (TS 4.9+) catches contract violations at assignment site without widening the type — better error messages than `as` casts |
| `fs.readdirSync` (Node.js built-in) | 20.x (existing) | Scan providers directory at startup | Zero dependency; synchronous scan is fine at startup; no library needed |
| Dynamic `import()` (ESM / CommonJS interop) | Node.js 20 | Load discovered provider modules | Native to Node 20 + TypeScript 5; works in both ESM and CJS contexts |
| Zod 3.25.x (existing) | 3.25.x | Validate provider manifest/config objects at runtime | Already in the project; use to validate the config shape each provider exports, ensuring drop-in modules are well-formed |

**Pattern summary** (confidence: HIGH — confirmed by official TypeScript docs, Node.js docs, and Slash Engineering production example):

```typescript
// src/lib/providers/types.ts
export interface PublisherProvider {
  readonly id: string;           // e.g., "substack", "linkedin"
  readonly displayName: string;
  readonly configSchema: z.ZodSchema;  // Zod schema for channel credentials
  publish(draft: DraftRow, channel: ChannelRow): Promise<PublishResult>;
}

// src/lib/providers/registry.ts
export class ProviderRegistry<T extends { id: string }> {
  private providers = new Map<string, T>();

  register(provider: T): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): T | undefined {
    return this.providers.get(id);
  }

  all(): T[] {
    return [...this.providers.values()];
  }
}

// src/lib/providers/loader.ts — auto-discovery
import { readdirSync } from 'fs';
import { join } from 'path';

export async function loadProviders<T extends { id: string }>(
  dir: string,
  registry: ProviderRegistry<T>,
): Promise<void> {
  const files = readdirSync(dir).filter(f => f.endsWith('.provider.ts') || f.endsWith('.provider.js'));
  for (const file of files) {
    const mod = await import(join(dir, file));
    if (mod.default && 'id' in mod.default) {
      registry.register(mod.default);
    }
  }
}

// src/lib/publishers/substack.provider.ts — drop-in file
const substackProvider = {
  id: 'substack',
  displayName: 'Substack',
  configSchema: substackConfigSchema,
  async publish(draft, channel) { /* ... */ },
} satisfies PublisherProvider;

export default substackProvider;
```

**Key decisions:**
- Use `.provider.ts` file suffix convention so the scanner can find only provider files
- `satisfies` instead of explicit type annotation — catches missing fields at the definition site
- Registry is initialized once at app startup (in the daemon's main entry, and lazily in Next.js API routes via a module-level singleton)
- No code in existing files needs changing to add a new provider — drop the file, done

### Plugin System — No External Libraries Needed

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `plugo`, `live-plugin-manager`, `@node-loader/core` | Add dynamic module loading complexity, npm unpacking overhead, not maintained at scale | Native `import()` + directory scan |
| `tsyringe`, `inversify` (DI containers) | Overkill — you don't need dependency injection; you need a simple named registry | Plain `Map<string, Provider>` registry |
| npm-based plugin discovery (reading package.json for plugin keys) | Only needed when plugins are distributed as separate npm packages; Orbitl providers live in the same repo | Filesystem scan of `src/lib/publishers/` |

### Containerization — Docker

**Verdict: Two Dockerfiles (web + daemon), one Docker Compose, `node:22-bookworm-slim` base image, Next.js `output: standalone`.**

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Docker multi-stage build | N/A (Docker feature) | Separate build-time deps from runtime image | Official Next.js and Node.js recommendation; reduces final image by 60-80% |
| `node:22-bookworm-slim` | 22.x LTS | Base image for both web and daemon containers | Slim = Debian-based (glibc-compatible, avoids Alpine musl issues with native modules), smaller than full Debian. Alpine explicitly NOT recommended by Node.js Docker team |
| `output: standalone` (Next.js config) | Built into Next.js 16 | Produces `.next/standalone` with only necessary files + `server.js` | Official Next.js recommendation for Docker; eliminates `npm install` in the runner stage; verified in Next.js 16.1.6 docs |
| Docker Compose v2 | 2.x | Orchestrate web + daemon + postgres services | Standard single-machine orchestration; ships with Docker Desktop and Docker Engine |
| `.dockerignore` | N/A | Exclude `node_modules`, `.next`, `.env.*`, test files from build context | Mandatory for fast builds and preventing secret leakage |

**Dockerfile.web** (multi-stage pattern — confidence: HIGH from official Next.js docs and Vercel with-docker example):

```dockerfile
# Stage 1: Install dependencies
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Runtime (uses standalone output)
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

**Dockerfile.daemon** (TypeScript background worker — confidence: MEDIUM from community patterns, verified with Node docs):

```dockerfile
# Stage 1: Install dependencies
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build TypeScript
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx tsc --project tsconfig.json --outDir dist --noEmit false

# Stage 3: Runtime
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 daemon
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER daemon
CMD ["node", "dist/daemon/index.js"]
```

**Alternative daemon approach**: Skip tsc compilation in Docker, use `tsx` directly in the runner stage with `node_modules` copied. Simpler but ships tsx (dev dependency) to production. Acceptable for a self-hosted tool where image size is secondary to simplicity. Decision: **compile with tsc** to keep production image clean.

**`next.config.ts` addition required:**
```typescript
const nextConfig: NextConfig = {
  output: 'standalone',  // ADD THIS
};
```

**Important caveat** (confidence: HIGH from official Next.js docs): `output: standalone` is incompatible with a custom `server.js` entry point. The `server.js` that Next.js generates in `.next/standalone` must be used as-is. This is not a problem for Orbitl since the daemon is a separate process — there is no custom Next.js server.

### Containerization — Docker Compose

**`docker-compose.yml` service structure** (confidence: HIGH from official Docker docs and Next.js community patterns):

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: orbitl
      POSTGRES_USER: orbitl
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orbitl"]
      interval: 10s
      timeout: 5s
      retries: 5

  migrate:
    build:
      context: .
      dockerfile: Dockerfile.daemon
    command: ["node", "dist/scripts/migrate.js"]
    environment:
      DATABASE_URL: postgres://orbitl:${DB_PASSWORD}@postgres:5432/orbitl
    depends_on:
      postgres:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    ports:
      - "3021:3000"
    environment:
      DATABASE_URL: postgres://orbitl:${DB_PASSWORD}@postgres:5432/orbitl
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      CREDENTIALS_ENCRYPTION_KEY: ${CREDENTIALS_ENCRYPTION_KEY}
    depends_on:
      migrate:
        condition: service_completed_successfully

  daemon:
    build:
      context: .
      dockerfile: Dockerfile.daemon
    environment:
      DATABASE_URL: postgres://orbitl:${DB_PASSWORD}@postgres:5432/orbitl
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      EXA_API_KEY: ${EXA_API_KEY}
      CREDENTIALS_ENCRYPTION_KEY: ${CREDENTIALS_ENCRYPTION_KEY}
    depends_on:
      migrate:
        condition: service_completed_successfully

volumes:
  postgres_data:
```

**Service notes:**
- `postgres:17-alpine` is acceptable for the database (PostgreSQL Alpine images are maintained by the PostgreSQL team directly, unlike Node.js Alpine — the musl issue applies to application runtimes, not database images)
- `migrate` runs as a one-shot service (exits after applying migrations) using `service_completed_successfully` — this is the correct Drizzle migration pattern for Docker Compose
- `web` and `daemon` both depend on `migrate` completing, not just postgres being healthy
- Environment variables via `.env` file — never baked into images

### Containerization — Helm Chart (k3s / Kubernetes)

**Verdict: Write a minimal custom Helm chart. Don't use a generic community chart — they're too complex for Orbitl's simple two-container + postgres shape.**

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Helm | 3.x | Package Kubernetes manifests | Industry standard; k3s ships with Helm Controller; verified in k3s docs |
| Bitnami PostgreSQL Helm chart | 18.x (as subchart dependency) | Managed PostgreSQL in-cluster | Bitnami is the reference PostgreSQL Helm chart; avoids managing statefulsets manually; chart version 18.4.0 current as of research date |
| Custom Helm chart | — | Deploy web + daemon Deployments and Services | A custom chart keeps complexity minimal; generic Next.js charts on Artifact Hub add unnecessary layers |

**Minimum custom chart structure:**

```
charts/orbitl/
  Chart.yaml
  values.yaml
  charts/
    postgresql/        # bitnami/postgresql as dependency
  templates/
    web-deployment.yaml
    web-service.yaml
    daemon-deployment.yaml
    migrate-job.yaml   # Helm hook: post-install, post-upgrade
    ingress.yaml
    secrets.yaml       # or reference external secret
```

**`Chart.yaml` dependency:**
```yaml
dependencies:
  - name: postgresql
    version: "18.x.x"
    repository: "oci://registry-1.docker.io/bitnamicharts"
    condition: postgresql.enabled
```

**Key Helm patterns** (confidence: MEDIUM — verified k3s Helm Controller docs + bitnami docs, community chart examples):
- Database migration as a Helm hook (`helm.sh/hook: post-install,post-upgrade`) ensures migrations run before rolling out new pods
- `values.yaml` exposes `image.tag`, `replicaCount`, `postgresql.enabled`, and `ingress.enabled` as the primary knobs
- Secrets managed via `secretRef` in pod specs pointing to a Kubernetes Secret — do not embed secrets in values files

**What NOT to do with Helm:**
- Do not use the generic `icoretech/nextjs` chart from Artifact Hub — it assumes a specific structure and adds ingress annotations that may conflict with k3s Traefik
- Do not put `CREDENTIALS_ENCRYPTION_KEY` or `ANTHROPIC_API_KEY` in `values.yaml` — use `kubectl create secret` and reference via `secretKeyRef`

### Supporting Libraries — New Additions Only

These libraries are **not currently in the project** and would be added for the new milestone:

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fast-glob` | 3.3.x | Glob-based provider file discovery (alternative to `readdirSync`) | If providers need to be discovered across multiple directories or match complex patterns. If providers stay in a single flat directory, `readdirSync` is sufficient and has no extra dependency |
| `@types/node` | 20.x (dev) | Type definitions for `fs`, `path`, `process` in provider loader | Required if not already present; check `package.json` |

**No new libraries are required for the provider system itself.** The pattern is implemented with what already exists (TypeScript, Zod, Node.js built-ins).

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Hand-rolled registry + `fs.readdirSync` | `inversify` DI container | Inversion of control is unnecessary when providers are loaded at startup, not injected throughout the app. Adds decorator metadata complexity with `reflect-metadata`. Overkill for a flat list of named providers. |
| Hand-rolled registry | `plugo` / `live-plugin-manager` | These load plugins from npm packages at runtime. Orbitl providers live in the same repo — no npm distribution needed. Adds unnecessary complexity. |
| `node:22-bookworm-slim` Docker base | `node:22-alpine` | Alpine uses musl libc. The Node.js Docker team explicitly does not officially support Alpine. Native npm modules (like `pg`) can produce unexpected behavior. The slim Debian variant is 30% larger but fully compatible. |
| `node:22-bookworm-slim` Docker base | `node:22` (full Debian) | Full Debian is 3-4x larger (1GB+) with hundreds of unnecessary packages. No benefit over slim for a Node.js app. |
| Separate Dockerfile.daemon | Combining web and daemon in one image | Violates single-responsibility for containers; prevents independent scaling of daemon; harder to reason about container entrypoints |
| Custom Helm chart | Generic community Next.js Helm chart | Generic charts have opinions about ingress controllers, service meshes, and image pull policies that conflict with k3s defaults. A minimal custom chart gives full control at low cost (~6 template files). |
| Bitnami PostgreSQL subchart | Self-managed StatefulSet for PostgreSQL | Writing and maintaining a PostgreSQL StatefulSet from scratch is error-prone and unnecessary. Bitnami chart is battle-tested, actively maintained, and supports k3s. |
| `postgres:17-alpine` (Docker Compose) | `postgres:17` (full Debian) | PostgreSQL's Alpine image is officially maintained by the PostgreSQL Docker project (not the Node.js team). glibc issues don't apply to the database binary itself. Alpine PostgreSQL is the community standard for Docker Compose deployments. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `node:22-alpine` for web/daemon containers | musl libc causes compatibility issues with native Node.js modules (pg, sharp, etc.); Node.js Docker team does not officially support it | `node:22-bookworm-slim` |
| `output: export` (Next.js static export) | Static export removes API routes, server components, and dynamic rendering — all of which Orbitl uses | `output: standalone` |
| Embedding secrets in Docker images or Helm values files | Secrets become visible in image layers and version control | `.env` files for Docker Compose (gitignored); Kubernetes Secrets + `secretKeyRef` for Helm |
| Running migrations as part of the web container startup | Race conditions if multiple replicas start simultaneously; hard to observe migration failures separately | Dedicated `migrate` service/job that must complete before web starts |
| TypeScript decorators + `reflect-metadata` for provider registration | Requires `experimentalDecorators: true` in tsconfig; adds build complexity; TS 5.x decorator standard differs from legacy; fragile ecosystem | Plain interface + `satisfies` + registry |
| Zod 4 (`zod/v4` subpath) for provider config schemas | Zod 4 is currently at `zod/v4` subpath (not the main package); the project uses Zod 3.25.x; mixing Zod 3 and Zod 4 causes type incompatibilities | Continue using Zod 3.25.x; upgrade to Zod 4 as a separate migration after it ships as the default npm package |

---

## Stack Patterns by Variant

**If providers stay in the same repo (current plan):**
- Use filesystem scan (`readdirSync`) over `src/lib/publishers/` and `src/lib/research/`
- No npm publishing pipeline needed
- Provider files are TypeScript compiled alongside the main app

**If providers are later distributed as npm packages (future, out of scope for v1):**
- Switch to npm keyword discovery (scan `node_modules` for packages with a specific keyword in `package.json`)
- Adds a provider npm publishing workflow
- Not needed for v1

**If running a single machine (Docker Compose):**
- `docker-compose.yml` with postgres + web + daemon + migrate services
- `postgres:17-alpine` for the database
- `node:22-bookworm-slim` for web and daemon

**If scaling to a small cluster (k3s Helm):**
- Custom Helm chart with Bitnami PostgreSQL subchart
- Migrate as a Helm hook Job
- Daemon as a Deployment with `replicas: 1` (must not run multiple daemon instances — cron scheduling would fire duplicate jobs)
- Web as a Deployment with `replicas: N` (stateless, scales normally)

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `next@16.1.6` | `output: standalone` | Verified in Next.js 16.1.6 docs; `output: standalone` has been stable since Next.js 12 |
| `next@16.1.6` | Custom server incompatible with `standalone` | Official docs explicitly state `server.js` from standalone cannot be used with a custom server |
| `drizzle-kit@0.31.9` | `drizzle-orm@0.45.1` | Already validated in existing stack; migration via `drizzle-kit migrate` works as a standalone Node.js script suitable for Docker Compose `migrate` service |
| `node:22-bookworm-slim` | `pg@8.19.0` | pg uses libssl which requires glibc — confirmed incompatible with Alpine musl |
| `zod@3.25.x` | Provider config validation | Do not upgrade to Zod 4 during this milestone; Zod 4 is at `zod/v4` subpath and has breaking changes in error API, UUID, and record types |
| Helm 3.x | k3s built-in Helm Controller | k3s ships with Helm Controller that manages HelmChart CRDs; standard `helm` CLI also works directly |
| Bitnami PostgreSQL chart `18.x` | PostgreSQL 16/17 | Chart 18.x ships PostgreSQL 17 by default; can pin to 16 via `image.tag` |

---

## Installation

```bash
# No new runtime dependencies needed for the provider system itself.
# The pattern uses TypeScript interfaces, fs, path, and dynamic import — all built-in.

# Only if opting for glob-based multi-directory provider discovery:
npm install fast-glob

# Docker (not npm — install Docker Engine or Docker Desktop separately)
# https://docs.docker.com/engine/install/

# Helm (for k3s deployment)
# https://helm.sh/docs/intro/install/
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

---

## Sources

- [Next.js Deploying Docs (official, v16.1.6)](https://nextjs.org/docs/app/getting-started/deploying) — Docker deployment options confirmed; MEDIUM-HIGH confidence
- [Next.js Self-Hosting Guide (official, v16.1.6)](https://nextjs.org/docs/app/guides/self-hosting) — Environment variables, caching, multi-server notes; HIGH confidence
- [Next.js `output` config reference (official)](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output) — Standalone output mechanics, caveats; HIGH confidence
- [Vercel with-docker official example](https://github.com/vercel/next.js/tree/canary/examples/with-docker) — Confirmed multi-stage build with node:22.14-slim; HIGH confidence
- [Snyk: Choosing the best Node.js Docker image](https://snyk.io/blog/choosing-the-best-node-js-docker-image/) — node:bookworm-slim recommendation with vulnerability data; MEDIUM confidence
- [Slash Engineering: Scaling 1M lines of TypeScript — Registries](https://puzzles.slash.com/blog/scaling-1m-lines-of-typescript-registries) — Registry + discriminator + loadModules auto-discovery pattern at production scale; MEDIUM confidence
- [Bitnami PostgreSQL Helm Chart (Artifact Hub)](https://artifacthub.io/packages/helm/bitnami/postgresql) — Chart version 18.4.0 current; MEDIUM confidence
- [k3s Helm Controller docs](https://docs.k3s.io/helm) — k3s native Helm support confirmed; HIGH confidence
- [Zod v4 release notes](https://zod.dev/v4) — v4 at `zod/v4` subpath, not main package yet; HIGH confidence
- [TypeScript `satisfies` operator (TypeScript 4.9+)](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html) — Confirmed works in TS 5.x; HIGH confidence

---

*Stack research for: Orbitl — pluggable provider system and containerized deployment*
*Researched: 2026-02-26*
