# Destink

A self-hosted, AI-powered content publishing platform. Destink automates the full content pipeline — research, writing, review, and publishing — so creators can maintain a consistent voice across platforms without the manual grind.

## What it does

Destink acts as an automated content agency. You configure your writing voice, pick your topics, and connect your publishing accounts. The system handles the rest:

- **Multi-source research** — Pulls trends and ideas from web search (Exa), Reddit, Substack, and AI brainstorming
- **Voice analysis** — Learns your writing style from samples, archives, or a guided wizard, then generates content that sounds like you
- **AI draft generation** — Produces notes and articles using Claude, scored with a voice confidence rating
- **Review workflow** — Approve, reject, or regenerate drafts before anything goes live
- **Scheduled publishing** — Queue posts with a timeline view and automatic publishing to Substack and LinkedIn
- **Pluggable providers** — Add new platforms or research sources without touching core logic
- **AI cost tracking** — Full audit log of token usage and costs per operation

### Tech stack

Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, Drizzle ORM, Claude API (Anthropic)

## Getting started

### 1. Clone the repo

```bash
git clone https://github.com/dest-ink/destink.git
cd destink
```

### 2. Configure environment

```bash
cp .env.example .env
```

Generate the required secrets:

```bash
# Encryption key (32-byte hex)
openssl rand -hex 32

# Auth secret
openssl rand -base64 33
```

Fill in your API keys and secrets in `.env`. At minimum you need an Anthropic API key. Exa is required for research; Reddit and LinkedIn API keys are optional.

### 3. Run with Docker Compose

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up -d
```

This starts PostgreSQL, runs migrations, and launches the web app and daemon. The app is available at `http://localhost:3000`.

On first launch, the app will automatically redirect you to a setup page where you can create your account.

`docker-compose.yml` is gitignored so you can customize ports and services without creating diffs.

## Kubernetes (Helm)

A Helm chart is included at `deploy/helm/destink/` for deploying to any Kubernetes cluster. The full walkthrough is in [docs/k3s-deployment.md](docs/k3s-deployment.md).

### Quick start

**1. Build the images:**

```bash
docker build -f docker/Dockerfile.web -t destink-web:0.1.0 .
docker build -f docker/Dockerfile.daemon -t destink-daemon:0.1.0 .
docker build -f docker/Dockerfile.jobs -t destink-jobs:0.1.0 .
```

**2. Create a values file with your configuration:**

```bash
cp deploy/helm/destink/values.yaml my-values.yaml
```

Edit `my-values.yaml` to set your image tags, domain, and API keys. At minimum:

```yaml
ingress:
  enabled: true
  host: "your-domain.com"

env:
  ANTHROPIC_API_KEY: "sk-ant-..."
  ENCRYPTION_KEY: ""      # openssl rand -hex 32
  AUTH_SECRET: ""          # openssl rand -base64 33
  EXA_API_KEY: ""
  NEXT_PUBLIC_APP_URL: "https://your-domain.com"
```

**3. Deploy:**

```bash
kubectl create namespace destink
helm install destink deploy/helm/destink \
  --namespace destink \
  -f my-values.yaml
```

Helm runs database migrations automatically before starting the services.

**4. Verify:**

```bash
kubectl -n destink get pods
kubectl -n destink port-forward svc/destink-web 3000:80
curl http://localhost:3000/api/health
```

The chart includes bundled PostgreSQL (disable with `postgresql.enabled: false` and set `externalDatabase.url`), optional TLS via cert-manager, and CronJobs for scheduled research and publishing. See [docs/k3s-deployment.md](docs/k3s-deployment.md) for the full guide including TLS setup, upgrades, and troubleshooting.

## Contributing

### Prerequisites

- Node.js 22+
- PostgreSQL 17

### Setup

1. Fork and clone the repo
2. `cp .env.example .env` and fill in your keys
3. `cp docker-compose.example.yml docker-compose.yml`
4. `pnpm install`
5. `docker compose up -d postgres` to start the database
6. `pnpm db:migrate` to run migrations
7. `pnpm dev:all` to start the app

### Development workflow

- `pnpm dev` — Next.js dev server only
- `pnpm dev:daemon` — Background daemon only
- `pnpm dev:all` — Both together
- `pnpm test` — Run tests
- `pnpm lint` — Lint
- `pnpm db:generate` — Generate a new migration after schema changes
- `pnpm db:studio` — Open Drizzle Studio to browse the database

### Architecture

The codebase is organized around a pluggable provider system:

- **Research adapters** (`src/lib/research/adapters/`) — Each adapter fetches content from a source (Exa, Reddit, Substack, AI brainstorm). Adding a new source means adding a new adapter file and registering it.
- **Publishing providers** (`src/lib/publishing/providers/`) — Each provider handles publishing to a platform (Substack, LinkedIn). Providers define their own credential schema, formatting rules, and publish logic.
- **Generation pipeline** (`src/lib/generation/`) — Platform-agnostic draft generation. The generator receives formatting instructions from the provider, not hardcoded platform knowledge.

### Guidelines

- Keep provider-specific logic inside the provider plugin. The core pipeline should not contain platform-specific code.
- Run `pnpm test` and `npx tsc --noEmit` before submitting a PR.
- One concern per PR. Bug fixes, features, and refactors should be separate.

## License

MIT
