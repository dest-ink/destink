---
phase: 03-authentication-ui-polish
plan: 01
subsystem: auth
tags: [next-auth, auth-js-v5, jwt, bcrypt, credentials-provider, postgres, drizzle]

requires:
  - phase: 02-pluggable-provider-system
    provides: stable Next.js app with channels/drafts/queue API routes that needed auth protection

provides:
  - users table with email + bcrypt password hash (PostgreSQL, Drizzle migration applied)
  - Auth.js v5 Credentials provider with JWT 30-day sessions
  - Edge-safe auth.config.ts with authorized callback for proxy-based route protection
  - proxy.ts: re-exports auth as proxy for Next.js 16 middleware
  - /login page: centered card layout with inline error display
  - /setup wizard: first-visit account creation, permanently locked after first user
  - SideNav logout button using next-auth/react signOut
  - All 11 API routes wrapped with auth() guard returning 401 for unauthenticated requests

affects:
  - 03-authentication-ui-polish (remaining plans use session data)
  - Any plan adding new API routes (must follow auth() wrapper pattern)

tech-stack:
  added:
    - next-auth@5.0.0-beta.30 (Auth.js v5)
    - bcryptjs@3.0.3 + @types/bcryptjs
  patterns:
    - Auth.js v5 Credentials provider with Drizzle authorize callback
    - auth() wrapper pattern for API route protection (req.auth check at top of handler)
    - useActionState + server actions for form state management (no client-side fetch)
    - Edge-safe auth config split: auth.config.ts (no DB) + auth.ts (full config)

key-files:
  created:
    - src/auth.config.ts
    - src/auth.ts
    - proxy.ts
    - src/app/api/auth/[...nextauth]/route.ts
    - src/app/(auth)/login/page.tsx
    - src/app/(auth)/login/actions.ts
    - src/app/(auth)/login/LoginForm.tsx
    - src/app/(auth)/setup/page.tsx
    - src/app/(auth)/setup/actions.ts
    - src/app/(auth)/setup/SetupForm.tsx
    - src/db/migrations/0002_conscious_fantastic_four.sql
  modified:
    - src/db/schema.ts (users table added)
    - src/components/layout/SideNav.tsx (logout button)
    - src/app/(app)/layout.tsx (server-side session guard)
    - src/app/api/channels/route.ts
    - src/app/api/channels/[id]/route.ts
    - src/app/api/drafts/route.ts
    - src/app/api/drafts/[id]/approve/route.ts
    - src/app/api/drafts/[id]/reject/route.ts
    - src/app/api/queue/route.ts
    - src/app/api/queue/[id]/route.ts
    - src/app/api/queue/[id]/publish-now/route.ts
    - src/app/api/queue/[id]/retry/route.ts
    - src/app/api/research/route.ts
    - src/app/api/voice/route.ts
    - tests/api/voice.test.ts
    - package.json (next-auth + bcryptjs deps + overrides)

key-decisions:
  - "Auth.js v5 beta (next-auth@beta) with Credentials provider and JWT strategy — matches research recommendation for single-user self-hosted app"
  - "proxy.ts not middleware.ts — Next.js 16 uses proxy.ts naming per plan spec"
  - "30-day JWT sessions — long-lived for single-user app convenience"
  - "auth() wrapper pattern for API routes: wraps full handler, checks req.auth at top — consistent with Auth.js v5 recommended pattern"
  - "useActionState for login and setup forms — no client-side fetch, server action handles redirect after signIn()"
  - "Setup page locks permanently after first user — server component queries user count before rendering form"

patterns-established:
  - "API route auth pattern: export const GET = auth(function GET(req) { if (!req.auth) return 401; return (async () => { ... handler body ... })(); })"
  - "Form server action pattern: useActionState + FormData + try/catch AuthError re-throw for Next.js redirect compatibility"
  - "Auth config split: auth.config.ts (edge-safe, no DB/bcrypt) + auth.ts (full, with DB queries)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

duration: 6min
completed: 2026-02-28
---

# Phase 03 Plan 01: Authentication — Single-user Auth.js v5 with Credentials, JWT sessions, setup wizard, and 11 API routes protected Summary

**Auth.js v5 Credentials provider with 30-day JWT sessions, bcrypt password hashing, first-visit setup wizard, centered login page, proxy-based route protection, and all 11 API routes returning 401 for unauthenticated requests**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-28T18:36:10Z
- **Completed:** 2026-02-28T18:42:21Z
- **Tasks:** 3
- **Files modified:** 26

## Accomplishments
- Full single-user authentication flow: /setup (first visit) → /login (returning) → /channels (authenticated)
- 11 API routes wrapped with auth() guard — curl without cookie returns 401 JSON
- Session persists across refresh (JWT strategy, 30-day maxAge, stored in cookie)
- Sign out button in SideNav using next-auth/react signOut() redirects to /login

## Task Commits

Each task was committed atomically:

1. **Task 1: Install auth dependencies, add users table, configure Auth.js with proxy** - `d56f9f6` (feat)
2. **Task 2: Login page, setup wizard, logout in SideNav, and app layout session guard** - `cd9bd66` (feat)
3. **Task 3: Add auth() wrapper to all API routes** - `3c32c57` (feat)

## Files Created/Modified
- `src/auth.config.ts` - Edge-safe Auth.js config with authorized callback for proxy route protection
- `src/auth.ts` - Full Auth.js config: Credentials provider, bcrypt authorize, JWT 30-day sessions
- `proxy.ts` - Re-exports auth as proxy for Next.js 16 route protection
- `src/app/api/auth/[...nextauth]/route.ts` - Auth.js API handler (GET/POST)
- `src/app/(auth)/login/page.tsx` - Login page server component (centered card, logo above)
- `src/app/(auth)/login/LoginForm.tsx` - Client form with useActionState, inline error display
- `src/app/(auth)/login/actions.ts` - loginUser server action with AuthError handling
- `src/app/(auth)/setup/page.tsx` - Setup page: queries user count, locks if >0
- `src/app/(auth)/setup/SetupForm.tsx` - Client form for account creation
- `src/app/(auth)/setup/actions.ts` - setupFirstUser: validates, hashes password, inserts user, signIn
- `src/db/schema.ts` - Added users table (id, email, passwordHash, createdAt)
- `src/db/migrations/0002_conscious_fantastic_four.sql` - Migration for users table
- `src/components/layout/SideNav.tsx` - Added sign out button with LogOut icon
- `src/app/(app)/layout.tsx` - Added auth() session check, redirect to /login if unauthenticated
- All 11 `src/app/api/*/route.ts` files - Wrapped with auth() guard returning 401
- `tests/api/voice.test.ts` - Updated to mock @/auth for compatibility with wrapped handler

## Decisions Made
- Auth.js v5 beta Credentials provider with JWT — edge-compatible, no DB session table needed
- proxy.ts naming (not middleware.ts) — Next.js 16 convention per plan spec
- auth() wrapper pattern for API routes uses IIFE `(async () => { ... })()` to support async handlers inside the sync wrapper signature
- Split auth config: auth.config.ts (edge-safe) + auth.ts (imports DB and bcrypt) — required by Auth.js v5 for middleware/proxy compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DATABASE_URL port mismatch**
- **Found during:** Task 1 (running db:migrate)
- **Issue:** .env had `localhost:5434` but docker-compose maps PostgreSQL to port 5435
- **Fix:** Updated DATABASE_URL in .env from port 5434 to 5435
- **Files modified:** .env
- **Verification:** `npm run db:migrate` succeeded after fix
- **Committed in:** d56f9f6 (Task 1 commit)

**2. [Rule 1 - Bug] Updated voice.test.ts for auth() wrapper compatibility**
- **Found during:** Task 3 (TypeScript check after wrapping API routes)
- **Issue:** voice.test.ts imported POST directly and called it with 1 argument — after auth() wrapping, the type requires 2 args (req, ctx) and the handler signature changed
- **Fix:** Added vi.mock('@/auth') to inject mock session, cast POST to a simpler callable type for test assertions
- **Files modified:** tests/api/voice.test.ts
- **Verification:** TypeScript compiles cleanly with 0 errors
- **Committed in:** 3c32c57 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Auth.js v5 auth() wrapper type is `AppRouteHandlerFn` which requires `(req, ctx)` — existing voice test only passed `req`. Resolved by mocking auth module in tests and using type cast.

## User Setup Required
None - no external service configuration required. AUTH_SECRET auto-generated into .env.local.

## Next Phase Readiness
- Authentication fully operational — all AUTH requirements (AUTH-01 through AUTH-04) satisfied
- Ready for Phase 03 Plan 02 (UI polish): session data available via auth() in server components
- Pattern established: any new API routes must follow the auth() wrapper pattern
- Concern: The .env AUTH_SECRET is in .env.local (gitignored) — deployment will need this env var set

## Self-Check: PASSED

All key files confirmed present:
- FOUND: src/auth.ts
- FOUND: src/auth.config.ts
- FOUND: proxy.ts
- FOUND: src/app/api/auth/[...nextauth]/route.ts
- FOUND: src/app/(auth)/login/page.tsx
- FOUND: src/app/(auth)/setup/page.tsx
- FOUND: src/db/migrations/0002_conscious_fantastic_four.sql

All task commits confirmed:
- FOUND: d56f9f6 (Task 1)
- FOUND: cd9bd66 (Task 2)
- FOUND: 3c32c57 (Task 3)

---
*Phase: 03-authentication-ui-polish*
*Completed: 2026-02-28*
