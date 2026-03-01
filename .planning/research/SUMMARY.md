# Project Research Summary

**Project:** Orbitl v1.1 — Twitter/X Publisher, Short-Form Content Type, Thread Generation, Tech Debt Cleanup
**Domain:** Adding Twitter/X publishing and short-form content capabilities to an existing AI social content generator
**Researched:** 2026-02-28
**Confidence:** HIGH (stack, architecture, pitfalls confirmed against official docs and direct codebase analysis); MEDIUM (API tier pricing and rate limits — X changes these frequently)

## Executive Summary

Orbitl v1.1 extends a mature, working v1.0 system to add Twitter/X as a third publisher platform. The existing pluggable `PublisherProvider` interface absorbs the new platform cleanly — the Twitter provider is structurally identical to the LinkedIn and Substack providers already shipping. The net new scope is precisely bounded: one npm package (`twitter-api-v2`), two PostgreSQL enum value additions (`'twitter'` in `platformEnum`, `'tweet'` in `contentTypeEnum`), four new files, and ten modified files. No subsystem redesign is required. The implementation risk is low because patterns are well-established and the architecture already accounts for multiple platforms.

The key capability addition — thread generation from approved long-form drafts — is a meaningful content repurposing differentiator that no competitor currently automates. Buffer, Postiz, and Mixpost all require manual thread composition; Orbitl's approach is to call Claude with a structured decomposition prompt against an approved draft and produce a reviewable thread as a new draft. This is the highest-leverage feature in the scope and should be treated as the flagship deliverable of v1.1. The implementation is prompt-engineering and data-model work, not platform API complexity.

The five v1.0 tech debt items must be addressed in this milestone because two of them (publish-now stub, retry bug) will cause observable failures on Twitter that are harder to tolerate than on Substack — duplicate tweets and permanently-stuck queue items are more damaging than a delayed newsletter post. The DISABLE_INTERNAL_CRON env var is critical for any user running the daemon alongside Kubernetes CronJobs: without it, duplicate post events produce duplicate tweets. Fix the tech debt items first so that the Twitter publisher is built on correct queue semantics from the start.

---

## Key Findings

### From STACK.md

**Core technologies (new additions only):**

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| `twitter-api-v2` | `^1.29.0` | X API client for tweet and thread posting | Only actively-maintained, fully-typed Node.js X API client; ships its own TypeScript definitions; native `tweetThread()` handles reply-chain sequencing automatically |
| `Intl.DateTimeFormat` (built-in) | Node.js 20 (project baseline) | Scheduler timezone fix | 20-line implementation; no library needed for IANA timezone offset arithmetic at this scope |
| `drizzle-kit generate` + migrate | 0.31.9 (already installed) | Add `'twitter'` and `'tweet'` enum values | Drizzle Kit ≥0.26.2 generates correct `ALTER TYPE ... ADD VALUE` SQL; no additional tooling required |

**Critical version constraints:**
- Do NOT upgrade Zod to v4 — project uses Zod 3.25.x and `zod/v4` has breaking changes in error API
- Use OAuth 1.0a with 4 static credentials; do NOT implement OAuth 2.0 PKCE (requires redirect URI, token refresh, callback endpoint — 3x complexity for no user-facing benefit in a self-hosted tool)
- Thread tweets stored as `JSON.stringify(string[])` in `drafts.body`; do NOT create a new `tweetThreads` table (unnecessary complexity at single-creator scale)
- X API Free tier allows approximately 500 post creations per month; a 10-tweet thread consumes 10 of those 500 — document this constraint in the channel UI

**Authentication choice — OAuth 1.0a:**
- `appKey`, `appSecret`, `accessToken`, `accessSecret` — 4 static strings, no expiry, no refresh cycle
- Stored encrypted in `channels.credentials` using existing `encrypt()`/`decrypt()` functions
- Consistent with LinkedIn provider pattern; zero new auth infrastructure required

### From FEATURES.md

**Must ship (v1.1 MVP — non-negotiable):**
- DB migration: add `'twitter'` to `platformEnum`, `'tweet'` to `contentTypeEnum`
- `TwitterProvider` implementing the existing `PublisherProvider` interface — OAuth 1.0a credentials, single tweet and thread posting, 280-char-aware `formatDraft()`
- Tweet content type generation prompt — hook/body/CTA structure with 280-char segment constraints and voice-adapted conciseness
- Thread generation from approved draft — server action: AI decomposes approved article/note body into tweet array, saves as new `tweet` draft
- Thread card preview in draft review — renders tweet drafts as a card list with per-card character count indicators (green/yellow/red)
- Publish-now stub fix — wire route handler to call publisher directly, not just set `publishing` status
- Retry bug fix — reset `retryCount = 0` on user-initiated retry
- DISABLE_INTERNAL_CRON env var — add guard at cron registration call site
- Scheduler timezone fix — apply `ScheduleConfig.timezone` to window hour calculations using `Intl.DateTimeFormat`
- CreateChannelForm actionable errors — map DB constraint and validation errors to specific user messages

**Should ship if capacity allows:**
- Hook variant picker — generate 3 alt opening tweets; surface as chip picker in thread preview (same UX as `headlineOptions[]`)
- "Generate thread from this draft" one-click button on approved long-form draft review page

**Defer to v1.2+:**
- Media/image attachments on tweets — chunked `v1/media/upload` flow; substantially different from text-only posting
- Tweet analytics (impressions, engagements) — requires paid X API tier ($100+/month); out of scope
- Bluesky/Mastodon publisher — community contribution via the existing pluggable provider system

**Competitive differentiation:**
- Orbitl is the only tool in the competitive set that automates long-form → thread repurposing via AI. Buffer, Postiz, and Mixpost all require manual thread composition. This is the feature to emphasize.
- Voice adaptation (tweet-specific register constraints in persona prompt) is a secondary differentiator; no competitor applies platform-specific voice tuning.

### From ARCHITECTURE.md

**Existing subsystems touched (additive changes only):**
- `src/db/schema.ts` — enum additions
- `src/lib/publishing/publisher-registry.ts` — one import + one `register()` call
- `src/lib/publishing/scheduler.ts` — add `twitter` key to `DEFAULT_WINDOWS`; add timezone fix
- `src/lib/generation/generator.ts` — add `tweet` branch in `buildGenerationPrompt()`
- `src/app/api/queue/[id]/publish-now/route.ts` — replace stub with actual dispatch
- `src/app/api/queue/[id]/retry/route.ts` — reset `retryCount = 0`
- `src/daemon/index.ts` — add `DISABLE_INTERNAL_CRON` env var guard
- `src/components/channels/CreateChannelForm.tsx` — add `twitter` to platform dropdown; better error messages
- `src/components/drafts/DraftCard.tsx` — add `twitter` to `PLATFORM_STYLES`, `tweet` to `CONTENT_TYPE_STYLES`

**New files:**
- `src/lib/publishing/twitter.ts` — OAuth 1.0a credential parsing, `publishTweet()`, `publishThread()`, `formatForTwitter()`
- `src/lib/publishing/providers/twitter.provider.ts` — `PublisherProvider` implementation; routes on `draft.contentType`
- `src/lib/generation/thread.ts` — pure function: splits draft body into tweet-sized segments; unit-testable with no I/O
- `src/app/api/drafts/[id]/thread/route.ts` — POST endpoint: validates approved draft exists, calls AI decomposition, saves thread draft

**Key architectural decisions:**
- Thread storage: `JSON.stringify(string[])` in `drafts.body` with `contentType = 'tweet'`; `hook` holds `tweets[0]` for card preview. No new table required.
- Thread posting: strictly sequential `for...of` loop (not `Promise.all()`); each tweet ID from API response feeds the next tweet's `reply.in_reply_to_tweet_id`.
- `tweetThread()` from `twitter-api-v2` handles the sequential chaining automatically — prefer this over a manual loop.
- Publish-now fix: dispatch `provider.publish()` synchronously within the route handler; update `publishQueue` and `drafts` rows to match queue-runner behavior exactly.

**Recommended build order (dependencies determine sequence):**
1. DB schema + migration (everything downstream depends on enum values)
2. Twitter API client (`twitter.ts`) — build and unit-test signing logic in isolation
3. Twitter provider + registry registration + scheduler defaults
4. Tweet generation prompt branch in `generator.ts` (independent of Steps 2-3; can run in parallel)
5. Thread splitter pure function (`thread.ts`) — fully independent; unit-testable from day one
6. Thread API route (depends on Steps 1 and 5)
7. Tech debt fixes — independent of all Twitter work; do these before wiring up Twitter in production
8. UI updates — depends on Steps 1 and 3 (Twitter must be registered before channel creation works)

### From PITFALLS.md

**Critical pitfalls (data loss or permanent publish failure):**

1. **OAuth 2.0 refresh token not persisted (Pitfall 1)** — Moot if using OAuth 1.0a as recommended; only triggered if OAuth 2.0 PKCE is attempted. Prevention: use OAuth 1.0a. Do not implement PKCE.

2. **Postgres enum migration transaction violation (Pitfall 2)** — PostgreSQL disallows using a newly-added enum value within the same transaction that added it. Drizzle-kit's `push` command has known bugs with enum change detection. **Prevention: always use `drizzle-kit generate` (not `push`) and run the enum addition as a standalone migration file before any code that uses the new value is deployed.**

3. **Thread posting race — `Promise.all()` breaks reply chain (Pitfall 3)** — Posting thread tweets concurrently produces standalone tweets, not a thread. Prevention: use `twitter-api-v2`'s `tweetThread()` method; never use `Promise.all()` for thread posting.

4. **Short-form draft schema mismatch (Pitfall 4)** — The existing draft review UI and generator assume `note`/`article` field shapes. Tweet drafts use only `body` (single tweet or JSON array); `hook` and `cta` are null. Rendering tweet drafts in the long-form card produces broken UI. **Prevention: add a dedicated `tweet` branch in `buildGenerationPrompt()` and a tweet-specific draft review component.**

5. **AI generates tweets over 280 characters despite explicit prompting (Pitfall 5)** — LLMs regularly violate character constraints. Twitter's character counting for emoji and URLs differs from JavaScript's `.length`. Prevention: validate all tweet text server-side using a conservative 270-character limit before inserting the draft; never rely on model self-compliance.

6. **Free tier monthly write cap affects thread economics (Pitfall 6)** — 500 posts/month; a 10-tweet thread = 10 writes. One active channel can exhaust the free tier in 30 days of daily threads. Prevention: log X API write limit headers on every successful post; surface remaining quota in the channel dashboard; distinguish `403 Forbidden` (monthly cap) from `429 Too Many Requests` (rate limit) in error handling.

**Moderate pitfalls (bugs or UX regressions, not data loss):**

7. **Retry bug — `retryCount` increments on user-initiated retry (Pitfall 7)** — An item at `retryCount = 3` immediately permanently-fails when user clicks Retry because the route increments instead of resets. **Fix: `SET retryCount = 0` in the retry route.**

8. **Publish-now sets `publishing` but daemon never picks it up (Pitfall 8)** — Items in `publishing` state bypass the daemon's `WHERE status = 'queued'` filter; they sit until `recoverStuckItems()` fires 15 minutes later. **Fix: dispatch `provider.publish()` synchronously in the route handler; do not rely on daemon to pick up `publishing`-status items.**

9. **Long-form persona prompt produces generic tweets (Pitfall 9)** — The voice pipeline was optimized for 150-2000 word content; applying it verbatim to tweets produces LinkedIn-style text squished to 280 chars. Prevention: add tweet-specific persona instructions in `buildGenerationPrompt()` that prioritize vocabulary, opinion, and tone over sentence structure patterns. Accept imperfect quality in v1.1; iterate on prompt engineering.

10. **Naive text chunking for thread generation produces incoherent tweets (Pitfall 10)** — Splitting `body` at 280-char boundaries cuts mid-sentence and buries the hook. Prevention: implement thread generation as a dedicated AI call (not text splitting) with structured decomposition prompt — `{ tweets: string[] }` output where each tweet is a complete standalone thought.

11. **DISABLE_INTERNAL_CRON not implemented — duplicate posts from daemon + CronJob (Pitfall 11)** — Without this guard, running both the daemon and a Kubernetes CronJob simultaneously posts duplicate content to Twitter. **Prevention: implement `DISABLE_INTERNAL_CRON` check before shipping Twitter — duplicate tweets are highly visible.**

---

## Implications for Roadmap

Based on combined research, a 3-phase structure is recommended. The ordering is driven by the dependency graph: enum migrations gate all feature work; tech debt fixes must precede Twitter publisher wiring to ensure correct queue semantics; UI surfaces last.

### Phase 1: Foundation — DB Migration + Tech Debt Fixes

**Rationale:** The enum migration is the single hardest prerequisite — every downstream feature depends on `'twitter'` and `'tweet'` existing in the database. The five tech debt fixes are independent of Twitter work and should be done here rather than interleaved with feature development, because two of them (publish-now, retry bug) directly affect queue correctness that the Twitter publisher depends on. Fixing them early means Twitter is built on verified, correct queue semantics.

**Delivers:**
- DB migration: `'twitter'` added to `platformEnum`, `'tweet'` added to `contentTypeEnum` (standalone migration, not combined with data changes)
- Publish-now route: dispatch `provider.publish()` directly; update `publishQueue` and `drafts` rows
- Retry bug: `retryCount = 0` reset on user-initiated retry
- DISABLE_INTERNAL_CRON: env var guard added before `schedule()` call in daemon
- Scheduler timezone fix: `Intl.DateTimeFormat`-based window hour resolution in `scheduler.ts`
- CreateChannelForm: specific error messages for validation/constraint failures

**Features from FEATURES.md:** All five tech debt items (required MVP)

**Pitfalls avoided:** Pitfall 2 (enum migration), Pitfall 7 (retry bug), Pitfall 8 (publish-now stub), Pitfall 11 (duplicate posts), Pitfall 12 (scheduler timezone)

**Research flag:** Standard patterns — no additional research needed. Implementation is fully specified in ARCHITECTURE.md.

---

### Phase 2: Twitter Publisher + Content Type

**Rationale:** With correct enum values in the DB and correct queue semantics, the Twitter publisher can be built safely. The natural build sequence (API client → provider → generation prompt → thread splitter → thread route) means each step is independently testable before the next begins. Character limit validation and error handling must be built here — not retrofitted — because Pitfalls 3, 5, and 6 all manifest at publish time.

**Delivers:**
- `twitter.ts`: OAuth 1.0a credential parsing, `publishTweet()`, `publishThread()`, `formatForTwitter()` with 270-char enforcement
- `twitter.provider.ts`: `PublisherProvider` implementation registered in `publisher-registry.ts` and `scheduler.ts`
- Tweet generation prompt branch in `generator.ts` with tweet-specific voice constraints
- `thread.ts` pure function: AI-based decomposition (not naive chunking) of long-form draft into tweet array
- Thread API route `POST /api/drafts/[id]/thread`: validates approved draft → AI decomposition → inserts thread draft
- Character count validation server-side before draft insert (270-char conservative limit)
- Twitter API error handling: distinguish `401` (bad credentials), `403` (monthly cap), `429` (rate limit) with specific user-facing messages
- Log X API write limit response headers on every successful post

**Features from FEATURES.md:** TwitterProvider, tweet content type, thread generation from approved draft (all required MVP)

**Pitfalls avoided:** Pitfall 3 (thread race — use `tweetThread()`), Pitfall 4 (schema mismatch — dedicated tweet draft field mapping), Pitfall 5 (char limit overrun — server-side validation), Pitfall 6 (monthly cap handling), Pitfall 9 (voice prompt), Pitfall 10 (AI decomposition not text chunking), Pitfall 13 (document X Developer Portal app-in-project requirement in UI)

**Research flag:** Standard patterns — HIGH confidence from official X API docs and `twitter-api-v2` library documentation. No additional research needed.

---

### Phase 3: UI — Twitter Channel + Thread Preview

**Rationale:** UI work is last because it depends on the provider being registered (channel creation requires `twitter` to be a valid platform option) and on the thread draft format being defined (thread preview component needs to know the `body` JSON schema). These are entirely additive UI changes against already-working backend features.

**Delivers:**
- `CreateChannelForm`: add `twitter` to platform dropdown; render the 4 OAuth 1.0a credential fields (driven by `configSchema`); display free-tier rate limit information
- `DraftCard`: add `twitter` to `PLATFORM_STYLES`, `tweet` to `CONTENT_TYPE_STYLES`
- Thread card preview component: renders tweet drafts as numbered card list with per-tweet character count indicators (green ≤240 / yellow ≤270 / red >270)
- Tweet single-draft preview: shows `hook` text with 280-char counter
- Optionally: hook variant picker (3 alt opening tweets; chip UI matching existing `headlineOptions[]` pattern)
- Optionally: "Generate thread from this draft" button on approved long-form draft review page

**Features from FEATURES.md:** Thread card preview (required MVP); hook variant picker and thread-from-draft button (capacity permitting)

**Pitfalls avoided:** Pitfall 4 (tweet-specific review component), Pitfall 14 (documentation in UI that X Developer Portal requires an App inside a Project)

**Research flag:** Standard patterns — UI components extend existing Radix UI / Tailwind CSS patterns. No additional research needed.

---

### Phase Ordering Rationale

- **Migration before everything:** The enum values are a hard prerequisite. Nothing else can be developed or tested without them.
- **Tech debt before Twitter:** The publish-now stub and retry bug create incorrect queue behavior that would silently affect Twitter from day one. Fix queue semantics first, then build the publisher.
- **DISABLE_INTERNAL_CRON before Twitter publish:** Duplicate tweets are observable and damaging in a way that duplicate Substack or LinkedIn posts are not. This must be in place before the Twitter channel type is available to users.
- **Provider before UI:** Channel creation UI requires Twitter to be a registered platform. Provider implementation must be complete and registered before the UI work begins.
- **Tech debt in Phase 1, not interleaved:** Doing tech debt cleanup in a dedicated phase avoids context-switching and ensures all fixes are verified before feature development begins.

### Research Flags

Phases likely needing `/gsd:research-phase` during planning: **None.** All three phases are fully specified in the research files with code examples, file locations, and explicit build orders.

Phases with standard, well-documented patterns (skip research-phase):
- Phase 1 (Foundation): all fixes are confirmed by direct codebase inspection; implementation is unambiguous
- Phase 2 (Twitter Publisher): API patterns HIGH confidence from official X API docs; `twitter-api-v2` library patterns confirmed; architecture fully specified in ARCHITECTURE.md
- Phase 3 (UI): entirely additive Radix UI / Tailwind CSS component work matching existing patterns

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | `twitter-api-v2` library confirmed active, typed, `tweetThread()` confirmed; Drizzle enum migration behavior confirmed against known GitHub issues; OAuth 1.0a confirmed valid for POST /2/tweets |
| Features | HIGH | Feature boundaries confirmed against official X API docs, competitor analysis (Buffer, Postiz, Mixpost), and direct codebase inspection; MVP definition is clear |
| Architecture | HIGH | Primary source: direct codebase read of existing provider files, schema, generator, queue-runner, daemon; build order confirmed against dependency graph; all patterns additive to existing, working architecture |
| Pitfalls | HIGH (API-level pitfalls), MEDIUM (rate limit numbers) | Critical pitfalls confirmed by direct codebase inspection and official X API docs; rate limit numbers (500/month free tier) confirmed from multiple sources but X changes pricing frequently — verify at docs.x.com before shipping |

**Overall confidence:** HIGH

### Gaps to Address

- **X API free tier monthly cap exact number:** Research cites 500 posts/month from multiple sources, but X has changed this number historically and official documentation is inconsistent. Verify the current number at `docs.x.com/x-api/fundamentals/rate-limits` immediately before shipping the channel configuration UI copy.
- **Thread character count validation for emoji and non-BMP Unicode:** Twitter counts emoji as 2 characters and URLs always as 23 characters, regardless of actual length. JavaScript's `.length` returns different values. The 270-character conservative limit provides a buffer, but a production-quality implementation should use Twitter's weighted character count algorithm. Acceptable to ship with the conservative limit in v1.1 and address in v1.2 if character-limit publish failures are observed.
- **Thread engagement sweet spot:** Research cites 5-10 tweets with 7 as the engagement sweet spot, sourced from community analysis rather than Twitter's own data. The AI decomposition prompt should target 5-8 tweets as a conservative range. This can be tuned based on creator feedback post-launch.
- **Voice quality for tweets:** Research acknowledges that long-form persona prompts do not translate cleanly to 280-character content (Pitfall 9). The tweet-specific prompt additions in Phase 2 are an improvement, not a solution. Expect creators to report that generated tweets "don't sound like me" more frequently than for long-form content. This is a known limitation to document in the UI during v1.1.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `src/db/schema.ts`, `src/lib/publishing/`, `src/lib/generation/generator.ts`, `src/daemon/index.ts`, `src/app/api/queue/` — confirmed existing implementations, bugs, TODOs
- [X API v2 Create Post (official)](https://docs.x.com/x-api/posts/create-post) — thread via `reply.in_reply_to_tweet_id` confirmed; no batch thread endpoint
- [X API Rate Limits (official)](https://docs.x.com/x-api/fundamentals/rate-limits) — 100 POST requests per 15 min per user; free tier caps
- [X OAuth 1.0a (official)](https://developer.x.com/en/docs/authentication/oauth-1-0a) — 4-credential server-side pattern confirmed; no expiry
- [X OAuth 2.0 PKCE (official)](https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code) — browser redirect required, 2h access token expiry — basis for rejecting PKCE
- [PLhery/node-twitter-api-v2 GitHub](https://github.com/PLhery/node-twitter-api-v2) — `tweetThread()` confirmed; OAuth 1.0a initialization confirmed; bundled TypeScript types
- [Drizzle ORM pgEnum docs](https://orm.drizzle.team/docs/column-types/pg) — `ADD VALUE` migration support in drizzle-kit ≥0.26.2 confirmed
- [Drizzle ORM GitHub issues #2389, #3466, #4295](https://github.com/drizzle-team/drizzle-orm/issues/2389) — enum migration pitfalls confirmed
- [MDN: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat) — IANA timezone support in Node.js confirmed

### Secondary (MEDIUM confidence)
- [X Developer Community: OAuth 1.0a for API v2](https://devcommunity.x.com/t/can-i-just-use-oauth-1-0a-to-post-a-tweet-with-api-v2/201240) — confirmed valid for POST /2/tweets
- [X Developer Community: Free tier rate limits](https://devcommunity.x.com/t/specifics-about-the-new-free-tier-rate-limits/229761) — 500 posts/month free tier (verify before shipping)
- [X Developer Community: Thread API](https://devcommunity.x.com/t/api-endpoint-for-twitter-threads-or-chained-tweets/185818) — no batch thread endpoint confirmed
- [Writing Effective Twitter Threads in 2025 — usevisuals.com](https://usevisuals.com/blog/writing-effective-twitter-threads-2025) — thread structure best practices; 5-10 tweet range
- [Automate Blog to Twitter Thread — analyticsvidhya.com](https://www.analyticsvidhya.com/blog/2025/01/automate-blog-to-twitter-thread/) — AI decomposition prompt patterns
- [npm: twitter-api-v2](https://www.npmjs.com/package/twitter-api-v2) — v1.29.0 current; 244 downstream dependents

### Tertiary (MEDIUM-LOW confidence)
- Buffer, Postiz, Mixpost — competitor feature analysis for thread creation and scheduling; no programmatic access — manual review
- [AI-generated tweet voice quality analysis — apaya.com](https://apaya.com/blog/ai-twitter-x-post-generator) — voice quality limitations of LLM tweet generation

---

*Research completed: 2026-02-28*
*Ready for roadmap: yes*
