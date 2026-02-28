# Phase 3: Authentication & UI Polish - Research

**Researched:** 2026-02-28
**Domain:** Next.js 16 Authentication (Auth.js v5) + UI polish (dark mode, toasts, skeletons, draft signals)
**Confidence:** HIGH for UI Polish / MEDIUM for Auth (Next.js 16 + Auth.js peer-dep issue flagged)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Account creation**
- First-visit setup wizard: first visitor sees a registration form, creates account on submit, then registration is permanently locked
- No env var seeding or CLI commands — the app handles it

**Login page**
- Centered card layout with app logo above, email + password fields
- Minimal — just the form, no split layout or side content
- Login errors shown as inline red text below form fields ("Invalid email or password")

**Session behavior**
- Long-lived sessions: 30-day expiry, refreshed on activity
- Session persists across browser refresh
- User can log out from any page, redirected to login screen

**Draft review signals**
- Voice confidence: color-coded badge ("87% voice match") — green (80%+), yellow (60-79%), red (<60%)
- Headline picker: radio list showing all options, selected headline updates draft preview in real-time
- Voice badge + headline picker in a header toolbar above the draft body
- Research sources: collapsible "Sources (N)" section below the draft body, collapsed by default, expands to show titles + links

**Empty states**
- Friendly message + primary CTA button on all list views
- E.g., "No channels yet" with "Add your first channel" button
- Each empty state has a specific next-step call to action

**Error handling**
- Toast notifications (bottom-right) for transient errors, inline messages for form validation
- Platform-specific actionable messages upfront: "Substack API key expired — update in channel settings"
- No generic 500s — errors tell the user what happened and what to do

**Retry affordances**
- Failed queue items show red status badge + inline "Retry" button on the queue row
- One-click retry per item, no bulk selection needed

**Visual identity**
- Bold & modern aesthetic (Arc/Raycast direction) — strong accent colors, gradients, bolder typography
- Dark mode + light mode with system preference detection + manual toggle
- Primary accent: warm orange/amber tones
- Compact information density — tighter spacing, more items visible at once, dashboard-like

**Per-channel cost data**
- Cost data visible in channel dashboard (UI-09)

### Claude's Discretion
- Exact color palette values and gradient implementations
- Loading skeleton designs for async operations
- Typography choices (font family, scale)
- Exact spacing/grid system within "compact" constraint
- Toast animation and auto-dismiss timing
- Setup wizard flow details (number of steps, field validation)
- How dark/light toggle is presented (icon button, dropdown, settings page)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can log in with email and password | Auth.js v5 Credentials provider + bcryptjs for password hashing |
| AUTH-02 | User session persists across browser refresh | Auth.js JWT strategy with 30-day maxAge stored in HttpOnly cookie |
| AUTH-03 | Unauthenticated requests to API routes are rejected | Auth.js `auth()` wrapper on all route handlers returns 401 |
| AUTH-04 | User can log out from any page | Auth.js `signOut({ redirectTo: '/login' })` Server Action in SideNav |
| UI-01 | Distinctive, polished visual design applied across all pages | Tailwind CSS 4 CSS variables already in globals.css; add light-mode variables + typography upgrades |
| UI-02 | Empty states with clear next-step calls to action on all list views | Channels/Drafts/Queue pages already have partial empty states; add queue-specific empty state + CTA buttons |
| UI-03 | Skeleton loading on async operations | shadcn Skeleton component + Next.js Suspense + loading.tsx pattern |
| UI-04 | Actionable, platform-specific error messages | Toast (sonner) for transient errors; inline messages already pattern-matched to platform errors |
| UI-05 | Retry affordances on queue failures | QueueItem.tsx already has Retry button; needs API route `/api/queue/[id]/retry` |
| UI-06 | Voice confidence score badges displayed on drafts | DraftDetailPanel.tsx has partial implementation; needs proper color-coded badge per spec |
| UI-07 | Headline option picker for draft generation | DraftDetailPanel.tsx has headline picker; needs real-time preview update wiring |
| UI-08 | Research source attribution display on drafts | DraftDetailPanel.tsx already shows sources; needs collapsible "Sources (N)" section per spec |
| UI-09 | Per-channel cost data visible in channel dashboard | aiAuditLog table exists with costUsd, channelId; add cost aggregation query to channel detail page |
</phase_requirements>

---

## Summary

This phase splits into two clearly independent work streams: **authentication** and **UI polish**. The existing codebase is in good shape for UI work — the design system is already bold/dark-mode-first with warm orange primary (CSS variables in globals.css), and most pages have partial empty-state and draft-signal implementations that need to be completed and hardened per spec.

The authentication story requires care because the project runs **Next.js 16.1.6**, and Auth.js (next-auth v5) has a known peer-dependency conflict with Next.js 16 (declared peers stop at v15). The workaround is an `overrides` field in `package.json` — confirmed working by the community — or using `--legacy-peer-deps`. The actual Auth.js API is fully functional once installed. The `middleware.ts` auth pattern from most guides must use `proxy.ts` on Next.js 16; the export name changes from `auth as middleware` to `auth as proxy`.

The first-visit setup wizard is a custom feature not covered by Auth.js — it requires a `users` table, a DB query to detect zero-users state, a `/setup` route that accepts registration only when no user exists, and a middleware/proxy redirect that sends unauthenticated first-time users to `/setup` rather than `/login`.

**Primary recommendation:** Use Auth.js v5 (next-auth@beta) with Credentials provider, JWT session strategy (30-day maxAge), and bcryptjs for password hashing. Add `"overrides": { "next-auth": { "next": "16.1.6" } }` to package.json to resolve the peer-dep conflict. Use `proxy.ts` (not `middleware.ts`) for route protection. Add sonner for toasts and next-themes + existing CSS variables for dark/light mode toggle.

---

## Existing Codebase Assessment

### What Already Exists (Do Not Rebuild)

The existing codebase has substantial UI foundations already built. The planner must build ON these, not replace them.

| Component | File | Status | What's Needed |
|-----------|------|--------|---------------|
| Draft detail panel | `src/components/drafts/DraftDetailPanel.tsx` | Partial — voice badge, headline picker, sources all present but need spec alignment | Upgrade voice badge to color-coded per spec; make sources collapsible; ensure headline picker updates preview |
| Queue item with retry | `src/components/queue/QueueItem.tsx` | Complete — retry button wired to `/api/queue/[id]/retry` | May just need verification this API route exists |
| Channel empty state | `src/app/(app)/channels/page.tsx` | Present but needs CTA button upgrade per spec | Already has "Create your first channel" button |
| Drafts empty state | `src/app/(app)/drafts/page.tsx` | Present but no CTA action | Needs CTA button linking to channel creation or run-research flow |
| Queue empty state | `src/app/(app)/queue/page.tsx` | Not implemented (QueueTimeline handles empty state internally) | Needs explicit empty state with CTA |
| CSS design system | `src/app/globals.css` | Dark-mode-first with orange primary accent — already matches Arc/Raycast aesthetic | Add light-mode CSS variables; add dark/light toggle |
| SideNav | `src/components/layout/SideNav.tsx` | Client component, active-link highlighting | Add logout button + dark mode toggle |
| Auth | None | Does not exist | Build from scratch |

### What Does NOT Exist Yet

- `users` table in schema
- Auth.js configuration (auth.ts, auth.config.ts)
- proxy.ts route protection
- `/login` page
- `/setup` (first-visit registration) page
- API route auth guards on all `/api/**` handlers
- sonner toast provider
- next-themes ThemeProvider
- Skeleton loading components
- Per-channel cost data on channel detail page
- Light-mode CSS variable set

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | 5.0.0-beta.30+ | Auth.js credentials auth, JWT sessions, route protection | Official Next.js auth library; universal `auth()` works in Server Components, Route Handlers, proxy.ts |
| bcryptjs | ^2.4.3 | Pure-JS password hashing (no native binaries) | Works in Node.js runtime without native module issues; compatible with Next.js proxy/edge edge cases |
| sonner | ^2.x (via shadcn) | Toast notifications | Used by shadcn/ui ecosystem; already the de-facto standard for this stack |
| next-themes | ^0.4.x | Dark/light mode system preference + manual toggle | Integrates with Tailwind CSS v4 `@custom-variant dark` pattern; handles SSR hydration correctly |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^3.25 (already installed) | Validate login form credentials server-side in authorize callback | Always validate form input before DB query |
| react-hook-form | ^7.71 (already installed) | Login/setup form state management | Use with existing `@hookform/resolvers` zod integration already in project |
| shadcn skeleton | via CLI | Loading placeholder components | Use for async page sections during data fetching |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Auth.js v5 | Custom JWT with `jose` | Custom is more flexible but requires building session refresh, CSRF protection, and cookie management manually. Auth.js handles all of this. |
| bcryptjs | bcrypt (native) | Native bcrypt is faster but requires compilation. bcryptjs is pure JS and works everywhere. For single-user auth the speed difference is irrelevant. |
| next-themes | Manual localStorage/class toggle | next-themes handles SSR hydration, system preference detection, and persistence. Manual implementation is ~200 lines and easy to get wrong. |
| sonner | react-hot-toast | Sonner is already in the shadcn/ui ecosystem this project uses; better animation defaults |

### Installation

```bash
# Auth
npm install next-auth@beta bcryptjs
npm install --save-dev @types/bcryptjs

# Toasts
npx shadcn@latest add sonner

# Skeletons
npx shadcn@latest add skeleton

# Dark mode
npm install next-themes
```

**Package.json peer-dep override required for Next.js 16:**

```json
{
  "overrides": {
    "next-auth": {
      "next": "16.1.6"
    }
  }
}
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (app)/              # Protected route group (existing)
│   │   ├── layout.tsx      # Add auth check here
│   │   └── ...             # Existing pages
│   ├── (auth)/             # NEW: Unauthenticated route group
│   │   ├── login/
│   │   │   └── page.tsx    # Login page
│   │   └── setup/
│   │       └── page.tsx    # First-visit setup wizard
│   └── api/
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts  # Auth.js handler
├── auth.ts                   # NEW: Auth.js instance (full config, DB queries)
├── auth.config.ts            # NEW: Edge-safe config (no DB imports)
├── proxy.ts                  # NEW: Route protection (Next.js 16, not middleware.ts)
└── db/
    └── schema.ts             # Add users table
```

### Pattern 1: Two-File Auth.js Configuration (Edge-Safe Split)

**What:** Auth.js with Credentials requires bcryptjs (Node.js runtime only). Next.js proxy runs in Node runtime (not Edge), so for this project the split is technically optional. However, the split is still best practice because it separates concerns and makes the config easier to test.

**When to use:** Always with Auth.js v5 + Credentials in Next.js 16 App Router.

```typescript
// auth.config.ts — edge-safe, no DB or bcrypt imports
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnSetup = nextUrl.pathname === '/setup';
      const isOnLogin = nextUrl.pathname === '/login';
      const isOnPublicRoute = isOnSetup || isOnLogin;

      if (isOnPublicRoute) return true;
      if (!isLoggedIn) return Response.redirect(new URL('/login', nextUrl));
      return true;
    },
  },
  providers: [], // providers added in auth.ts
} satisfies NextAuthConfig;
```

```typescript
// auth.ts — full config with DB + bcrypt (Node runtime only)
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = z.object({
          email: z.string().email(),
          password: z.string().min(8),
        }).safeParse(credentials);

        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const [user] = await db.select().from(users).where(eq(users.email, email));
        if (!user) return null;

        const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordsMatch) return null;

        return { id: user.id, email: user.email };
      },
    }),
  ],
});
```

**Source:** [Auth.js Credentials docs](https://authjs.dev/getting-started/providers/credentials), [Next.js Learn auth guide](https://nextjs.org/learn/dashboard-app/adding-authentication)

### Pattern 2: proxy.ts for Route Protection (Next.js 16)

**What:** Next.js 16 renamed `middleware.ts` to `proxy.ts`. Auth.js must export `auth as proxy` (not `auth as middleware`).

```typescript
// proxy.ts — at project root, same level as next.config.ts
export { auth as proxy } from './auth';

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

**Source:** [Next.js 16 upgrade guide — middleware to proxy](https://nextjs.org/docs/app/guides/upgrading/version-16), [Auth.js proxy discussion](https://github.com/nextauthjs/next-auth/discussions/13315)

### Pattern 3: API Route Auth Guards

**What:** The proxy/middleware only handles UI routes. API routes must also check authentication independently.

```typescript
// Example: src/app/api/channels/route.ts (updated pattern)
// Source: https://authjs.dev/getting-started/session-management/protecting
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export const GET = auth(function GET(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // ... existing handler logic
});
```

**Important:** All existing `/api/**` route handlers must be wrapped with `auth()`. There are 5 route directories: `channels`, `drafts`, `queue`, `research`, `voice`.

### Pattern 4: First-Visit Setup Wizard

**What:** Custom logic — Auth.js has no concept of "first user". Implemented as:
1. `users` table with `isSetupComplete` check
2. `/setup` page that renders a registration form
3. Server Action that: (a) checks user count === 0, (b) hashes password with bcrypt, (c) inserts user, (d) signs in automatically
4. Proxy checks: if no users in DB, redirect to `/setup` (but only from login page, not all routes, to avoid DB call on every request — use a cookie flag)

**Setup lock mechanism:** After registration, set a `setup_complete` cookie or check user count in the authorized callback. For performance, the proxy should use a cookie-based flag (`SETUP_COMPLETE=1`) rather than a DB query on every request.

```typescript
// src/app/(auth)/setup/actions.ts
'use server';
import bcrypt from 'bcryptjs';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { signIn } from '@/auth';

export async function setupFirstUser(formData: FormData) {
  const count = await db.select({ count: sql`count(*)` }).from(users);
  if (Number(count[0].count) > 0) {
    throw new Error('Setup already complete');
  }

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const passwordHash = await bcrypt.hash(password, 12);

  await db.insert(users).values({ email, passwordHash });
  await signIn('credentials', { email, password, redirectTo: '/channels' });
}
```

### Pattern 5: Dark Mode with next-themes + Tailwind CSS 4

**What:** The existing `globals.css` already has `@custom-variant dark (&:is(.dark *))`. Tailwind v4's dark mode is configured via CSS — no `tailwind.config.js` needed. next-themes toggles the `dark` class on `<html>`.

```css
/* globals.css additions — light mode variables */
.light {
  --background: 0 0% 98%;
  --foreground: 0 0% 8%;
  --card: 0 0% 100%;
  --card-foreground: 0 0% 8%;
  /* ... etc */
  --primary: 24 100% 50%; /* warm orange, slightly darker for light bg */
  --primary-foreground: 0 0% 100%;
}
```

```typescript
// src/components/providers.tsx (new file)
'use client';
import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
```

```typescript
// src/app/layout.tsx — wrap with Providers + add Toaster
import { Toaster } from '@/components/ui/sonner';
import { Providers } from '@/components/providers';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
```

**Source:** [next-themes + Tailwind v4 class-based dark mode](https://iifx.dev/en/articles/456423217/solved-enabling-class-based-dark-mode-with-next-15-next-themes-and-tailwind-4)

### Pattern 6: Skeleton Loading with Next.js Suspense

**What:** Use `loading.tsx` files in page directories (Next.js App Router convention) or wrap async components in `<Suspense fallback={<SkeletonComponent />}>`.

```typescript
// src/app/(app)/channels/loading.tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function ChannelsLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

**Source:** [Next.js 15 Streaming Handbook](https://www.freecodecamp.org/news/the-nextjs-15-streaming-handbook/)

### Anti-Patterns to Avoid

- **Do not use `middleware.ts`:** This project is on Next.js 16.1.6. Use `proxy.ts` with named export `proxy`.
- **Do not put DB queries in auth.config.ts:** The config file must be edge-safe (no Node.js-specific modules). DB + bcrypt go in `auth.ts` only.
- **Do not protect API routes only via proxy:** The proxy provides optimistic redirects. API routes must also call `auth()` independently to return 401 for unauthenticated requests.
- **Do not import bcrypt (native) — use bcryptjs:** The native `bcrypt` package requires native binaries; `bcryptjs` is pure JS and avoids compilation issues.
- **Do not forget `suppressHydrationWarning` on `<html>`:** next-themes will cause hydration mismatch without it.
- **Do not rebuild existing UI components:** DraftDetailPanel, QueueItem, and ChannelCard already exist. Upgrade them, do not replace them.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session management | Custom JWT cookie + refresh logic | Auth.js v5 JWT strategy | Handles signing, rotation, expiry, HttpOnly cookies, CSRF protection |
| Password hashing | Custom crypto | bcryptjs | Correct salt rounds, timing-safe comparison built in |
| Dark mode persistence | localStorage + useEffect manual | next-themes | Handles SSR hydration flash, system preference detection, persistence |
| Toast notifications | Custom toast state + portal | sonner (via shadcn) | Animation, accessibility, stacking, auto-dismiss all built in |
| Route protection | Manual session check in every page | Auth.js `authorized` callback in proxy.ts | Single enforcement point |
| Skeleton components | Animated divs with custom CSS | shadcn Skeleton component | Consistent with design system, no extra CSS |

**Key insight:** Auth is full of edge cases (CSRF, session fixation, timing attacks, cookie flags). Never build a custom auth system when Auth.js handles it all with one config file.

---

## Common Pitfalls

### Pitfall 1: Next.js 16 + Auth.js Peer Dependency Conflict

**What goes wrong:** `npm install next-auth@beta` fails with peer dependency error because next-auth declares `"next": "^12 || ^13 || ^14 || ^15"` but the project uses Next.js 16.

**Why it happens:** next-auth hasn't updated peer deps for Next.js 16 yet (as of Feb 2026).

**How to avoid:** Add to `package.json`:
```json
{
  "overrides": {
    "next-auth": {
      "next": "16.1.6"
    }
  }
}
```
Then run `npm install`.

**Warning signs:** `npm ERR! peer next@"^12.2.5 || ^13 || ^14 || ^15" from next-auth@5.0.0-beta.30`

### Pitfall 2: Using `middleware.ts` Instead of `proxy.ts`

**What goes wrong:** Route protection appears to work in dev but the file convention is deprecated and may cause warnings or future breaks.

**Why it happens:** All Auth.js docs and tutorials still show `middleware.ts` — this project is on the latest Next.js 16 which renamed it.

**How to avoid:** Create `proxy.ts` at project root. Export named `proxy` function (not `middleware`).

**Warning signs:** Next.js dev server logs deprecation warning about `middleware.ts`

### Pitfall 3: Auth.js Credentials + Database Sessions (vs JWT)

**What goes wrong:** Using `strategy: "database"` with Credentials provider requires a sessions table and creates issues where the session isn't found after sign-in with some Auth.js versions.

**Why it happens:** Auth.js Credentials provider with database sessions has known bugs in v5 beta. JWT strategy avoids this entirely.

**How to avoid:** Use `session: { strategy: 'jwt' }`. No sessions table needed. Works reliably with Credentials.

**Warning signs:** Session returns null after successful sign-in.

### Pitfall 4: Setup Wizard Race Condition (Multiple Simultaneous First-Visit)

**What goes wrong:** Two browser tabs hit `/setup` simultaneously. Both submit registration forms. Two users get created.

**Why it happens:** The "count users then insert" pattern is not atomic.

**How to avoid:** Use a DB unique constraint on the `email` column AND a `is_setup_complete` boolean in a `app_settings` table (or a unique index that allows only one user row). The server action should handle the unique constraint violation gracefully.

**Warning signs:** Multiple user rows in `users` table.

### Pitfall 5: Hydration Mismatch with Dark Mode

**What goes wrong:** Server renders with default theme, client re-renders with user's saved theme, React throws hydration error or shows flash of unstyled content.

**Why it happens:** Server doesn't know the user's saved theme preference.

**How to avoid:** Add `suppressHydrationWarning` to `<html>` element. The `<ThemeProvider>` from next-themes handles the rest.

**Warning signs:** `Warning: Prop className did not match` in browser console.

### Pitfall 6: Forgot to Guard API Routes

**What goes wrong:** Auth protection works for pages but API routes (`/api/channels`, `/api/drafts`, etc.) are still accessible without authentication.

**Why it happens:** proxy.ts `matcher` config typically excludes `/api/**` to avoid running the proxy on every API call. But then API routes have no auth check.

**How to avoid:** Wrap every route handler with `auth()` from Auth.js: `export const GET = auth(handler)`. Also include `/api/**` in proxy matcher to get 401s for non-JSON clients.

**Warning signs:** `curl http://localhost:3021/api/channels` returns 200 without any cookie.

---

## Code Examples

Verified patterns from official sources:

### users Table Schema (Drizzle)

```typescript
// src/db/schema.ts additions
// Source: Auth.js Drizzle adapter docs + project conventions
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
});
```

### Login Server Action

```typescript
// src/app/(auth)/login/actions.ts
// Source: https://nextjs.org/learn/dashboard-app/adding-authentication
'use server';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

export async function loginUser(prevState: string | undefined, formData: FormData) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid email or password';
        default:
          return 'Something went wrong. Please try again.';
      }
    }
    throw error; // Re-throw for Next.js to handle redirects
  }
}
```

### Login Form (client component)

```typescript
// src/app/(auth)/login/LoginForm.tsx
// Source: https://nextjs.org/learn/dashboard-app/adding-authentication
'use client';
import { useActionState } from 'react';
import { loginUser } from './actions';

export function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(loginUser, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="email" name="email" placeholder="Email" required className="..." />
      <input type="password" name="password" placeholder="Password" required className="..." />
      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}
      <button type="submit" disabled={isPending} className="...">
        {isPending ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
```

### Logout Button (Server Action in SideNav)

```typescript
// In SideNav.tsx — add logout form
// Source: https://nextjs.org/learn/dashboard-app/adding-authentication
import { signOut } from '@/auth';

// Inside SideNav component:
<form
  action={async () => {
    'use server';
    await signOut({ redirectTo: '/login' });
  }}
>
  <button type="submit" className="...">Sign Out</button>
</form>
```

### API Route with Auth Guard

```typescript
// Updated route handler pattern
// Source: https://authjs.dev/getting-started/session-management/protecting
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { channels } from '@/db/schema';

export const GET = auth(function GET(req) {
  if (!req.auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... existing handler body
});
```

### Voice Confidence Badge (per spec)

```typescript
// Voice confidence color coding per CONTEXT.md spec
function VoiceConfidenceBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-green-500/15 text-green-400 border-green-500/30'
    : score >= 60 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
    : 'bg-red-500/15 text-red-400 border-red-500/30';

  return (
    <Badge className={`border text-xs font-mono shrink-0 ${color}`} variant="outline">
      {score}% voice match
    </Badge>
  );
}
```

### Collapsible Sources Section

```typescript
// Replaces the current always-visible sources in DraftDetailPanel
// Use native <details> HTML element — no JS needed
<details className="group">
  <summary className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2 cursor-pointer list-none flex items-center gap-2">
    <span>Sources ({sources.length})</span>
    <span className="group-open:rotate-180 transition-transform">▾</span>
  </summary>
  <div className="flex flex-col gap-1.5 mt-2">
    {/* existing source items */}
  </div>
</details>
```

### Sonner Toast Usage

```typescript
// Source: https://ui.shadcn.com/docs/components/radix/sonner
import { toast } from 'sonner';

// Success
toast.success('Draft approved');

// Error with platform-specific message
toast.error('Substack API key expired — update in channel settings');

// Loading + resolve
const toastId = toast.loading('Retrying publish...');
toast.dismiss(toastId); // on completion
toast.success('Published successfully!');
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` for auth | `proxy.ts` with `proxy` export | Next.js 16 (2025) | Must rename file and export in this project |
| `darkMode: 'class'` in tailwind.config.js | `@custom-variant dark` in CSS | Tailwind CSS v4 | Already configured in project's globals.css |
| next-auth v4 | next-auth v5 beta (Auth.js) | 2024-present | Universal `auth()` function, App Router first |
| Database sessions with Credentials | JWT sessions with Credentials | Auth.js v5 best practice | Avoids known v5 bug; simpler setup |

**Deprecated/outdated:**
- `middleware.ts` named export `middleware`: Renamed to `proxy.ts` / `proxy` in Next.js 16
- `NEXTAUTH_SECRET` env variable: Replaced by `AUTH_SECRET` in Auth.js v5
- `NEXTAUTH_URL` env variable: Replaced by `AUTH_URL` in Auth.js v5
- `getServerSession()`: Replaced by `auth()` in Auth.js v5

---

## Open Questions

1. **Auth.js v5 + Next.js 16 peer dep resolution**
   - What we know: `npm install next-auth@beta` fails without override. The `overrides` field in package.json fixes it.
   - What's unclear: Whether a stable release with proper Next.js 16 peer dep declaration is imminent (issue #13302 was open as of late 2025)
   - Recommendation: Use the `overrides` workaround. If the beta install still fails, fall back to `--legacy-peer-deps`. Both approaches work at runtime.

2. **Setup wizard cookie vs DB check in proxy**
   - What we know: The proxy should not make DB calls (performance concern)
   - What's unclear: Best mechanism to distinguish "no users exist (→ /setup)" vs "user not logged in (→ /login)"
   - Recommendation: Use a persistent `setup_complete` cookie set after first user creation. Proxy checks cookie existence; if absent, redirect to `/setup`. After registration, set cookie with long expiry. This avoids DB calls in proxy on every request.

3. **Per-channel cost aggregation (UI-09)**
   - What we know: `aiAuditLog` table has `costUsd` (numeric) and `channelId` (uuid) columns
   - What's unclear: Whether to aggregate in the page query or via a separate API endpoint
   - Recommendation: Aggregate directly in the channel detail Server Component query using Drizzle's `sum()` aggregation. No new API endpoint needed.

---

## Sources

### Primary (HIGH confidence)
- [Auth.js Credentials docs](https://authjs.dev/getting-started/providers/credentials) — authorize callback pattern
- [Auth.js Session Protecting docs](https://authjs.dev/getting-started/session-management/protecting) — proxy.ts route protection, API route wrapping
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16) — confirmed middleware→proxy rename, Next.js 16.1.6 details
- [Next.js Learn authentication guide](https://nextjs.org/learn/dashboard-app/adding-authentication) — canonical login form + signIn/signOut patterns
- Project source code inspection — existing schema, components, CSS variables, current component implementations

### Secondary (MEDIUM confidence)
- [Auth.js + Next.js 16 peer dep issue #13302](https://github.com/nextauthjs/next-auth/issues/13302) — confirmed workaround via overrides
- [Auth.js proxy migration discussion #13315](https://github.com/nextauthjs/next-auth/discussions/13315) — confirmed `export { auth as proxy }` pattern
- [next-themes + Tailwind v4 class-based dark mode](https://iifx.dev/en/articles/456423217/solved-enabling-class-based-dark-mode-with-next-15-next-themes-and-tailwind-4) — `@custom-variant dark (&:where(.dark, .dark *))` + `attribute="class"` in ThemeProvider
- [sonner shadcn docs](https://ui.shadcn.com/docs/components/radix/sonner) — installation and toast API

### Tertiary (LOW confidence)
- Various Medium/DEV community articles on Auth.js v5 setup — patterns cross-verified against official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Auth.js v5 credentials pattern verified against official docs; peer-dep workaround verified against GitHub issue; all other libraries verified against official docs
- Architecture: HIGH — proxy.ts pattern from Next.js official upgrade guide; auth split from official Auth.js docs; UI patterns from direct codebase inspection
- Auth.js + Next.js 16 compatibility: MEDIUM — workaround confirmed but awaiting official peer dep update
- Pitfalls: HIGH — most pitfalls directly observed from codebase + official docs

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (Auth.js + Next.js 16 compat situation may change sooner; check issue #13302)
