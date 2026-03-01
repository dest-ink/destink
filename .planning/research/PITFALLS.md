# Domain Pitfalls — v1.1: Twitter/X Publisher, Short-Form Content & Tech Debt Cleanup

**Domain:** Adding Twitter/X publishing, short-form content type, thread generation, and tech debt fixes to an existing social content generator
**Researched:** 2026-02-28
**Confidence:** HIGH (Twitter API v2 official docs, direct codebase analysis), MEDIUM (thread/voice patterns from community sources), HIGH (tech debt items from direct code inspection)

---

## Critical Pitfalls

These mistakes cause data loss, silent publish failures, or require rewrites.

---

### Pitfall 1: OAuth 2.0 Refresh Token Rotation Is One-Time-Use — Not Persisting the New Token Permanently Breaks Auth

**What goes wrong:**
Twitter's OAuth 2.0 `offline.access` token flow issues a refresh token that is single-use and rotates on every call. When the Twitter provider calls the refresh endpoint to get a new access token, the API returns both a new access token AND a new refresh token, invalidating the previous refresh token immediately. If the provider refreshes the access token and writes only the new access token back to `channels.credentials` (not the new refresh token), the next refresh attempt fails with a 400 error. The user's Twitter channel stops publishing silently — the next `runPublishQueue()` call fails with an authentication error and the queue item retries until it permanently fails.

**Why it happens:**
Developers familiar with OAuth flows where the refresh token is long-lived and reusable (Google, GitHub) assume the same behavior. Twitter's token rotation is unusual and poorly surfaced in error messages. The error returned is `invalid_request` or `400 Bad Request`, not `token_expired` — making it hard to diagnose.

**Consequences:**
- Twitter publish silently fails within 2 hours of setup (access token lifetime) if `offline.access` scope was not requested, or within 6 months (refresh token lifetime)
- If refresh rotation is not handled, every second publish attempt fails and burns retry budget
- User sees "permanently failed" in the queue with no clear explanation

**Prevention:**
- Request `offline.access` scope during the initial OAuth authorization flow — without it, no refresh token is issued at all and the access token expires in 2 hours with no recovery path
- On every token refresh call, write the new access token AND the new refresh token back to `channels.credentials` (both values must be stored atomically)
- Encrypt the full `{ accessToken, refreshToken, expiresAt }` bundle using the existing `credentials` encryption column — do not store individual fields separately
- Add a pre-publish credential validation step in the Twitter provider's `publish()` method that checks `expiresAt` before calling the API; if expired, refresh first, persist both tokens, then publish

**Detection:**
- Twitter publish failures occurring at roughly 2-hour intervals (access token expiry without refresh)
- Queue items permanently failing with `invalid_request` or `401 Unauthorized` on the second or third retry

**Phase to address:** Twitter provider implementation phase — must be in the initial provider implementation, not retrofitted.

**Confidence:** HIGH — confirmed by X Developer Community threads and official OAuth 2.0 PKCE documentation.

---

### Pitfall 2: Adding `'twitter'` to `platformEnum` Requires a Drizzle Migration — Postgres Enums Cannot Be Extended Inline

**What goes wrong:**
The schema defines `platformEnum = pgEnum('platform', ['linkedin', 'substack'])`. Adding `'twitter'` requires `ALTER TYPE platform ADD VALUE 'twitter'` in PostgreSQL. Drizzle generates this migration correctly, but there is a PostgreSQL constraint: new enum values added with `ALTER TYPE ADD VALUE` are not visible inside the same transaction. Drizzle's migration runner wraps migrations in transactions — if the migration that adds `'twitter'` and then tries to create a channel with `platform = 'twitter'` in the same transaction, it fails with `ERROR: unsafe use of new value of enum type`. More commonly: the developer runs `drizzle-kit push` during development instead of generating a proper migration, which has a known bug where it fails to detect the enum label already exists on subsequent pushes.

**Why it happens:**
PostgreSQL's treatment of enum additions as not committed until the surrounding transaction commits is non-obvious. Drizzle-kit's `push` command is convenient for development but has multiple reported bugs with enum change detection (GitHub issues #2389, #3466, #4295). `push` and `generate`+`migrate` behave differently with enum changes, and developers switch between them without realizing the consequences.

**Consequences:**
- Migration fails in production with `unsafe use of new value of enum type` if the same migration adds the enum value and uses it
- `drizzle-kit push` idempotency breaks — subsequent `push` runs report "already exists" errors
- The existing `platformEnum` is also used in TypeScript types throughout the application — forgetting to update the TypeScript enum definition while updating the DB enum causes type errors at compile time

**Prevention:**
- Use `drizzle-kit generate` (not `push`) to produce the migration file, then inspect it before running
- Ensure the migration that adds `'twitter'` to the enum is a standalone migration — never combine enum addition and table inserts that use the new value in the same migration file
- Update the `platformEnum` definition in `schema.ts` at the same time as the migration to keep TypeScript types in sync
- After migration, verify with `SELECT enum_range(NULL::platform)` that `twitter` appears in the database before running any application code

**Detection:**
- `ERROR: unsafe use of new value of enum type` during migration
- TypeScript compilation errors after migration if schema definition is not updated
- `drizzle-kit push` reporting "enum label already exists" on a clean development environment

**Phase to address:** First thing in the Twitter provider phase, before any other code is written. Migration correctness gates all downstream work.

**Confidence:** HIGH — confirmed by direct inspection of `schema.ts` and multiple Drizzle GitHub issues (#2389, #3206, #3466).

---

### Pitfall 3: Thread Posting Races — Posting Tweets in Parallel Instead of Sequentially Breaks Reply Chain

**What goes wrong:**
Twitter threads are reply chains. Each tweet in the thread must be posted sequentially — tweet 1 is posted first, its ID is captured, tweet 2 is posted as a reply to tweet 1's ID, tweet 3 replies to tweet 2's ID, etc. If the thread is posted with `Promise.all()` or any concurrent approach, the tweets post in non-deterministic order, all lacking `in_reply_to_tweet_id`, resulting in four separate standalone tweets rather than a thread.

**Why it happens:**
Developers familiar with posting single items reach for `Promise.all()` for performance. The reply chain dependency (each tweet needs the previous tweet's ID from a live API response) makes concurrency impossible but this constraint is not obvious until you've written the loop.

**Consequences:**
- Threads publish as multiple separate tweets instead of a connected thread
- No way to reconstruct the thread on the platform after the fact
- Each tweet counts against the rate limit independently — a 10-tweet thread consumes 10 of the 100 requests/15-min write limit

**Prevention:**
- Always post thread tweets in a `for...of` sequential loop, not `Promise.all()`
- After each tweet, capture the returned tweet ID from the API response and pass it as `reply.in_reply_to_tweet_id` to the next request
- Validate that the response from each tweet post contains a `data.id` field before proceeding to the next tweet — if an intermediate tweet fails, abort the remaining tweets and surface the partial failure clearly
- The `twitter-api-v2` npm library provides a `.tweetThread()` method that handles sequential chaining automatically — prefer it over manual loop implementation

**Detection:**
- Multiple standalone tweets appearing on the Twitter profile instead of a thread
- Missing `conversation_id` grouping in any subsequent API queries against the posted tweets

**Phase to address:** Twitter provider implementation — thread posting logic.

**Confidence:** HIGH — confirmed by Twitter API v2 documentation (`reply.in_reply_to_tweet_id` field requirement) and `twitter-api-v2` library documentation.

---

### Pitfall 4: Short-Form Draft Schema Assumption — `title`, `hook`, `body`, `cta` Are All `text` Columns That Allow NULL, But the Generator Always Populates All Four

**What goes wrong:**
The existing `drafts` table has `title`, `hook`, `body`, `cta` defined as nullable `text` columns designed for long-form articles and LinkedIn notes. The tweet draft format is fundamentally different: the full tweet (or each tweet in a thread) is the content — there is no meaningful `title`, `hook`, or `cta` as separate fields. If short-form tweets are stored in the same `body` column with the other fields left null, the draft review UI renders a broken card (missing headline picker, missing CTA, voice confidence shows "null"). If instead all four fields are forced to be populated for tweets (e.g., `hook` = first tweet, `body` = remaining tweets, `cta` = last tweet), it creates an artificial mapping that confuses the generator prompt and produces semantically wrong content.

**Why it happens:**
The `contentType` enum already has `['note', 'article']` — adding `'tweet'` as a third value looks straightforward, but the semantic mismatch between the field model and tweet content is invisible until the UI renders a draft. The generator in `generator.ts` uses a field-based prompt contract (`headlineOptions`, `hook`, `body`, `cta`) that does not translate to tweet format without explicit handling.

**Consequences:**
- Draft review UI renders incomplete or misleading cards for tweet drafts
- Voice confidence score is computed against a field model that doesn't apply to tweets, producing meaningless numbers
- The generator prompt hardcodes `note` vs `article` branching — adding `tweet` without updating the generator produces `note`-length content in the `body` field, not properly formatted tweet text

**Prevention:**
- Add `'tweet'` to `contentTypeEnum` as a new enum value (with a separate migration per Pitfall 2 guidance)
- For tweet drafts, define a clear field mapping: `body` stores the full tweet text (single tweet) or the full thread as a JSON array of strings (thread); `hook` and `cta` are NULL; `title` is the topic/thread headline used internally only for the review UI title display
- Update `buildGenerationPrompt()` in `generator.ts` with a dedicated `tweet` branch that produces tweet-optimized JSON with a different schema (e.g., `{ tweets: string[], voiceConfidence: number }` for threads) — do not reuse the `note`/`article` output schema
- Update the draft review UI to detect `contentType === 'tweet'` and render a tweet-appropriate preview card instead of the long-form card

**Detection:**
- Draft review showing "No title" for tweet drafts
- CTA field empty with no explanation in the UI
- Thread content stored in a single `body` field as one long string of `\n\n---\n\n` delimited tweets

**Phase to address:** Short-form content type design phase — schema change and generator update must be atomic.

**Confidence:** HIGH — confirmed by direct inspection of `schema.ts` and `generator.ts`.

---

### Pitfall 5: Character Limit Overrun — AI Generates Tweets Longer Than 280 Characters Despite Explicit Prompting

**What goes wrong:**
LLMs frequently generate tweet text exceeding 280 characters even when explicitly instructed not to. Common failure modes include: (a) the model produces 350-400 characters and truncates it internally with `...`, cutting a thought mid-sentence; (b) the model respects the limit for simple tweets but exceeds it when trying to preserve voice nuances; (c) thread tweets are individually within limit but the thread JSON is malformed (e.g., a single tweet field contains the full thread). The Twitter API rejects any tweet over 280 characters with a `400 Bad Request` and the specific error `"Your tweet text is too long."` This error is caught by the queue-runner's retry logic, consumes retry budget, and permanently fails after 3 attempts — never successfully posting.

**Why it happens:**
The constraint is at the API boundary (the platform), not in the application. The generator produces text and trusts the model's compliance. Twitter's character counting is also non-trivial: emojis count as 2 characters, URLs are always counted as 23 characters regardless of actual length (Twitter's t.co URL wrapping), and Unicode characters outside the basic multilingual plane can count as more than 1. A tweet that looks like 275 characters to JavaScript's `.length` may be 285 characters by Twitter's counting rules.

**Consequences:**
- Published queue items permanently fail after 3 retry attempts without ever posting
- Silent failure from the user's perspective — they approved a draft that never publishes
- Retry budget consumed by a structural issue that will recur on every tweet for that channel

**Prevention:**
- After generation, validate tweet character count server-side using Twitter's character counting rules before inserting the draft into the DB — reject and regenerate if over 280
- Use a simple conservative limit: 270 characters for generated tweet text (10-char buffer) to account for Twitter's URL counting
- In the generator prompt, add explicit examples: "Each tweet must be under 270 characters (counting spaces). This is a hard limit. Do not write 'approximately 280 characters' — write visibly short tweets."
- For threads, validate each individual tweet in the array separately, not the total length
- Do not rely on the model's self-assessment — always measure output length in code before accepting it

**Detection:**
- Queue items permanently failing with `400 Bad Request` immediately after the first publish attempt
- Error message: `"Your tweet text is too long."`
- Draft body contains tweets that are 280+ characters measured by JavaScript's `.length` (the actual Twitter limit may be stricter depending on content)

**Phase to address:** Tweet generation and validation logic — before the provider is connected to the live API.

**Confidence:** HIGH — confirmed by X API documentation on character limits, and multiple community reports of AI tools generating over-limit tweets.

---

### Pitfall 6: Twitter Free Tier Write Limit — 500 Posts Per Month Is a Hard Monthly Cap That Affects Thread Economics

**What goes wrong:**
The X API Free tier allows 500 post creations per month per app. A 10-tweet thread consumes 10 of those 500. If a channel is configured to post 3 threads per week (12 per month, 10 tweets each), that alone consumes 120 of the 500-post budget. Add failed-then-retried posts (each retry is a new API call that counts against the limit) and a single busy month can exhaust the limit entirely, causing all subsequent publish attempts to return `403 Forbidden` with no actionable error in the queue. The app's existing retry logic will interpret this as a transient error and retry up to 3 times, consuming 3 more posts from a future period — or if the monthly cap has rolled over, posting the same content 3 extra times.

**Why it happens:**
Most developers test with 1-2 tweets and do not model the thread multiplication effect. The Free tier limit sounds generous (500/month) until threads are in the picture. The API returns `403` for rate limit and auth errors, making it hard to distinguish "monthly cap exhausted" from "bad credentials."

**Consequences:**
- All Twitter publishing stops mid-month with no warning
- Retry logic may post duplicate content when the monthly cap resets
- Failed items that consumed retries cannot be re-queued without manual intervention

**Prevention:**
- Expose Twitter's monthly post count in the channel dashboard (use the `x-app-limit-24hour-limit`, `x-app-limit-24hour-remaining`, and `x-app-limit-24hour-reset` response headers returned by the API)
- Log the monthly cap headers on every successful post so the operator can monitor consumption without a separate API call
- Configure the Twitter provider to distinguish between `429 Too Many Requests` (rate limit, retry is appropriate) and `403 Forbidden` (auth error or monthly cap exhausted, retry is not appropriate) — surface the distinction as a separate error message in the queue
- Document the thread economics clearly: each tweet in a thread = 1 API write against the monthly cap

**Detection:**
- All Twitter queue items failing with `403 Forbidden` after a period of high throughput
- `x-app-limit-24hour-remaining: 0` in response headers (if logged)
- Post count visible in the X Developer Portal dashboard

**Phase to address:** Twitter provider implementation and queue-runner error handling.

**Confidence:** MEDIUM — rate limits confirmed from official `docs.x.com/x-api/fundamentals/rate-limits` (100 requests per 15 min per user, 10,000 per 24h per app); monthly cap of 500 for Free tier confirmed from multiple sources but the exact monthly rollover behavior is not fully documented in official docs.

---

## Moderate Pitfalls

These mistakes cause bugs or poor UX but do not lose data or block publishing permanently.

---

### Pitfall 7: The Retry Bug — `retryCount` Increments Instead of Resetting on User-Initiated Retry

**What goes wrong:**
The `/api/queue/[id]/retry` route currently sets `retryCount: sql\`${publishQueue.retryCount} + 1\`` when the user clicks Retry. This means a user-initiated retry increments the counter rather than resetting it. If a queue item has already failed 2 times (retryCount = 2), a user-initiated retry sets retryCount = 3, which immediately triggers the `if (retryCount > maxRetries)` branch in `queue-runner.ts` on the very next daemon tick — permanently failing the item that the user just asked to retry. The user explicitly requested a retry but the system immediately fails it.

**Why it happens:**
The retry route was written to track total attempts rather than distinguish between daemon-initiated retries (which should count toward the max-retry limit) and user-initiated retries (which should reset the counter and give the user a fresh 3-attempt budget). The semantic difference between "retry" as "try again after failure" (user intent) versus "increment attempt count" (current behavior) was not made explicit in the implementation.

**Prevention:**
- In the retry route, set `retryCount: 0` (reset to zero) rather than incrementing. A user-initiated retry represents an explicit decision to retry regardless of previous failure count — reset the budget
- Alternatively, add a separate `userRetryCount` column to track total user-initiated retries separately from daemon-driven retries, so the max-retry logic only applies to consecutive daemon attempts
- Update the queue UI to distinguish between "automatic retry scheduled" (daemon) and "manual retry" (user-initiated)

**Detection:**
- User clicks Retry on a failed queue item and it immediately returns to `failed` status on the next daemon tick
- Queue items that have failed exactly `maxRetries` times (retryCount = 3) cannot be recovered by user-initiated retry

**Phase to address:** Tech debt cleanup phase — this is the known retry bug in the milestone scope.

**Confidence:** HIGH — confirmed by direct inspection of `/api/queue/[id]/retry/route.ts` (line 41: `retryCount: sql\`${publishQueue.retryCount} + 1\``) and `queue-runner.ts` (line 107: `if (retryCount > maxRetries)`).

---

### Pitfall 8: Publish-Now Stub Dispatch — The API Route Must Invoke the Publisher Directly, Not Set Status to `publishing` and Wait for the Daemon

**What goes wrong:**
The current `publish-now` route sets the queue item status to `'publishing'` and returns — it does not actually call the publisher. The intent is that the daemon will pick it up on the next tick (within 1 minute). This is a viable workaround for a stub, but when wiring up the actual publisher in v1.1, there is a temptation to leave this pattern in place ("the daemon will get it"). The problem: status `'publishing'` bypasses the daemon's `WHERE status = 'queued'` filter — the daemon never picks up items already in `'publishing'` status. Items set to `'publishing'` by the route will sit there until the `recoverStuckItems()` query fires them back to `'queued'` (15-minute threshold), introducing an invisible 0–15 minute delay on a user action that is named "Publish Now."

**Why it happens:**
The stub was written to set `publishing` status as a placeholder. That status name implies the action is in progress, but the daemon's query model requires items to be in `queued` status to be picked up. The state machine has a gap where `publishing` items are not processed by any actor.

**Prevention:**
- In the publish-now route, import the `publisherRegistry` and call `provider.publish()` directly within the API route handler, synchronously or with a reasonable timeout
- Update the queue item status to `publishing` before the call, `published` on success, `failed` on error — mirroring exactly what `queue-runner.ts` does for the daemon-driven path
- Do not rely on the daemon to pick up items set to `publishing` by the API route
- If the publish takes longer than acceptable for a synchronous API response (e.g., Substack upload), implement a background job pattern — but for Twitter and LinkedIn (fast text APIs), synchronous publish in the route is appropriate

**Detection:**
- Clicking "Publish Now" shows "publishing" status but the item never transitions to "published" or "failed"
- Item eventually resets to "queued" via `recoverStuckItems()` 15 minutes later and publishes through the normal daemon cycle — appearing to work but with a 15-minute delay

**Phase to address:** Tech debt cleanup phase — fix this before Twitter provider is wired up, to avoid baking the same bug into the Twitter publish path.

**Confidence:** HIGH — confirmed by direct inspection of `publish-now/route.ts` (stub comment on line 10) and `queue-runner.ts` (`WHERE status = 'queued'` filter on line 70).

---

### Pitfall 9: Voice Adaptation for Short-Form Produces Generic Tweets — Long-Form Persona Prompts Are Not Optimized for 280 Characters

**What goes wrong:**
The existing voice pipeline produces long-form persona prompts optimized for articles and LinkedIn notes (150–2000 words). When applied verbatim to tweet generation, the same persona prompt — detailed instructions about sentence patterns, paragraph structure, essay arc — produces tweets that either: (a) sound like LinkedIn posts squished into 280 characters ("I've been thinking deeply about this problem for years, and the insight I want to share with you today is..."); (b) ignore the persona entirely and default to generic AI tweet patterns ("Thread on X: Here's what I learned about Y 👇"); or (c) fail to preserve the creator's actual distinctive voice characteristics at the expense of meeting the character limit constraint.

**Why it happens:**
The generator prompt branches on `note` vs `article` but both branches use the same `personaPrompt` string. The persona prompt was assembled by `assembler.ts` for long-form output without any awareness that it might be used for tweet generation. Short-form voice is a different skill — compression, directness, hook-first structure — that requires different prompting and different persona characteristics.

**Prevention:**
- Add a `tweet`-specific branch in `buildGenerationPrompt()` that explicitly instructs the model to prioritize the persona's vocabulary, opinions, and tone over sentence structure patterns (which don't apply at tweet scale)
- Extract the most distinctive voice characteristics from the `VoiceProfile` (specifically `toneDescriptors`, `opinionStances`, `vocabularyNotes`) and emphasize them in the tweet prompt, while deprioritizing `sentencePatterns` (not meaningful at 280 chars)
- Include 2-3 few-shot examples in the tweet generation prompt that demonstrate the creator's voice at tweet scale — these can be extracted from the writing samples during voice analysis if the creator has Twitter archives
- Voice confidence scoring should use a tweet-specific rubric, not the same 0-100 rubric used for articles — flag this in the prompt so the self-assessed score is meaningful

**Detection:**
- Generated tweets that open with em-dash phrases or self-referential preamble ("A thread on..." or "I've been thinking...")
- Voice confidence scores above 80 on tweets that clearly don't match the creator's style when reviewed manually
- User feedback that tweets "don't sound like me"

**Phase to address:** Short-form content generation phase. Accept that tweet voice quality will be imperfect in v1.1 and iterate — do not block shipping on perfect voice quality.

**Confidence:** MEDIUM — based on community observations about AI tweet generation quality and analysis of the existing generator architecture. Not verified with controlled experiments.

---

### Pitfall 10: Thread Generation from Long-Form — Chunking Long Body Text Naively Produces Incoherent Thread Tweets

**What goes wrong:**
When converting a long-form draft to a thread, a naive approach splits the `body` field into 280-character chunks, resulting in threads that cut mid-sentence, begin context-less tweets that make no sense standalone, and bury the hook in tweet 3 or 4. Twitter audience behavior is to stop reading a thread after tweet 1 or 2 unless each tweet stands alone and the next tweet is clearly telegraphed. Chunked threads get no engagement and damage the creator's account's perceived quality.

**Why it happens:**
Chunking is the obvious algorithmic approach. Semantic thread generation (each tweet = one complete idea, threads = a structured narrative arc with hook tweet, supporting tweets, and punchline/CTA tweet) requires AI generation rather than text splitting.

**Prevention:**
- Implement thread generation as a dedicated AI generation call — not text splitting. Pass the full long-form draft body to Claude and instruct it to produce a `{ tweets: string[] }` array where each tweet is a complete, standalone thought that advances the thread narrative
- Set the thread length target based on content, not a fixed count. A strong short thread (3-5 tweets) outperforms a padded long thread
- The first tweet (hook) must be generated to work without reading any subsequent tweets — treat it as a standalone post that happens to have a thread attached
- Mark thread drafts distinctly in the review UI: show all tweets in sequence with a "Thread Preview" mode so the creator can evaluate the full thread before approving

**Detection:**
- Thread tweets that begin mid-thought ("...which is why the approach matters more than the tool")
- Hook tweet that requires reading tweet 2 to make sense
- Threads consistently receiving near-zero engagement despite strong long-form performance

**Phase to address:** Thread generation feature implementation.

**Confidence:** MEDIUM — based on Twitter engagement research and community best practices for AI-generated threads.

---

### Pitfall 11: `DISABLE_INTERNAL_CRON` Not Implemented — The Daemon Starts Its Own Cron Regardless of Env Variable

**What goes wrong:**
The milestone scope explicitly includes implementing `DISABLE_INTERNAL_CRON`. Looking at `daemon/index.ts`, the cron is scheduled unconditionally at line 76 (`task = schedule('* * * * *', ...)`). When the daemon container is deployed alongside Kubernetes CronJobs (the `job:publish` pattern), both the daemon's internal cron and the CronJob fire `runPublishQueue()` concurrently. The in-process `isProcessing` flag prevents overlap within the daemon, but the CronJob runs in a separate pod with its own process state — there is no cross-process locking. Two `runPublishQueue()` calls can pick up the same queue item, attempt to publish it simultaneously, and post duplicate content to Twitter.

**Why it happens:**
The daemon was designed for single-mode operation. The `DISABLE_INTERNAL_CRON` env var was planned but left unimplemented. The deployment documentation may instruct users to use one OR the other (daemon vs. CronJob), but users will inevitably run both, especially during migration or when following Kubernetes examples that include CronJob manifests.

**Prevention:**
- Implement `DISABLE_INTERNAL_CRON` check at daemon startup: `if (process.env.DISABLE_INTERNAL_CRON === 'true') { console.log('[daemon] Internal cron disabled'); return; }`
- Check the env var before calling `schedule()` — a daemon with `DISABLE_INTERNAL_CRON=true` should still start and handle health checks but skip the cron scheduling
- Document clearly in the deployment guide: use the daemon OR CronJobs, never both simultaneously

**Detection:**
- Duplicate tweets posted to Twitter (identical content appearing twice in rapid succession)
- Queue items appearing in both `published` and a concurrent `publishing` state in the same time window
- Two `[queue-runner] Published` log lines for the same draft

**Phase to address:** Tech debt cleanup phase — implement `DISABLE_INTERNAL_CRON` before the Twitter provider is deployed, since duplicate posts on Twitter are more visible and damaging than on Substack/LinkedIn.

**Confidence:** HIGH — confirmed by direct inspection of `daemon/index.ts` (no env var check before `schedule()` call).

---

## Minor Pitfalls

---

### Pitfall 12: Scheduler Timezone Bug Affects Twitter Optimal Post Times

**What goes wrong:**
The scheduler's TODO comment in `scheduler.ts` (line 39) explicitly notes that window hours are resolved in server local time, not `cfg.timezone`. Adding a Twitter channel with a `scheduleConfig.timezone` of `America/Los_Angeles` on a server running UTC produces publish times offset by 7-8 hours — tweets scheduled for 9am Pacific post at 4-5am Pacific. Twitter engagement is highly time-sensitive (peak engagement windows are narrower than Substack or LinkedIn). Publishing 7 hours off-peak can reduce engagement by 50% compared to on-peak publishing.

**Prevention:**
- Fix the timezone resolution before shipping the Twitter channel type — the TODO in `scheduler.ts` must be promoted to a required fix
- Use `Intl.DateTimeFormat` to resolve window hours in the channel's configured timezone before comparing to `now`
- Add a timezone display to the scheduling UI so users can verify that the displayed scheduled time matches their local time

**Detection:**
- Scheduled times shown in the queue timeline appearing to use UTC regardless of channel timezone setting
- Tweets consistently posting at off-peak hours

**Phase to address:** Tech debt cleanup phase (existing milestone scope item).

**Confidence:** HIGH — confirmed by direct inspection of `scheduler.ts` lines 39-64.

---

### Pitfall 13: Twitter OAuth Callback URL Must Match Exactly in the Developer Portal

**What goes wrong:**
Twitter OAuth 2.0 PKCE requires the `redirect_uri` in the authorization request to exactly match one of the Callback URIs registered in the X Developer Portal app settings. Self-hosted users will configure Orbitl at various domains (`orbitl.mydomain.com`, `localhost:3000`, IP addresses). If the registered callback URIs in the developer portal do not include the user's actual callback URL, the OAuth flow returns `callback_uri_mismatch` (a 400 error with no clear UI feedback). Users must edit their X Developer Portal app configuration manually — there is no way to handle this in code.

**Prevention:**
- Document the exact callback URL format users must register in the developer portal: `https://{their-orbitl-domain}/api/auth/twitter/callback`
- Show this URL in the Twitter channel configuration UI so users can copy it directly
- Surface the `callback_uri_mismatch` error with a specific actionable message: "Add `{callback URL}` to your X Developer App's Callback URIs in the developer portal"

**Detection:**
- OAuth flow returns a 400 error with `{"error":"callback_uri_mismatch"}` during channel setup
- User is redirected to an error page without a clear explanation

**Phase to address:** Twitter channel UI / credential configuration.

**Confidence:** HIGH — standard OAuth behavior, confirmed by Twitter API documentation and X Developer Community.

---

### Pitfall 14: Twitter API Requires a Project-Attached App — Personal API Keys Without a Project Won't Work

**What goes wrong:**
Twitter API v2 endpoints require that the OAuth app be attached to a Project in the X Developer Portal. Standalone Apps (the pre-2022 concept) cannot access v2 endpoints. Some users may try to use API keys from legacy apps or follow older tutorials that create apps outside of a project. The error returned (`Unauthorized: The client application is not permitted to access this endpoint`) is the same as an auth scope error, making it difficult to diagnose.

**Prevention:**
- Document in the Twitter channel setup: "Create an App inside a Project in your X Developer Portal. Standalone Apps from before April 2022 will not work."
- Add a link to the X Developer Portal new project creation flow in the channel configuration UI
- Test connectivity with a dedicated "Test Connection" validation step before saving credentials

**Detection:**
- `401 Unauthorized` with message `The client application is not permitted to access this endpoint` after providing valid-looking credentials

**Phase to address:** Twitter channel setup documentation and UI.

**Confidence:** HIGH — confirmed by official X API v2 authentication requirements.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Tech debt: retry bug | Resetting `retryCount` to 0 may surprise users who expect total attempt history | Add `totalAttempts` column if historical tracking is needed; reset `retryCount` is correct for the retry-gate behavior |
| Tech debt: publish-now | Synchronous publish in API route may timeout for slow platforms (Substack image upload) | Twitter and LinkedIn are fast text APIs; implement synchronous for Twitter, defer complex timeout handling to v2+ |
| Tech debt: DISABLE_INTERNAL_CRON | Implementing the flag after users have already deployed means existing installations unexpectedly start using the new behavior | Flag defaults to `false` (existing behavior) — no breaking change for existing deployments |
| Postgres enum migration | `drizzle-kit push` vs `drizzle-kit generate` inconsistency on enum changes | Use `generate` + `migrate` for the `platform` enum change; test on a clean DB before running in any environment with data |
| Twitter OAuth PKCE flow | Callback URL configuration is user-managed, not app-managed | Surface the exact callback URL in the UI during channel setup with a "Copy" button |
| Token refresh | First publish after 2 hours will trigger a token refresh; if refresh fails, publish fails | Test full OAuth flow including token refresh before shipping — simulate refresh by manually setting a past `expiresAt` |
| Thread generation | Thread tweet count is unbounded unless constrained | Cap threads at 10 tweets (reasonable Twitter thread length); document this as a configurable channel option |
| Short-form draft schema | Adding `'tweet'` to the `contentType` enum is a DB migration that must run before the code using it is deployed | Run enum migration in Phase 1 (cleanup), use the new `tweet` type in Phase 2 (feature) |
| Tweet character limit | Twitter's character counting differs from JavaScript's `.length` for emoji and non-BMP Unicode | Use a conservative 270-character server-side limit; accept false positives (some under-280 tweets rejected) over false negatives (over-280 tweets sent to API) |
| Voice adaptation | Short-form voice quality will not be perfect in v1.1 — accept this | Ship with a note in the draft review UI: "Tweet voice quality improves with more writing samples" |

---

## "Looks Done But Isn't" Checklist

- [ ] **OAuth token rotation:** After the first token refresh, are both the new access token AND new refresh token written back to `channels.credentials`? Test by simulating an expired access token and confirming the next publish succeeds and the stored refresh token has changed.
- [ ] **Thread sequencing:** Do threads post in order with each tweet properly linked as a reply to the previous? Verify by checking `conversation_id` consistency across all tweets in the thread after posting.
- [ ] **Character limit enforcement:** Is character count validated server-side before inserting tweet drafts into the database? Run a test that forces the generator to produce a 290-character tweet and confirm it is rejected and regenerated.
- [ ] **Retry bug fix:** After fixing `retryCount` reset, does a user-initiated retry on an item with `retryCount = 3` (at the old permanent-failure threshold) succeed in re-queuing and eventually publishing?
- [ ] **Publish-now dispatch:** Does clicking "Publish Now" actually call the publisher API within the same HTTP request/response cycle? Verify by checking the `publishedAt` timestamp is set within seconds, not minutes.
- [ ] **DISABLE_INTERNAL_CRON:** With `DISABLE_INTERNAL_CRON=true`, does the daemon start without scheduling the cron tick? Confirm by running the daemon and observing no `[queue-runner]` log output.
- [ ] **Postgres enum migration:** Is the `'twitter'` enum value added in a standalone migration that does not also insert any rows with that value? Run `SELECT enum_range(NULL::platform)` after migration.
- [ ] **Timezone fix:** Does a Twitter channel configured with `America/Los_Angeles` schedule posts at the correct Pacific time on a server running UTC? Verify by comparing `scheduledFor` in the DB against the expected Pacific time.
- [ ] **Monthly cap surfacing:** Are Twitter API write limit headers (`x-app-limit-24hour-remaining`) logged on each successful post? Confirm in application logs after posting a test tweet.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| OAuth refresh token not persisted | LOW | Re-initiate OAuth flow for the Twitter channel (user clicks Connect Twitter again); new token pair issued |
| Enum migration failure (`unsafe use of new value`) | LOW | Rollback the migration; split into two migrations (enum change alone, then data change); re-run |
| Thread posted as separate tweets | LOW | No API to reconstruct threads; delete individual tweets manually via X platform; re-approve draft and repost |
| Tweet over 280 chars published | LOW | Delete tweet via X platform; fix character validation; repost |
| Monthly write cap exhausted | MEDIUM | Wait for monthly reset (calendar month boundary); review thread frequency; consider Basic plan ($100/month = 50,000 writes) |
| Retry bug causes permanent failure on user-initiated retry | LOW | Directly reset `retryCount = 0` and `status = 'queued'` in DB; fix and redeploy |
| Publish-now sets `publishing` but daemon never picks it up | LOW | `recoverStuckItems()` resets item to `queued` within 15 minutes; fix and redeploy |
| Duplicate posts from daemon + CronJob running simultaneously | MEDIUM | Delete duplicate tweets manually; implement `DISABLE_INTERNAL_CRON` and redeploy; review deployment docs |

---

## Sources

**Twitter/X API (HIGH confidence):**
- X API Rate Limits (official): https://docs.x.com/x-api/fundamentals/rate-limits
- X API Manage Tweets Introduction (official): https://docs.x.com/x-api/posts/manage-tweets/introduction
- OAuth 2.0 Authorization Code Flow with PKCE (official, redirects to docs.x.com): https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code
- Refresh token rotation behavior: https://devcommunity.x.com/t/access-token-with-offline-access-expire-in-2-hours/191921
- Refresh token expiry thread (X Dev Community): https://devcommunity.x.com/t/refresh-token-expiring-with-offline-access-scope/168899
- `twitter-api-v2` Node.js library v2 docs: https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/v2.md
- `@twitter-api-v2/plugin-token-refresher`: https://github.com/alkihis/twitter-api-v2-plugin-token-refresher

**Drizzle ORM enum pitfalls (HIGH confidence):**
- Drizzle ORM GitHub issue #2389 (enum label already exists): https://github.com/drizzle-team/drizzle-orm/issues/2389
- Drizzle ORM GitHub issue #3466 (migration transaction commit issue): https://github.com/drizzle-team/drizzle-orm/issues/3466
- Drizzle ORM GitHub issue #4295 (enum default value migration broken): https://github.com/drizzle-team/drizzle-orm/issues/4295

**Direct codebase analysis (HIGH confidence):**
- `src/db/schema.ts` — `platformEnum`, `contentTypeEnum` definitions; confirmed no `'twitter'` value
- `src/lib/publishing/queue-runner.ts` — `WHERE status = 'queued'` filter; retry logic; max retry check
- `src/app/api/queue/[id]/retry/route.ts` — `retryCount: sql\`${publishQueue.retryCount} + 1\`` bug confirmed
- `src/app/api/queue/[id]/publish-now/route.ts` — stub comment confirmed; sets `'publishing'` without dispatching
- `src/daemon/index.ts` — `DISABLE_INTERNAL_CRON` not implemented; unconditional `schedule()` call
- `src/lib/publishing/scheduler.ts` — timezone TODO confirmed at lines 39-64
- `src/lib/generation/generator.ts` — `note`/`article` branching only; no `tweet` content type branch

**Thread generation / voice quality (MEDIUM confidence — community sources):**
- The Twitter Thread Prompt That Actually Works (Medium): https://medium.com/@robertgo8/the-twitter-thread-prompt-that-actually-works-and-why-most-dont-4fbc2b50fa34
- AI-generated tweet voice quality analysis: https://apaya.com/blog/ai-twitter-x-post-generator

---

*Pitfalls research for: v1.1 — Twitter/X publisher, short-form content type, thread generation, tweet voice adaptation, and v1.0 tech debt fixes*
*Researched: 2026-02-28*
