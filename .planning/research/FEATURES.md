# Feature Landscape: v1.1 Twitter/X & Cleanup

**Domain:** Twitter/X publishing, short-form content generation, thread decomposition, tech debt fixes
**Researched:** 2026-02-28
**Confidence:** HIGH (Twitter/X API mechanics verified against docs.x.com and node-twitter-api-v2 library; patterns confirmed against multiple sources)

---

## Context: Building On v1.0

Orbitl v1.0 ships: channel management, voice pipeline, multi-source research, AI draft generation, draft review UI, publish queue, daemon loop, Substack + LinkedIn publishers, auth, Docker Compose, Helm, AI audit dashboard.

The existing `PublisherProvider` interface (`/src/lib/providers/types.ts`) defines:
- `publish(draft, channel): Promise<unknown>`
- `formatDraft(draft, channel): string`
- `configSchema: ConfigField[]` — drives dynamic credential forms

The existing `contentTypeEnum` has `note | article`. The existing `platformEnum` has `linkedin | substack`.

v1.1 adds: Twitter/X publisher, a new `tweet` content type, thread generation from long-form, tweet voice adaptation, and five tech debt fixes. Research below covers only the new scope.

---

## Twitter/X Publisher — Table Stakes

Features that must exist for the Twitter/X provider to feel complete and trustworthy.

| Feature | Why Expected | Complexity | Dependency on Existing |
|---------|--------------|------------|------------------------|
| Single tweet posting | Core publishing primitive — any platform integration must post | LOW | Implement `PublisherProvider.publish()` for twitter platform; pluggable system handles the rest |
| Thread posting (reply chain) | Threads are the primary long-form native format on X; omitting them means the publisher can only post 280 chars — useless for long-form repurposing | MEDIUM | Requires sequential `POST /2/tweets` calls with `reply.in_reply_to_tweet_id` chaining; twitter-api-v2 `tweetThread()` handles this natively |
| OAuth credential storage (encrypted) | Users expect API keys to be encrypted at rest; already established expectation from LinkedIn | LOW | Existing `credentials` column with AES-256 encryption handles this; just configure the right `configSchema` fields |
| Character limit enforcement | 280 chars per tweet is a hard platform constraint; exceeding it = API error | LOW | Must validate in `formatDraft()` and in draft generation prompt; thread tweets truncate/split at 280 |
| Thread tweet numbering (optional) | Common convention: "1/" prefix or "1/7" marker; users expect some thread structure signal | LOW | Add as a formatting option in the provider; default on |
| Platform error translation | "401 Unauthorized" → "Twitter credentials expired — re-enter API keys" | LOW | Same pattern as LinkedIn; translate API errors in the `publish()` method |
| Tweet-format draft generation | Short-form drafts need a different structure: hook → insight → CTA, not article structure | MEDIUM | New `contentType: 'tweet'` enum value + new generation prompt variant; uses existing voice pipeline |

---

## Twitter/X Publisher — Differentiators

| Feature | Value Proposition | Complexity | Dependency on Existing |
|---------|-------------------|------------|------------------------|
| Thread generation from approved long-form draft | Repurpose existing approved article/note drafts into a tweet thread — no new research required | HIGH | Post-approval action on existing `drafts` table; calls AI with thread decomposition prompt; creates new draft of type `tweet` linked to source draft |
| Tweet voice adaptation (concise register) | The voice pipeline builds a persona for long-form; tweets require a conciseness adaptation — shorter sentences, declarative phrasing, no hedging | MEDIUM | Extend `personaPrompt` assembly in voice pipeline to include tweet-specific style instructions when `contentType === 'tweet'`; same underlying VoiceProfile |
| Thread preview in draft review | Users need to see the thread card-by-card before approving — not as a single blob of text | MEDIUM | New draft review UI component for `tweet` content type; renders thread as a card list with character counts per tweet |
| "Generate thread from this draft" action | One-click repurposing from the draft review page for approved long-form content | LOW | UI button on approved long-form drafts; triggers server action → AI thread decomposition → new draft |

---

## Twitter/X Publisher — Anti-Features

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Twitter OAuth 2.0 PKCE user-auth flow | OAuth 2.0 is the "newer" standard — seems like it should be used | PKCE requires a browser redirect URI, callback handling, token storage, and refresh token management with `offline.access` scope. For a self-hosted server-side app posting on behalf of the operator (single user), OAuth 1.0a with API key + access token is materially simpler and equally supported. OAuth 2.0 PKCE adds significant auth complexity with no benefit for this use case. | OAuth 1.0a User Context: API Key, API Secret, Access Token, Access Token Secret — 4 fields, no redirect, no refresh tokens, no expiry |
| Media / image attachment to tweets | Richer tweet posts | v1.1 media upload requires OAuth 1.0a AND separate `v1/media/upload` calls with chunked upload for video; significantly different flow from text-only posting | Document as future provider enhancement; out of scope for v1.1 |
| Tweet analytics (impressions, engagements) | "Show me how my tweets performed" | Reading tweet metrics requires the Basic tier ($100/mo) or Pro ($5,000/mo) X API plan; Free tier is write-only. Out of scope per PROJECT.md. | Out of scope; link users to Twitter Analytics |
| Scheduling native to X | X has a native scheduled tweet feature via the API | Orbitl already has its own scheduling system (publish queue + daemon); duplicating it in the publisher adds complexity with no benefit | Use Orbitl's existing scheduling; publish at the queued time |
| Thread reordering/editing after generation | Edit individual tweets in a thread before publishing | The draft body for a thread is structured text (numbered tweets); editing it in the existing draft editor is sufficient for v1.1 | Standard draft editor handles the body field; the thread card preview is read-only |

---

## Short-Form Content Type

### What "tweet" content type means for the data model

The existing schema has `contentTypeEnum('content_type', ['note', 'article'])`. A `tweet` type needs to be added.

**Tweet draft structure** (maps to existing `drafts` table columns):
- `title` — null or the thread topic (not displayed on X, but used internally)
- `hook` — the opening tweet (tweet[0]) — always present
- `body` — tweets 1..N joined by separator (e.g. `\n---\n`) for thread; single tweet text for standalone
- `cta` — the closing tweet or CTA text (tweet[N]) — may be same as body[last] for threads
- `headlineOptions` — repurposed as alt opening hook options (same UX pattern)
- `voiceConfidence` — same computation as long-form; just adapted prompts

**Expected thread structure from AI generation:**
```
Tweet 1 (hook):  Bold claim / question / surprising stat — stops the scroll
Tweets 2-8 (body): Each tweet is self-contained but builds on previous
Tweet N (CTA):   Summary + action ("Save this / Follow for more / Reply with X")
```

**Constraints from research:**
- 280 characters per tweet (hard limit)
- Aim for 200-250 to leave room for links and reply chain context
- 5-10 tweets is the effective range; 7 is reported as the engagement sweet spot
- Numbering convention: "1/" or "1/7" prefix consumed by ~2-3 chars — budget accordingly

### Table Stakes for Short-Form Content Type

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `tweet` added to `contentTypeEnum` | Platform-specific content requires its own type; tweet drafts have fundamentally different structure than articles | LOW | DB migration required; add `twitter` to `platformEnum` simultaneously |
| Tweet-specific generation prompt | 280 char tweets require completely different prompting than 800-word notes | MEDIUM | New prompt template in generation pipeline; reuses VoiceProfile but adds conciseness constraints |
| Character count validation | Exceeding 280 chars causes API failure at publish time; must catch during generation and review | LOW | Validate in `formatDraft()`; surface per-tweet char counts in thread preview UI |
| Thread body serialization format | Thread = ordered list of tweets stored in `body` field as text; must be a stable, parseable format | LOW | Use separator-based format (`\n---\n`) or JSON array; the publisher deserializes at publish time |
| `twitter` channel platform | `platformEnum` currently has `linkedin | substack`; Twitter requires a new platform value | LOW | Add `twitter` to enum in DB migration |

### Differentiators for Short-Form Content Type

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Thread decomposition from long-form | Repurpose approved article/note into a thread — highest-ROI content repurposing for creators | HIGH | Separate AI call with "blog-to-thread" prompt; input is the full draft body; output is numbered tweet list; stored as new tweet draft linked to source draft |
| Voice-adapted conciseness | Same persona as long-form but with Twitter register constraints injected into system prompt | MEDIUM | Extends existing `personaPrompt` assembly; adds tweet-specific style layer: short sentences, declarative phrasing, no em-dashes, no hedging |
| Thread card preview UI | Lets users see exactly how the thread will render before approving | MEDIUM | New draft review component for `contentType === 'tweet'`; renders each tweet as a card with char count indicator (green/yellow/red) |
| Hook variant options | Same pattern as `headlineOptions[]` for articles — AI generates 3 alt opening tweets | LOW | Extend tweet generation to return hook variants; surface as picker in draft review |

---

## Tech Debt Fixes

These are corrections to broken or missing behavior in v1.0, not new features.

| Fix | What's Wrong | Expected Behavior | Complexity | Notes |
|-----|-------------|-------------------|------------|-------|
| Publish-now stub | "Publish now" button exists in queue UI but dispatches to a stub that doesn't call the publisher | Clicking "Publish now" should immediately dispatch the draft to the channel's publisher provider and mark it published | MEDIUM | Needs a server action that calls the publisher directly (same code path as daemon), bypassing the scheduled time check |
| Retry bug (retryCount not reset) | When a failed item is retried, `retryCount` is not reset to 0 — so the retry immediately hits the max retry threshold and re-fails | On manual retry, `retryCount` must be reset to 0 and `status` set to `queued` before the daemon picks it up | LOW | One-line DB update fix in the retry action |
| DISABLE_INTERNAL_CRON not implemented | The env var is documented but not checked; the internal Next.js cron runs even when you want the daemon to handle scheduling | When `DISABLE_INTERNAL_CRON=true`, the internal cron route should return 200 without running | LOW | Add env check at top of the cron route handler |
| Scheduler timezone support | `ScheduleConfig.timezone` field exists in schema but the scheduling logic ignores it; all windows calculated in UTC | Window hours (startHour, endHour) must be interpreted in the channel's configured timezone, not UTC | MEDIUM | Use a timezone library (e.g. `date-fns-tz` or `Intl`) to convert window bounds before comparison; `ScheduleConfig.timezone` is already stored |
| Actionable errors in CreateChannelForm | Form submit errors surface a generic message; users don't know if the failure was a duplicate name, missing fields, or a DB error | Each validation/constraint failure maps to a specific user-facing message ("A channel with this name already exists") | LOW | Map DB error codes and validation errors to specific messages in the form server action |

---

## Feature Dependencies

```
[twitter platform enum value]
    └──required by──> [TwitterProvider (publisher)]
    └──required by──> [Channel creation for Twitter]

[tweet content type enum value]
    └──required by──> [Tweet draft generation]
    └──required by──> [Thread body serialization]
    └──required by──> [Thread preview UI component]
    └──required by──> [TwitterProvider.formatDraft()]

[DB migration: add 'twitter' to platformEnum, 'tweet' to contentTypeEnum]
    └──must precede──> ALL other v1.1 features

[TwitterProvider (publisher module)]
    └──requires──> [tweet content type]
    └──requires──> [OAuth 1.0a credential fields in configSchema]
    └──requires──> [twitter-api-v2 npm package]
    └──implements──> [existing PublisherProvider interface — no interface changes needed]

[Tweet-specific generation prompt]
    └──requires──> [tweet content type]
    └──reuses──> [VoiceProfile from voice pipeline — existing]
    └──enhances──> [voice pipeline prompt assembly]

[Thread generation from long-form draft]
    └──requires──> [tweet content type]
    └──requires──> [approved long-form draft (existing)]
    └──requires──> [AI generation pipeline (existing)]
    └──produces──> [new tweet draft linked to source draft]

[Thread card preview UI]
    └──requires──> [tweet content type]
    └──requires──> [thread body serialization format]
    └──extends──> [draft review page (existing)]

[Publish-now fix]
    └──requires──> [publisher registry (existing)]
    └──fixes──> [existing stub in queue UI server action]

[Retry bug fix]
    └──requires──> [publish queue schema (existing)]
    └──fixes──> [retry server action]

[Scheduler timezone fix]
    └──requires──> [ScheduleConfig.timezone field (already in schema)]
    └──fixes──> [daemon scheduler window calculation]

[DISABLE_INTERNAL_CRON fix]
    └──requires──> [cron route handler (existing)]
    └──fixes──> [missing env var check]

[CreateChannelForm error messages]
    └──requires──> [channel creation server action (existing)]
    └──fixes──> [generic error handling in form]
```

---

## MVP Definition for v1.1

### Must Ship (core scope)

- [ ] **DB migration** — add `twitter` to `platformEnum`, add `tweet` to `contentTypeEnum`
- [ ] **TwitterProvider** — OAuth 1.0a credentials, `publish()` for single tweets and threads, `formatDraft()` with 280-char awareness
- [ ] **Tweet content type generation prompt** — hook/body/CTA structure, 280 char per segment, voice-adapted conciseness constraints
- [ ] **Thread generation from approved draft** — server action: input is approved draft body → AI decomposes → saves as new tweet draft
- [ ] **Thread card preview in draft review** — renders tweet drafts as card list with per-card char count indicators
- [ ] **Publish-now stub fix** — dispatch to publisher immediately; same code path as daemon
- [ ] **Retry bug fix** — reset `retryCount = 0` on manual retry
- [ ] **DISABLE_INTERNAL_CRON env var** — check at cron route entry; no-op if set
- [ ] **Scheduler timezone fix** — apply `ScheduleConfig.timezone` to window hour calculations
- [ ] **CreateChannelForm actionable errors** — map constraint/validation errors to specific user messages

### Add If Capacity Allows

- [ ] **Hook variant picker** — generate 3 alt opening tweets; surface as chip picker in thread preview (same UX as `headlineOptions[]`)
- [ ] **"Generate thread from this" button on long-form draft review** — makes repurposing one-click rather than navigating to a new flow

### Defer to v1.2+

- [ ] Media attachments on tweets — requires chunked upload flow, separate from text-only scope
- [ ] Tweet analytics (reads) — requires paid X API tier ($100+/mo); out of scope
- [ ] Bluesky / Mastodon publisher — community can contribute via pluggable provider system

---

## Competitor Feature Analysis (Twitter/X Scope)

| Feature | Buffer | Postiz (OSS) | Mixpost (OSS) | Orbitl v1.1 Approach |
|---------|--------|--------------|---------------|----------------------|
| Tweet scheduling | YES | YES | YES | YES — existing queue + daemon |
| Thread scheduling | YES (unlimited length) | YES | YES | YES — sequential reply-chain posting |
| Thread creation UI | Compose UI, tweet-by-tweet | Compose UI, tweet-by-tweet | Compose UI, tweet-by-tweet | AI-generated from research or from existing draft; thread card preview for review |
| Long-form → thread repurposing | Manual only | Manual only | Manual only | AI-automated from approved drafts — **differentiator** |
| Voice adaptation per platform | No | No | No | Tweet-specific register constraints in voice pipeline — **differentiator** |
| OAuth approach | OAuth 2.0 app-managed | OAuth 2.0 | OAuth 1.0a | OAuth 1.0a (simpler, no redirect/refresh complexity) |

---

## Sources

- X API v2 POST /2/tweets endpoint: [Create or Edit Post — docs.x.com](https://docs.x.com/x-api/posts/create-post)
- X API v2 authentication mapping: [v2 Authentication Mapping — docs.x.com](https://docs.x.com/fundamentals/authentication/guides/v2-authentication-mapping)
- X API rate limits (POST /2/tweets: 100/15min per user, 10,000/24hr per app): [Rate Limits — docs.x.com](https://docs.x.com/x-api/fundamentals/rate-limits)
- Free tier limits (1,500 tweets/month write-only): [X API Free Tier — devcommunity.x.com](https://devcommunity.x.com/t/specifics-about-the-new-free-tier-rate-limits/229761)
- OAuth 1.0a still supported for POST /2/tweets in 2025: [Will OAuth 1.0a Continue to Be Supported? — devcommunity.x.com](https://devcommunity.x.com/t/will-oauth-1-0a-user-context-continue-to-be-supported-for-api-v2/245571)
- node-twitter-api-v2 library (tweetThread, OAuth 2.0, token refresh): [plhery/node-twitter-api-v2 — GitHub](https://github.com/PLhery/node-twitter-api-v2)
- node-twitter-api-v2 v2 docs (tweet, reply, tweetThread methods): [node-twitter-api-v2/doc/v2.md — GitHub](https://github.com/plhery/node-twitter-api-v2/blob/master/doc/v2.md)
- Thread structure best practices (5-10 tweets, hook formula, CTA): [Writing Effective Twitter Threads in 2025 — usevisuals.com](https://usevisuals.com/blog/writing-effective-twitter-threads-2025)
- Blog to thread decomposition (hook-first, semantic chunking, 280 char): [Automate Blog to Twitter Thread — analyticsvidhya.com](https://www.analyticsvidhya.com/blog/2025/01/automate-blog-to-twitter-thread/)
- Thread scheduling — Postiz: [How to Schedule a Twitter Thread — postiz.com](https://postiz.com/blog/how-to-schedule-a-twitter-thread)
- Thread scheduling — Buffer: [Schedule Twitter Threads — buffer.com](https://buffer.com/resources/schedule-twitter-threads/)
- in_reply_to_tweet_id thread chaining: [X API conversation-id — docs.x.com](https://docs.x.com/x-api/fundamentals/conversation-id)
- node-cron timezone support: [node-cron — npm](https://www.npmjs.com/package/node-cron)

---

*Feature research for: Orbitl v1.1 Twitter/X publisher, short-form content type, thread generation, tech debt*
*Researched: 2026-02-28*
