# Technology Stack

**Analysis Date:** 2026-02-26

## Languages

**Primary:**
- TypeScript 5 - Full codebase (frontend, API routes, backend workers, database)
- JavaScript (JSX/TSX) - React components and Next.js pages

**Secondary:**
- SQL - Database schema via Drizzle ORM
- Bash - Configuration scripts

## Runtime

**Environment:**
- Node.js 20 (specified via tsconfig.json ES2017 target, tested with package-lock.json)

**Package Manager:**
- npm (v10+)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack web framework (API routes, server components, build)
- React 19.2.3 - UI library
- React DOM 19.2.3 - DOM rendering

**Database & ORM:**
- Drizzle ORM 0.45.1 - Type-safe database query builder
- Drizzle Kit 0.31.9 - Database migrations and studio
- PostgreSQL (pg 8.19.0) - Primary database

**UI & Styling:**
- Tailwind CSS 4 - Utility-first CSS framework
- @tailwindcss/postcss 4 - PostCSS plugin
- Radix UI Components (multiple) - Accessible component primitives
  - @radix-ui/react-dialog 1.1.15
  - @radix-ui/react-label 2.1.8
  - @radix-ui/react-select 2.2.6
  - @radix-ui/react-slot 1.2.4
  - @radix-ui/react-tabs 1.1.13
- lucide-react 0.575.0 - Icon library

**Forms:**
- react-hook-form 7.71.2 - Form state management
- @hookform/resolvers 5.2.2 - Validation adapters
- class-variance-authority 0.7.1 - Component variant utilities
- clsx 2.1.1 - Conditional class names
- tailwind-merge 3.5.0 - Merge conflicting Tailwind classes
- zod 3.25.76 - TypeScript-first schema validation

**Testing:**
- Vitest 4.0.18 - Test framework (vite-native)
- vite-tsconfig-paths 6.1.1 - Path alias resolution in tests

**Build & Development:**
- TypeScript 5 - Language compiler
- ESLint 9 - Linting
- eslint-config-next 16.1.6 - Next.js ESLint config
- PostCSS 4 (via postcss.config.mjs) - CSS processing
- concurrently 9.2.1 - Run multiple npm scripts

**Task Running:**
- tsx 4.21.0 - Execute TypeScript files directly (for background jobs and migrations)
- node-cron 4.2.1 - Scheduled task execution

## Key Dependencies

**Critical:**
- @anthropic-ai/sdk 0.78.0 - Claude AI API integration (generation, analysis, brainstorming)
- exa-js 2.5.0 - Web search API for research
- substack-api 2.2.1 - Substack Note publication (note-only, not articles)
- rss-parser 3.13.0 - RSS/Atom feed parsing for Substack monitoring
- drizzle-orm + pg - Database persistence

**Infrastructure:**
- node-cron 4.2.1 - Background job scheduling
- crypto (built-in) - AES-256-GCM encryption for stored credentials

## Configuration

**Environment:**
- `.env.local` (development) or `.env` (production)
- Managed with `.env.example` as template

**Build:**
- `next.config.ts` - Next.js configuration (minimal)
- `tsconfig.json` - TypeScript configuration
  - Path alias: `@/*` → `./src/*`
- `eslint.config.mjs` - ESLint configuration
- `postcss.config.mjs` - PostCSS configuration
- `drizzle.config.ts` - Database configuration
- `vitest.config.ts` - Test configuration
- `components.json` - Shadcn/ui component library config

## Platform Requirements

**Development:**
- Node.js 20+
- npm 10+
- PostgreSQL 12+ (local or remote)
- OpenSSL (for encryption key generation)

**Production:**
- Node.js 20+
- PostgreSQL 12+ (managed or self-hosted)
- Environment variables for all API keys and credentials

## Key Scripts

**Development:**
```bash
npm run dev          # Start Next.js dev server on port 3021
npm run dev:daemon   # Start background daemon (research + publishing)
npm run dev:all      # Run both concurrently
```

**Database:**
```bash
npm run db:generate  # Generate migrations from schema
npm run db:migrate   # Apply migrations
npm run db:studio    # Open Drizzle Studio
```

**Jobs:**
```bash
npm run job:publish  # Run publish queue worker
npm run job:research # Run research job
```

**Testing:**
```bash
npm run test         # Run vitest once
npm run test:watch   # Run vitest in watch mode
```

**Build:**
```bash
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

---

*Stack analysis: 2026-02-26*
