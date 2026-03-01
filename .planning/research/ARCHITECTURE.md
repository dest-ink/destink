# Architecture Patterns

**Domain:** Twitter/X publisher integration, short-form content type, thread generation
**Milestone:** v1.1 Twitter/X & Cleanup
**Researched:** 2026-02-28
**Overall confidence:** HIGH (codebase read directly; Twitter API from official docs)

---

## Integration Overview

The v1.1 features touch four existing subsystems and add one new cross-cutting layer. No subsystem needs to be redesigned — each integration point is additive.

```
Existing subsystems touched:
  db/schema.ts                         → add 'twitter' to platformEnum,
                                          add 'tweet'/'thread' to contentTypeEnum
  lib/publishing/publisher-registry.ts → add twitter import + register call
  lib/publishing/scheduler.ts          → add twitter default schedule window
  lib/generation/generator.ts          → add tweet/thread branch in buildGenerationPrompt
  app/api/queue/[id]/publish-now/      → replace stub with actual publisher dispatch
  app/api/queue/[id]/retry/            → fix retryCount reset bug
  daemon/index.ts                      → implement DISABLE_INTERNAL_CRON env var
  components/channels/CreateChannelForm → add twitter to platform dropdown

New files:
  lib/publishing/twitter.ts            → OAuth 1.0a signing, API calls
  lib/publishing/providers/twitter.provider.ts → PublisherProvider implementation
  lib/generation/thread.ts             → pure function: draft body → tweet[]
  app/api/drafts/[id]/thread/route.ts  → POST: generate thread draft from long-form draft
```

---

## Component Boundaries

### What EXISTS (do not redesign)

| Component | Location | Responsibility |
|-----------|----------|---------------|
| Registry | `src/lib/providers/registry.ts` | Generic `Registry<T>` keyed by platform string; already frozen after init |
| PublisherProvider interface | `src/lib/providers/types.ts` | Contract: `name`, `platform`, `displayName`, `publish()`, `formatDraft()`, `configSchema` |
| Publisher registry singleton | `src/lib/publishing/publisher-registry.ts` | `publisherRegistry`, `initPublisherRegistry()`, `isPublisherProvider()` type guard |
| Queue runner | `src/lib/publishing/queue-runner.ts` | `runPublishQueue()` — dispatches `publisherRegistry.get(platform).publish()` |
| Generation prompt | `src/lib/generation/generator.ts` | `buildGenerationPrompt()`, `generateDraft()` — already branches on `contentType` |
| Scheduler | `src/lib/publishing/scheduler.ts` | `assignScheduledTime(platform, config)` — keyed by platform string via `DEFAULT_WINDOWS` record |
| Bootstrap | `src/lib/bootstrap.ts` | `initRegistries()` — idempotent; called by daemon, CronJobs, Next.js instrumentation |
| DB schema | `src/db/schema.ts` | Enums: `platformEnum ['linkedin','substack']`, `contentTypeEnum ['note','article']`; tables: `channels`, `drafts`, `publishQueue` |
| Daemon | `src/daemon/index.ts` | Background cron loop on 1-min interval, SIGTERM shutdown |
| Credential encryption | `src/lib/crypto.ts` | `encrypt()`/`decrypt()` — already used by linkedin and substack |
| UI: CreateChannelForm | `src/components/channels/CreateChannelForm.tsx` | Platform dropdown hard-coded to `['linkedin','substack']` |
| UI: DraftCard | `src/components/drafts/DraftCard.tsx` | `PLATFORM_STYLES` and `CONTENT_TYPE_STYLES` maps hard-coded to existing values |

### What is NEW

| Component | Location | Responsibility |
|-----------|----------|---------------|
| Twitter API client | `src/lib/publishing/twitter.ts` | OAuth 1.0a request signing, `publishTweet()`, `publishThread()`, `formatForTwitter()`, credential parsing |
| Twitter publisher provider | `src/lib/publishing/providers/twitter.provider.ts` | Implements `PublisherProvider`; delegates to `twitter.ts`; routes on `draft.contentType` (`tweet` vs `thread`) |
| Thread generator | `src/lib/generation/thread.ts` | Pure function: splits draft body text into tweet-sized strings. No I/O. |
| Thread API route | `src/app/api/drafts/[id]/thread/route.ts` | POST endpoint: takes an approved draft, calls `splitIntoTweets()`, persists new thread draft |

---

## Data Flow

### Flow 1: Single Tweet Draft (new content type path)

```
Research engine → topic recommendation (contentType: 'tweet')
  → generateDraft() → buildGenerationPrompt() with tweet branch
      prompt spec: "1 tweet, ≤280 chars, hook = tweet text, body = empty, CTA = empty"
  → drafts row: contentType='tweet', hook=<tweet text>, body=null
  → draft review UI → user approves
  → publishQueue row created (platform='twitter')
  → daemon/queue-runner: publisherRegistry.get('twitter').publish(draft, channel)
      → twitter.provider.ts: draft.contentType === 'tweet'
          → publishTweet(draft.hook, creds)
          → POST https://api.x.com/2/tweets { text: draft.hook }
```

### Flow 2: Thread Generated from Long-form Draft

```
User opens an approved article or note draft in the review UI
  → clicks "Generate Thread" button
  → POST /api/drafts/[id]/thread
      → fetch original draft from DB
      → splitIntoTweets(draft.body, voiceProfile) → string[] (each ≤280 chars)
      → INSERT drafts: contentType='thread', hook=tweets[0], body=JSON.stringify(tweets)
      → return { draftId: newDraft.id }
  → UI navigates to new thread draft for review
  → user approves thread draft
  → publishQueue row created (platform='twitter')
  → daemon/queue-runner: publisherRegistry.get('twitter').publish(draft, channel)
      → twitter.provider.ts: draft.contentType === 'thread'
          → const tweets = JSON.parse(draft.body)
          → publishThread(tweets, creds)
              → POST /2/tweets { text: tweets[0] } → { id: id0 }
              → POST /2/tweets { text: tweets[1], reply: { in_reply_to_tweet_id: id0 } } → { id: id1 }
              → POST /2/tweets { text: tweets[2], reply: { in_reply_to_tweet_id: id1 } } → ...
          → return { tweetIds: [id0, id1, ...] }
```

### Flow 3: Publish-Now Fix (tech debt — currently a stub)

```
User clicks "Publish Now" in queue UI
  → POST /api/queue/[id]/publish-now
  → [CURRENT STUB]: sets status='publishing', returns — never dispatches
  → [FIXED]:
      → fetch draft + channel for this queue item
      → const provider = publisherRegistry.get(channel.platform)
      → platformResponse = await provider.publish(draft, channel)
      → UPDATE publishQueue SET status='published', publishedAt=now, platformResponse=...
      → UPDATE drafts SET status='published'
      → (on error): UPDATE publishQueue SET status='failed', errorMessage=...
```

### Flow 4: Retry Bug Fix (tech debt)

```
User clicks "Retry" on a failed queue item
  → POST /api/queue/[id]/retry
  → [CURRENT BUG]: SET retryCount = retryCount + 1
      This means a first-time failure (retryCount=3) immediately hits maxRetries (3)
  → [FIXED]: SET retryCount = 0, status='queued', errorMessage=null
      Retry resets the counter — the queue runner's own increment logic handles backoff
```

---

## New vs Modified: Explicit Inventory

### New Files

| File | Type | Description |
|------|------|-------------|
| `src/lib/publishing/twitter.ts` | New | OAuth 1.0a signing, `publishTweet()`, `publishThread()`, `formatForTwitter()`, credential parser. No external oauth library — sign requests manually using Node.js `crypto` module (HMAC-SHA1). |
| `src/lib/publishing/providers/twitter.provider.ts` | New | `PublisherProvider` implementation; delegates to `twitter.ts`; dispatches `tweet` vs `thread` contentType |
| `src/lib/generation/thread.ts` | New | Pure function `splitIntoTweets(body, voiceProfile?)`: tokenizes by sentence, bins into ≤280-char chunks accounting for tweet numbering overhead |
| `src/app/api/drafts/[id]/thread/route.ts` | New | POST endpoint: validates draft exists and is approved, calls `splitIntoTweets()`, inserts thread draft row, returns new draft ID |

### Modified Files

| File | Change | Why |
|------|--------|-----|
| `src/db/schema.ts` | Add `'twitter'` to `platformEnum`; add `'tweet'` and `'thread'` to `contentTypeEnum` | Required for DB storage; Drizzle migration needed |
| `src/db/migrations/` | New migration file (via `drizzle-kit generate`) | Schema enum changes require a migration — enums cannot be altered in-place in PostgreSQL without a migration |
| `src/lib/publishing/publisher-registry.ts` | Add twitter import and `register()` call in `initPublisherRegistry()` | Same pattern as the existing linkedin and substack imports; one import + one register call |
| `src/lib/publishing/scheduler.ts` | Add `twitter` key to `DEFAULT_WINDOWS` record with appropriate defaults | Platform-specific scheduling defaults (suggest: weekday mornings, similar to LinkedIn) |
| `src/lib/generation/generator.ts` | Add `tweet` branch in `buildGenerationPrompt()`; adjust JSON output spec | Tweet prompts have a distinct character constraint and output shape; `thread` content is generated externally by the splitter, not by the AI |
| `src/app/api/queue/[id]/publish-now/route.ts` | Replace stub with actual publisher dispatch (load draft+channel, call provider, update rows) | Tech debt: stub sets status='publishing' and stops — never publishes |
| `src/app/api/queue/[id]/retry/route.ts` | Change `retryCount = retryCount + 1` to `retryCount = 0` | Tech debt: incrementing on retry bypasses the queue runner's own maxRetries=3 logic |
| `src/daemon/index.ts` | Check `DISABLE_INTERNAL_CRON` env var; skip `schedule()` if set to `'true'` | Tech debt: env var is documented but never read in code |
| `src/lib/publishing/scheduler.ts` | Replace server-local-time window resolution with `Intl.DateTimeFormat` timezone arithmetic | Tech debt: `TODO: window hours resolved in server local time, not cfg.timezone` — now must work correctly |
| `src/components/channels/CreateChannelForm.tsx` | Add `'twitter'` to platform `<Select>` options; surface API error messages more specifically | New platform; error message cleanup |
| `src/components/drafts/DraftCard.tsx` | Add `twitter` to `PLATFORM_STYLES`; add `tweet` and `thread` to `CONTENT_TYPE_STYLES` | UI recognizes new platform and content types |

---

## Twitter OAuth Architecture Decision

**Use OAuth 1.0a with pre-generated access tokens. Do not implement OAuth 2.0 PKCE.**

Rationale: Orbitl is a self-hosted tool. The user generates API credentials in the X Developer Portal and pastes them into the channel credential form — no browser redirect flow is needed and none should be required.

OAuth 1.0a with pre-generated tokens is the standard server-side posting pattern:
- `apiKey` (Consumer Key, app-level)
- `apiKeySecret` (Consumer Secret, app-level)
- `accessToken` (user-level, generated once in developer portal)
- `accessTokenSecret` (user-level, generated once in developer portal)

These four values are stored encrypted in `channels.credentials` using the existing `encrypt()`/`decrypt()` functions in `src/lib/crypto.ts`. The `configSchema` field on the provider object defines all four required fields, which automatically drives the UI credential form.

**Why not OAuth 2.0 PKCE:** OAuth 2.0 user context requires a redirect URI and browser-initiated authorization dance. It also issues short-lived access tokens (2-hour expiry) requiring a refresh token flow. This adds infrastructure (a callback endpoint, token refresh cron, token storage column) that is entirely unnecessary for a self-hosted tool where the user controls the API keys. OAuth 1.0a tokens do not expire unless revoked, making them suitable for a long-running publishing daemon.

**Request signing:** OAuth 1.0a uses HMAC-SHA1 signatures. Implement signing with Node.js built-in `crypto.createHmac('sha1', signingKey)`. No external oauth library is needed — the signature construction is approximately 30 lines of code and has no dependencies.

**Thread posting:** Threads are built by chaining sequential `POST /2/tweets` requests. Each tweet after the first includes `reply.in_reply_to_tweet_id` pointing to the previous tweet's ID. The X API has no batch thread endpoint. Error handling: if tweet N in a thread fails, `publishThread()` should record the IDs of successfully posted tweets in the error message so the user understands the partial post state.

**Rate limits (confidence: MEDIUM from official X API docs and community sources):**
- Free tier: approximately 500 posts/month per app/user
- Per-user write: 100 requests per 15 minutes
- A 10-tweet thread consumes 10 of those 500 monthly posts

For a solo creator posting one thread per day (30 days × 10 tweets = 300 posts/month), the free tier is workable. Document this constraint in channel configuration UI.

---

## Patterns to Follow

### Pattern 1: Publisher Provider (replicate existing pattern exactly)

Every publisher follows the shape of `linkedin.provider.ts`. The Twitter provider is structurally identical:

```typescript
// src/lib/publishing/providers/twitter.provider.ts
import type { PublisherProvider } from '@/lib/providers/types';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';
import { publishToTwitter, formatForTwitter } from '../twitter';

const twitterProvider: PublisherProvider = {
  name: 'twitter',
  platform: 'twitter',
  displayName: 'X (Twitter)',
  description: 'Publish tweets and threads to X',
  apiVersion: PROVIDER_API_VERSION,
  configSchema: [
    { key: 'apiKey',            label: 'API Key',             type: 'secret', required: true },
    { key: 'apiKeySecret',      label: 'API Key Secret',      type: 'secret', required: true },
    { key: 'accessToken',       label: 'Access Token',        type: 'secret', required: true },
    { key: 'accessTokenSecret', label: 'Access Token Secret', type: 'secret', required: true },
  ],
  publish:     (draft, channel) => publishToTwitter(draft, channel),
  formatDraft: (draft, _channel) => formatForTwitter(draft),
};

export default twitterProvider;
```

The `publishToTwitter()` function in `twitter.ts` inspects `draft.contentType`:
- `'tweet'` → `publishTweet(draft.hook, creds)`
- `'thread'` → `publishThread(JSON.parse(draft.body!), creds)`

### Pattern 2: Tweet Generation Prompt Branch

`buildGenerationPrompt()` in `generator.ts` already branches on `contentType`. Add a `tweet` case:

```typescript
const spec = contentType === 'tweet'
  ? '1 tweet, maximum 280 characters, no thread numbering, no hashtags unless organic'
  : contentType === 'note'
  ? '150–300 words, punchy and direct, optimized for social scroll-stopping'
  : '800–2000 words, structured argument with clear thesis, supporting points, and conclusion';
```

For `tweet` content type, the AI output shape differs: `hook` contains the full tweet text, `body` and `cta` are empty strings, `headlineOptions` is an empty array. The `GeneratedDraft` type is unchanged — callers persist the same fields as for any other content type.

### Pattern 3: Thread Storage Convention

A thread draft is a `drafts` row with `contentType='thread'`. The `body` field stores the tweet array as a JSON string (`JSON.stringify(string[])`). The `hook` field stores `tweets[0]` for card preview. The publisher parses `body` back to `string[]` at publish time.

This avoids a new table. The convention is pragmatic — a dedicated `tweetThreads` table would add schema complexity for no benefit in a single-user tool.

```typescript
// Storing a thread draft
await db.insert(drafts).values({
  channelId,
  contentType: 'thread',
  hook: tweets[0],                        // first tweet — used for card preview
  body: JSON.stringify(tweets),           // full array — parsed by publisher
  status: 'pending_review',
  // ... other fields
});
```

### Pattern 4: Publish-Now Dispatch (fixing the stub)

The fixed route loads the draft + channel, dispatches through the registry, and updates both `publishQueue` and `drafts` rows — the same logic as `runPublishQueue()` for a single item:

```typescript
// src/app/api/queue/[id]/publish-now/route.ts (fixed)
const provider = publisherRegistry.get(channel.platform);
// (publisherRegistry.get() throws if platform is unregistered — let it bubble as 500)
const platformResponse = await provider.publish(draft, channel);
await db.update(publishQueue).set({ status: 'published', publishedAt: new Date(), platformResponse }).where(...);
await db.update(drafts).set({ status: 'published' }).where(...);
```

`initPublisherRegistry()` is idempotent — Next.js instrumentation will have already called it. The route does not need to call it explicitly, but doing so is safe.

### Pattern 5: Default Scheduler Window for Twitter

Add to `DEFAULT_WINDOWS` in `scheduler.ts`:

```typescript
twitter: {
  timezone: 'America/New_York',
  minGapHours: 4,
  jitterMinutes: 15,
  timeWindows: [
    { dayOfWeek: [1, 2, 3, 4, 5], startHour: 8, endHour: 10 },
    { dayOfWeek: [1, 2, 3, 4, 5], startHour: 12, endHour: 13 },
    { dayOfWeek: [1, 2, 3, 4, 5], startHour: 17, endHour: 19 },
  ],
},
```

Twitter engagement peaks are weekday mornings and lunch — different from LinkedIn. Shorter min gap (4h vs 18h) because Twitter's posting cadence is higher.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Thread Storage in a Separate Table

**What it is:** Creating a `tweetThreads` table with one row per tweet linked to a draft.
**Why bad:** Adds schema complexity, new migrations, and join logic for a feature used by a single creator. The `body` JSON-string convention is sufficient at this scale.
**Instead:** Store `body` as `JSON.stringify(tweets)` on the existing `drafts` row with `contentType='thread'`.

### Anti-Pattern 2: OAuth 2.0 PKCE for Twitter Credentials

**What it is:** Implementing a callback endpoint, code verifier flow, and token refresh for Twitter auth.
**Why bad:** Requires a public redirect URI, browser interaction during channel setup, and a token refresh mechanism. Tokens expire in 2 hours. This is 3x the implementation complexity of OAuth 1.0a for no user-facing benefit in a self-hosted tool.
**Instead:** OAuth 1.0a with pre-generated tokens from the X Developer Portal. Tokens are long-lived unless revoked.

### Anti-Pattern 3: Assuming a Batch Thread Endpoint

**What it is:** Making one API call to post an entire thread.
**Why bad:** The X API has no such endpoint. The documentation and developer community confirm threads are built by chaining `reply.in_reply_to_tweet_id`.
**Instead:** Sequential `POST /2/tweets` calls. Record IDs as you go. On failure at tweet N, surface a clear error: "Thread partially posted: N of M tweets succeeded."

### Anti-Pattern 4: Bypassing the Registry in publish-now

**What it is:** Importing `publishToTwitter` directly in the publish-now route instead of using `publisherRegistry.get()`.
**Why bad:** Breaks platform-agnostic design. The route would only work for Twitter channels.
**Instead:** Always dispatch via `publisherRegistry.get(channel.platform)` — the same path the queue runner uses.

### Anti-Pattern 5: Conditionals in scheduler.ts Instead of the DEFAULT_WINDOWS Record

**What it is:** Adding `if (platform === 'twitter')` logic inside `assignScheduledTime()`.
**Why bad:** The function already uses a `DEFAULT_WINDOWS` record keyed by platform string. Adding a conditional branch violates the existing pattern and makes the function harder to extend.
**Instead:** Add a `twitter` key to `DEFAULT_WINDOWS`. The lookup `config ?? DEFAULT_WINDOWS[platform] ?? DEFAULT_WINDOWS.linkedin` handles it automatically.

---

## Build Order

Dependencies determine order. Each step unblocks the next.

| Step | Work | Files | Why This Order |
|------|------|-------|---------------|
| 1 | DB schema + migration | `src/db/schema.ts`, new migration | Everything downstream depends on `'twitter'` in `platformEnum` and `'tweet'`/`'thread'` in `contentTypeEnum`. Cannot create drafts or channels of these types without this. |
| 2 | Twitter API client | `src/lib/publishing/twitter.ts` | The provider delegates to this. Build and unit-test the signing logic and API calls in isolation before wiring. |
| 3 | Twitter provider + registry registration | `src/lib/publishing/providers/twitter.provider.ts`, `src/lib/publishing/publisher-registry.ts`, `src/lib/publishing/scheduler.ts` | Depends on Step 1 (enum value) and Step 2 (client). After this, the queue runner can dispatch to Twitter. |
| 4 | Tweet generation prompt | `src/lib/generation/generator.ts` (modify) | Depends on Step 1 (new contentType value). Independent of Steps 2–3. **Can run in parallel with Step 2.** |
| 5 | Thread splitter | `src/lib/generation/thread.ts` | Pure function, no dependencies. Can be built and unit-tested at any point. **Can run in parallel with Steps 2–3.** |
| 6 | Thread API route | `src/app/api/drafts/[id]/thread/route.ts` | Depends on Steps 1 and 5. Creates thread draft rows. |
| 7 | Tech debt fixes | publish-now route, retry route, daemon DISABLE_INTERNAL_CRON, scheduler timezone | Independent of Twitter features entirely. Can be done in parallel with Steps 2–6. Grouping here avoids context-switching mid-feature. |
| 8 | UI updates | `CreateChannelForm`, `DraftCard`, thread preview in draft detail panel | Depends on Steps 1 and 3 (Twitter must be registered for channel creation to succeed). |

**Parallel opportunities:**
- Steps 2 and 4 are fully independent of each other.
- Step 5 (thread splitter) is a pure function testable in isolation from day one.
- Step 7 (tech debt) has no dependency on any Twitter work.

**Recommended grouping for a single-developer sprint:**
1. Step 1 (schema migration) — unlock everything
2. Steps 2 + 3 together (Twitter client + provider) — end with a working publisher
3. Steps 4 + 5 together (generation + splitter) — content type support
4. Step 6 (thread route) — connects generation to draft creation
5. Step 7 (tech debt fixes) — independent cleanup
6. Step 8 (UI) — surface everything in the interface

---

## Scalability Considerations

Twitter rate limits are the binding constraint for this feature, not infrastructure.

| Concern | At 1 channel | At 10 channels | At 100 channels |
|---------|-------------|----------------|----------------|
| X API rate limit | ~500 posts/month free — sufficient for daily posting | Free tier exhausted if all channels post daily threads | Requires paid API tier. Out of scope for self-hosted solo tool. |
| Thread atomicity | One failure aborts remaining tweets — surface partial post count in errorMessage | Same — per-queue-item error messages handle it | Same |
| DB schema | No impact | No impact | No impact — existing schema scales to hundreds of channels |
| OAuth token management | One set of 4 credentials per channel, stored encrypted | Same — one per channel | Same — no shared token store needed |

The free tier limit (500 posts/month) should be documented in the Twitter channel creation UI or channel detail page so users understand the constraint before they encounter failures.

---

## Sources

- Codebase read directly: `src/lib/providers/`, `src/lib/publishing/`, `src/lib/generation/`, `src/db/schema.ts`, `src/daemon/`, `src/app/api/` — HIGH confidence (primary source)
- [X API v2 Create Post endpoint (official docs)](https://docs.x.com/x-api/posts/create-post) — thread via `reply.in_reply_to_tweet_id` confirmed; HIGH confidence
- [X API Rate Limits (official docs)](https://docs.x.com/x-api/fundamentals/rate-limits) — 100 writes per 15 min per user confirmed; MEDIUM confidence on free-tier monthly caps (500/month from search corroboration)
- [X OAuth 1.0a documentation (official)](https://developer.x.com/en/docs/authentication/oauth-1-0a) — four-credential pattern for server-side apps confirmed; HIGH confidence
- [X OAuth 2.0 PKCE documentation (official)](https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code) — browser redirect required, 2h token expiry confirmed; HIGH confidence (basis for rejecting PKCE approach)
- [X developer community: thread API (official forum)](https://devcommunity.x.com/t/api-endpoint-for-twitter-threads-or-chained-tweets/185818) — confirms no batch thread endpoint; MEDIUM confidence

---

*Architecture research for: Orbitl v1.1 Twitter/X & Cleanup*
*Researched: 2026-02-28*
