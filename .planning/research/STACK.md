# Stack Research

**Domain:** Twitter/X publisher integration, short-form content type, thread decomposition, and v1.0 tech debt fixes for an existing Next.js/TypeScript social content generator
**Researched:** 2026-02-28
**Confidence:** HIGH for twitter-api-v2 and schema changes; MEDIUM for timezone fix rationale; MEDIUM for API tier limits (X changes policies frequently)

---

## Context

This is a subsequent-milestone research file. The existing app already has:
Next.js 16.1.6, TypeScript 5, Drizzle ORM 0.45.1, PostgreSQL (pg 8.19.0), Tailwind CSS 4, Radix UI, Zod 3.25.x, Vitest, tsx, node-cron, Anthropic Claude SDK.

The publisher provider system is already built and working (LinkedIn, Substack). The DB schema has `platformEnum`, `contentTypeEnum`, and `draftStatusEnum` as PostgreSQL enums. The generation pipeline (`generator.ts`) handles `note` and `article` content types today.

This research covers **only new additions and changes** needed for:
1. Twitter/X publisher provider (OAuth 1.0a credentials, tweet posting, thread posting)
2. Short-form content type (`tweet` added to `contentTypeEnum`)
3. Thread generation from long-form drafts (new generation path in `generator.ts`)
4. Scheduler timezone fix (existing TODO in `scheduler.ts`)
5. v1.0 tech debt fixes (publish-now stub, retry bug, DISABLE_INTERNAL_CRON, CreateChannelForm errors)

Do not re-evaluate the existing stack. The existing choices are locked.

---

## Recommended Stack

### New Library: Twitter/X API Client

**Verdict: `twitter-api-v2` (plhery/node-twitter-api-v2). The clear ecosystem winner — strongly typed, ships its own TypeScript definitions, handles both single-tweet and thread posting natively.**

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `twitter-api-v2` | `^1.29.0` | Twitter/X API v2 client for posting tweets and threads | Only actively-maintained, fully-typed Node.js X API client. Ships its own TypeScript definitions — no `@types/*` needed. Has `client.v2.tweet()` for single tweets and `client.v2.tweetThread()` for thread arrays. OAuth 1.0a and OAuth 2.0 both supported. |

**Authentication choice: OAuth 1.0a User Context (not OAuth 2.0 PKCE)**

Use OAuth 1.0a because:
- Simpler credential set: 4 static strings (`appKey`, `appSecret`, `accessToken`, `accessSecret`) stored once in the channel credentials JSON, just like the existing LinkedIn `accessToken`/`personUrn` pair
- No token refresh needed — OAuth 1.0a tokens do not expire (OAuth 2.0 tokens expire in 2 hours and require a refresh cycle and secure token storage updates)
- OAuth 2.0 PKCE requires an interactive browser authorization flow, which is a worse UX for a self-hosted tool where the user configures credentials once in the channel settings form
- Both OAuth 1.0a and OAuth 2.0 support POST `/2/tweets` on the current API

The four required credentials from the X Developer Portal:
```
API Key            → appKey
API Secret         → appSecret
Access Token       → accessToken
Access Token Secret → accessSecret
```

These are stored as encrypted JSON in `channels.credentials`, consistent with the LinkedIn provider pattern.

**Client initialization:**
```typescript
import { TwitterApi } from 'twitter-api-v2';

const client = new TwitterApi({
  appKey: creds.appKey,
  appSecret: creds.appSecret,
  accessToken: creds.accessToken,
  accessSecret: creds.accessSecret,
});
```

**Single tweet:**
```typescript
await client.v2.tweet({ text: 'Content here — max 280 characters' });
```

**Thread (reply chain):**
```typescript
// tweetThread automatically chains each tweet as a reply to the previous one
await client.v2.tweetThread([
  'Tweet 1 — the hook',
  'Tweet 2 — first point',
  'Tweet 3 — second point',
  '4/ CTA and takeaway',
]);
```

### Schema Changes: No New Libraries, Just Migrations

Two PostgreSQL enum values need to be added. Drizzle Kit generates the correct `ALTER TYPE ... ADD VALUE` SQL automatically when the enum definition is updated in `schema.ts`.

**`contentTypeEnum`** — add `'tweet'` value:
```typescript
// Before
export const contentTypeEnum = pgEnum('content_type', ['note', 'article']);

// After
export const contentTypeEnum = pgEnum('content_type', ['note', 'article', 'tweet']);
```

**`platformEnum`** — add `'twitter'` value:
```typescript
// Before
export const platformEnum = pgEnum('platform', ['linkedin', 'substack']);

// After
export const platformEnum = pgEnum('platform', ['linkedin', 'substack', 'twitter']);
```

**Drizzle Kit generates:**
```sql
ALTER TYPE "public"."content_type" ADD VALUE 'tweet';
ALTER TYPE "public"."platform" ADD VALUE 'twitter';
```

No data migrations required — existing rows are unaffected by adding new enum values. Drizzle Kit 0.26.2+ handles `ADD VALUE` correctly (Drizzle Kit 0.31.9 is already installed, which includes this support).

**ResearchConfig also needs updating** (in-code TypeScript change, no migration):
```typescript
// schema.ts contentTypeMix needs 'tweet' added
contentTypeMix: { note: number; article: number; tweet: number };
```

### Scheduler Timezone Fix: Built-in `Intl` API, No New Library

The existing `scheduler.ts` has an explicit TODO:
```typescript
// TODO: window hours are currently resolved in server local time, not cfg.timezone.
//       Add IANA timezone arithmetic (via Intl or a date library) before production use.
```

**Verdict: Fix this with the built-in `Intl.DateTimeFormat` API. No new library needed.**

Node.js 20+ ships full IANA timezone support through the V8 ICU data layer. The `Intl.DateTimeFormat` constructor accepts any IANA timezone identifier (`America/New_York`, `Europe/London`, etc.) and can extract hour and day-of-week from a UTC date in that timezone.

```typescript
// Determine what hour it is in a given IANA timezone — no library required
function getHourInTimezone(utcDate: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: timezone,
  }).formatToParts(utcDate);
  return parseInt(parts.find(p => p.type === 'hour')!.value, 10);
}

function getDayOfWeekInTimezone(utcDate: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'narrow',
    timeZone: timezone,
  }).formatToParts(utcDate);
  // Map weekday names to getDay() convention (0=Sun)
  const dayMap: Record<string, number> = { S: 0, M: 1, T: 2, W: 3, F: 5 };
  // Better: use numeric day
  return new Date(
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(utcDate)
  ).getDay();
}
```

The cleanest production approach for this specific use case (constructing a UTC timestamp for a target hour in a given timezone) uses `Intl` to find the offset, then adjusts. The implementation is 20-30 lines of utility code in `scheduler.ts`. No npm dependency needed.

If this timezone logic ever grows in complexity (e.g., DST edge case handling, recurring schedule generation), `@date-fns/tz@^1.4.1` or `date-fns-tz@^3.x` are the right next step — but both are overkill for fixing a single scheduling function.

### v1.0 Tech Debt Fixes: No New Libraries

All five v1.0 debt items are code-only fixes in existing files:

| Debt Item | File | Fix |
|-----------|------|-----|
| Publish-now stub | `app/.../publish-now/route.ts` (or similar) | Wire the route handler to call `publisherRegistry.get(platform).publish(draft, channel)` directly instead of a stub |
| Retry bug: retryCount not reset | `src/lib/publishing/queue-runner.ts` | Add `retryCount: 0` to the UPDATE query when re-queuing a failed item for retry |
| DISABLE_INTERNAL_CRON not implemented | `src/daemon/index.ts` | Add `if (process.env.DISABLE_INTERNAL_CRON === 'true') return;` guard at the cron registration call site |
| Scheduler timezone TODO | `src/lib/publishing/scheduler.ts` | Replace `setHours()` based on local time with `Intl`-based UTC offset calculation (see above) |
| CreateChannelForm actionable errors | `src/components/.../CreateChannelForm.tsx` | Surface specific validation/API error messages instead of generic failures; already using react-hook-form + Zod so error binding is straightforward |

---

## Integration Points

### Twitter Provider File

The new provider follows the existing `PublisherProvider` interface exactly:

```typescript
// src/lib/publishing/providers/twitter.provider.ts
import type { PublisherProvider } from '@/lib/providers/types';
import { PROVIDER_API_VERSION } from '@/lib/providers/types';
import { publishToTwitter, formatForTwitter } from '../twitter';

const twitterProvider: PublisherProvider = {
  name: 'twitter',
  platform: 'twitter',          // Must match new platformEnum value
  displayName: 'X (Twitter)',
  description: 'Publish tweets and threads to your X account',
  apiVersion: PROVIDER_API_VERSION,
  configSchema: [
    { key: 'appKey',       label: 'API Key',              type: 'secret', required: true },
    { key: 'appSecret',    label: 'API Secret',           type: 'secret', required: true },
    { key: 'accessToken',  label: 'Access Token',         type: 'secret', required: true },
    { key: 'accessSecret', label: 'Access Token Secret',  type: 'secret', required: true },
  ],
  publish: (draft, channel) => publishToTwitter(draft, channel),
  formatDraft: (draft, _channel) => formatForTwitter(draft),
};

export default twitterProvider;
```

Then register it in `publisher-registry.ts`:
```typescript
const { default: twitter } = await import('./providers/twitter.provider');
if (isPublisherProvider(twitter)) publisherRegistry.register(twitter);
```

### Twitter Implementation File

```typescript
// src/lib/publishing/twitter.ts
import { TwitterApi } from 'twitter-api-v2';
import { decrypt } from '@/lib/crypto';

// 280 characters is the standard API limit for non-Premium accounts.
// Thread tweets are each individually limited to 280 chars.
const TWEET_MAX = 280;

// Thread posts: format body into 280-char segments and post as tweetThread.
// Single tweet (contentType 'tweet'): post as a single tweet using just hook.
export function formatForTwitter(draft: DraftRow): string | string[] {
  if (draft.contentType === 'tweet') {
    // Short-form: hook is the tweet body (generated to be ≤280 chars)
    return (draft.hook ?? '').slice(0, TWEET_MAX);
  }
  // Thread: split body into pre-chunked segments stored in body as JSON array,
  // or fall back to naive chunking of the body text.
  // (Implementation detail: thread segments are stored in draft.body as JSON array)
  try {
    const segments = JSON.parse(draft.body ?? '[]') as string[];
    if (Array.isArray(segments) && segments.every(s => typeof s === 'string')) {
      return segments.map(s => s.slice(0, TWEET_MAX));
    }
  } catch { /* fall through to naive chunking */ }
  return [draft.hook ?? '', draft.body ?? ''].filter(Boolean).map(s => s.slice(0, TWEET_MAX));
}

export async function publishToTwitter(draft: DraftRow, channel: ChannelRow): Promise<TwitterPublishResult> {
  const creds = parseTwitterCredentials(channel);
  const client = new TwitterApi({ ...creds });

  const formatted = formatForTwitter(draft);
  if (Array.isArray(formatted)) {
    // Thread
    const results = await client.v2.tweetThread(formatted);
    return { id: results[0].data.id, threadIds: results.map(r => r.data.id) };
  } else {
    // Single tweet
    const result = await client.v2.tweet({ text: formatted });
    return { id: result.data.id };
  }
}
```

### Short-Form Generation Path

The `generator.ts` file needs a `tweet` branch added to `buildGenerationPrompt`. Short-form tweet generation uses the same Claude call but with a different prompt spec:

```typescript
// Existing spec selection:
const spec = contentType === 'note'
  ? '150–300 words, punchy and direct, optimized for social scroll-stopping'
  : '800–2000 words, structured argument...';

// Add tweet branch:
const spec =
  contentType === 'tweet'
    ? 'SINGLE TWEET: exactly 1 tweet of max 240 characters (leave buffer for hashtags). Return the tweet text in the "hook" field. Set body to "" and cta to "". The hook IS the complete tweet.'
  : contentType === 'note'
    ? '150–300 words, punchy and direct, optimized for social scroll-stopping'
    : '800–2000 words, structured argument with clear thesis, supporting points, and conclusion';
```

For **thread generation from a long-form draft**, this is a separate operation (not the standard generation pipeline). It takes an existing approved `note` or `article` draft and decomposes it into tweet segments. This calls Claude with a decomposition prompt and returns a new draft with `contentType: 'tweet'` and the segments stored as a JSON array in `body`. No new library needed — this is a prompt engineering task with the existing Anthropic SDK.

```typescript
// Thread decomposition prompt pattern (pure prompt, no new library)
const THREAD_DECOMPOSITION_SYSTEM = `You are a social media editor. Convert long-form content into Twitter/X threads.
Each tweet must be ≤240 characters (leave headroom for numbering).
The thread should flow naturally as a conversation, not a bulleted list.`;

const THREAD_DECOMPOSITION_PROMPT = (draft: DraftRow) => `
Convert this content into a Twitter thread. Return ONLY a JSON array of tweet strings.
Each string must be ≤240 characters.
Start with a hook tweet that stands alone.
End with a CTA or takeaway tweet.
Use 4–8 tweets for a note-length piece; 8–15 for an article.

CONTENT:
${[draft.hook, draft.body, draft.cta].filter(Boolean).join('\n\n')}

Return only: ["tweet 1 text", "tweet 2 text", ...]`;
```

---

## API Tier Constraints

The X API tier situation is important for the initial channel setup UX. The credentials form should communicate these limits:

| Tier | Monthly Post Limit | Cost | Notes |
|------|-------------------|------|-------|
| Free | 500 posts/month | $0 | Write-only (no read endpoints). Posts only — no reading timeline, search, etc. Sufficient for Orbitl's publish-only use case. |
| Basic | 10,000 posts/month | $200/month | Higher limits. Not required for personal use. |

**For Orbitl's use case (publish-only, single creator):** The Free tier (500 posts/month) is sufficient. A creator publishing 1-2 threads per day uses ~60 API calls/month (a 6-tweet thread = 6 POST requests). Well within limits.

**Rate limits for posting:** 100 POST `/2/tweets` per 15 minutes per user (user-level OAuth 1.0a). Threads of up to 15 tweets well within this window.

**Thread reply restriction:** Creating a thread using `tweetThread()` works by posting each subsequent tweet as a reply to the previous one. This reply-to-self mechanism functions on the Free tier — the restriction on replies (that you can only reply to accounts you follow or that have mentioned you) does not apply to replying to your own tweets.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Twitter/X npm client | `twitter-api-v2` | `twitter-v2` (HunterLarco) | `twitter-v2` is unmaintained — last release years ago. `twitter-api-v2` is actively maintained, ships bundled types, and has native `tweetThread()` support. |
| Twitter/X npm client | `twitter-api-v2` | Raw `fetch` to POST `/2/tweets` | OAuth 1.0a HMAC-SHA1 signing is tedious to implement correctly. `twitter-api-v2` handles signing internally. No reason to avoid the library here. |
| Auth method | OAuth 1.0a | OAuth 2.0 PKCE | OAuth 2.0 requires token refresh (2-hour expiry), a browser-based authorization flow, and secure refresh token storage updates. OAuth 1.0a uses static credentials like every other provider in the app. Simpler for a self-hosted tool. |
| Timezone fix | `Intl.DateTimeFormat` (built-in) | `date-fns-tz` or `@date-fns/tz` | Scheduler fix requires 20 lines of Intl arithmetic — no library justified. `date-fns-tz` (3.x) and `@date-fns/tz` (1.4.1) are the right choice if timezone complexity grows significantly. |
| Thread storage | JSON array in `drafts.body` | New `thread_tweets` table | The existing schema stores `body` as text; a thread is stored as `JSON.stringify(string[])`. Avoids a new table and migration for what is structurally a different serialization of the same content. If thread management complexity grows (reorder individual tweets, per-tweet images), a dedicated table is the right call. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `twitter-v2` npm package (HunterLarco) | Unmaintained. Last release was 2+ years ago. No `tweetThread()` support. | `twitter-api-v2` by plhery |
| `twitter-api-sdk` (official X SDK) | The official X SDK for Node.js is poorly maintained and lags behind API changes. The community library `twitter-api-v2` has better TypeScript support and is more widely used (244 downstream projects vs. minimal usage for the official SDK). | `twitter-api-v2` |
| App-Only Bearer Token (OAuth 2.0 app-only) | App-only auth cannot post tweets — it only supports read endpoints. POST `/2/tweets` requires user context authentication. | OAuth 1.0a User Context with 4-credential set |
| `luxon` for timezone fix | Luxon is 50KB+ and adds a full date/time library for what is a narrow IANA timezone offset problem. Overkill for fixing one function. | `Intl.DateTimeFormat` built-in |
| Storing thread tweets as separate `drafts` rows | Thread tweets are a single publishable unit. Modeling them as N drafts breaks the review UX (you'd have to approve each tweet individually) and complicates the queue runner. Store as a JSON array in `body`. | JSON array in `drafts.body` with `contentType: 'tweet'` + a `isThread` flag or thread segment count |
| Zod 4 (`zod/v4`) | Already in existing STACK.md: Zod 4 is at a subpath, project uses Zod 3.25.x. Do not upgrade this milestone. | Zod 3.25.x (current) |

---

## Installation

```bash
# Single new runtime dependency for the Twitter/X publisher:
npm install twitter-api-v2

# No other new dependencies required:
# - Schema changes: drizzle-kit generate + migrate (tools already installed)
# - Timezone fix: built-in Intl API
# - Thread generation: existing Anthropic SDK
# - v1.0 debt fixes: code-only changes in existing files
```

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `twitter-api-v2@^1.29.0` | Node.js 18+ | Requires Node.js 18+ for modern fetch. Project uses Node.js 20+ (from Docker base). No conflict. |
| `twitter-api-v2@^1.29.0` | TypeScript 5.x | Ships bundled type definitions. No `@types/twitter-api-v2` needed. |
| `twitter-api-v2@^1.29.0` | ESM + CommonJS | Works in both module systems. tsx runner (used in dev) handles it correctly. |
| Drizzle Kit `0.31.9` | `ALTER TYPE ADD VALUE` | Drizzle Kit ≥0.26.2 generates correct `ADD VALUE` SQL for pgEnum additions. Version 0.31.9 is confirmed compatible. |
| `contentTypeEnum` with `'tweet'` | Existing `drafts` rows | `ADD VALUE` does not affect existing rows. LinkedIn and Substack drafts keep their current `note`/`article` values unchanged. |
| `platformEnum` with `'twitter'` | Existing `channels` rows | Same — existing LinkedIn/Substack channels unaffected. |
| `Intl.DateTimeFormat` timezone | Node.js 20 (Docker base) | Node.js 20 ships with full ICU data. IANA timezone support confirmed available without additional packages. |

---

## Stack Patterns by Variant

**For single-tweet posts (contentType: 'tweet'):**
- Generate with Claude using the tweet spec (≤240 chars in `hook` field)
- Store as a standard `drafts` row with `contentType: 'tweet'`
- Publish via `client.v2.tweet({ text: draft.hook })`
- The `body` field is empty; `cta` is empty

**For thread posts (thread generated from long-form draft):**
- Decompose via separate Claude call using the thread decomposition prompt
- Store segments as `JSON.stringify(string[])` in `drafts.body`; `contentType: 'tweet'`; `title` holds the thread headline
- Publish via `client.v2.tweetThread(segments)` — library handles reply chaining automatically
- `formatDraft` returns the first segment for preview purposes

**For the review UI (both variants):**
- Single tweet: show `hook` text with character counter
- Thread: show numbered tweet list parsed from `body` JSON; allow editing individual segments
- No new UI component library needed — extend existing draft review components

**For the X Developer Portal setup (user-facing docs/config):**
- User creates an App under their Project in the X Developer Portal
- Enables OAuth 1.0a in App Settings → User authentication settings
- Sets permissions to "Read and Write"
- Copies API Key, API Secret, Access Token, Access Token Secret to Orbitl channel config form
- No callback URL or web auth flow needed — the 4 static tokens are sufficient

---

## Sources

- [PLhery/node-twitter-api-v2 GitHub](https://github.com/PLhery/node-twitter-api-v2) — Version 1.28.0 (Nov 2025); `tweetThread()` method confirmed; OAuth 1.0a initialization confirmed; TypeScript types bundled; HIGH confidence
- [node-twitter-api-v2/doc/v2.md](https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/v2.md) — `tweetThread(tweets: (SendTweetV2Params | string)[])` method signature confirmed; MEDIUM confidence (summary via WebFetch)
- [node-twitter-api-v2/doc/examples.md](https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/examples.md) — OAuth 1.0a four-credential initialization confirmed; MEDIUM confidence
- [X Developer Community: OAuth 1.0a vs OAuth 2.0 for posting](https://devcommunity.x.com/t/can-i-just-use-oauth-1-0a-to-post-a-tweet-with-api-v2/201240) — OAuth 1.0a confirmed valid for POST /2/tweets; MEDIUM confidence
- [X Developer Community: Free tier rate limits](https://devcommunity.x.com/t/specifics-about-the-new-free-tier-rate-limits/229761) — 500 posts/month free, 10K basic; MEDIUM confidence (X changes these frequently — verify at docs.x.com before shipping)
- [X API Rate Limits docs](https://docs.x.com/x-api/fundamentals/rate-limits) — 100 POST /2/tweets per 15min per user (OAuth user context); MEDIUM confidence
- [Drizzle ORM pgEnum docs](https://orm.drizzle.team/docs/column-types/pg) — pgEnum ADD VALUE migration support in drizzle-kit ≥0.26.2; HIGH confidence
- [MDN: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat) — IANA timezone support in Node.js via V8 ICU; HIGH confidence
- [npm: twitter-api-v2](https://www.npmjs.com/package/twitter-api-v2) — Version 1.29.0 current (as of search, ~Jan 2026); 244 downstream dependents; MEDIUM confidence

---

*Stack research for: Orbitl v1.1 — Twitter/X publisher, short-form content, thread decomposition, tech debt*
*Researched: 2026-02-28*
