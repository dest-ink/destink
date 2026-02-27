# Codebase Concerns

**Analysis Date:** 2026-02-26

## Tech Debt

**Timezone Handling in Publishing Scheduler:**
- Issue: Window hours are currently resolved in server local time, not in the configured channel timezone
- Files: `src/lib/publishing/scheduler.ts` (line 38-39)
- Impact: Scheduled publish times may be off by multiple hours depending on server timezone vs configured timezone
- Fix approach: Import and use IANA timezone arithmetic library (via Intl.DateTimeFormat or date-fns/zoneinfo) to compute candidate times in the correct timezone before production use

**Stuck Publishing Items Recovery:**
- Issue: If queue-runner fails to update retry state, items remain stuck in 'publishing' status indefinitely
- Files: `src/lib/publishing/queue-runner.ts` (line 97-103)
- Impact: Stuck items block the queue and require manual DB intervention
- Fix approach: Implement a recovery mechanism to reset 'publishing' items older than a configurable timeout window (e.g., 30 minutes)

**Hardcoded Price Data:**
- Issue: Anthropic pricing is hardcoded in audit.ts with a comment to verify at console.anthropic.com/pricing
- Files: `src/lib/ai/audit.ts` (lines 4-9)
- Impact: Pricing calculations become inaccurate after API price changes, cost tracking becomes unreliable
- Fix approach: Migrate pricing to a config file or environment variables with a deprecation warning when new model versions release

## Error Handling Gaps

**Silent Research Adapter Failures:**
- Issue: Per-adapter research source failures (Exa, Reddit, Substack, brainstorm) return empty arrays instead of propagating errors
- Files: `src/lib/research/exa.ts` (lines 26-33), `src/lib/research/reddit.ts`, `src/lib/research/substack-monitor.ts`
- Impact: User doesn't know why content opportunities are missing — could mask API key issues or service outages
- Fix approach: Log adapter failure reason and return partial results with metadata indicating which sources failed

**Unauthenticated API Endpoints:**
- Issue: All API routes (`/api/drafts`, `/api/queue`, `/api/channels`, `/api/voice`) lack authentication/authorization checks
- Files: `src/app/api/**/*.ts`
- Impact: Anyone with network access can read/write all channels, drafts, queues, and trigger expensive AI operations
- Fix approach: Implement session-based or token-based auth middleware (e.g., NextAuth or custom JWT validation) before accessing DB

**Missing Queue State Validation:**
- Issue: POST requests to `/api/queue/[id]/publish-now` and `/api/queue/[id]/retry` check status but don't validate UUID format before DB query
- Files: `src/app/api/queue/[id]/publish-now/route.ts` (line 16), `src/app/api/queue/[id]/retry/route.ts` (line 15)
- Impact: Invalid UUIDs still reach DB with potential for injection (though Drizzle's parameterization mitigates this)
- Fix approach: Use zod validation or explicit UUID.parse() before any DB operation

## Security Considerations

**Unencrypted Credentials in Database:**
- Issue: Platform credentials (LinkedIn access tokens) are encrypted with a single shared key stored in env vars; no key rotation mechanism
- Files: `src/lib/publishing/linkedin.ts` (lines 43-46), `src/db/schema.ts` (line 42)
- Impact: Compromise of CREDENTIALS_ENCRYPTION_KEY exposes all platform tokens; no key versioning for rotation
- Fix approach: Implement versioned encryption keys with a key rotation strategy; consider external secret management (e.g., AWS Secrets Manager)

**Sensitive Data in Audit Logs:**
- Issue: AI audit log records operation names and token usage but doesn't mask promptText or responseText
- Files: `src/lib/ai/audit.ts` (lines 27-39)
- Impact: If audit log is exposed, it may contain proprietary content or user data embedded in prompts
- Fix approach: Don't store raw prompt/response text; only store summary metadata (word count, entity count, etc.)

**LinkedIn Credentials Type Casting:**
- Issue: Credentials are parsed without strict type validation; relies on typeof checks after JSON.parse
- Files: `src/lib/publishing/linkedin.ts` (lines 62-73)
- Impact: Malformed credentials slip past checks and cause runtime errors downstream
- Fix approach: Use zod schema validation for all parsed credentials

## Performance Bottlenecks

**Large Component Files:**
- Issue: Several React components exceed 150 lines (DraftActions 201 lines, QueueItem 194 lines, form.tsx 178 lines)
- Files: `src/components/drafts/DraftActions.tsx`, `src/components/queue/QueueItem.tsx`, `src/components/ui/form.tsx`
- Impact: Harder to test, reason about, and modify; higher cognitive load
- Fix approach: Extract action handlers into custom hooks; break large form components into sub-components

**Research Pipeline Parallelization Limits:**
- Issue: All four research sources (Exa, Reddit, Substack, brainstorm) execute in parallel but with no concurrency limits
- Files: `src/lib/research/engine.ts` (lines 81-86)
- Impact: High API request overhead during peak usage; potential rate-limit hits on external services
- Fix approach: Add configurable concurrency pool or prioritize sources (e.g., run Exa first, then others)

**No Database Query Optimization:**
- Issue: Drafts page fetches all drafts without pagination or cursor-based limits
- Files: `src/app/(app)/drafts/page.tsx`, `src/app/(app)/queue/page.tsx`
- Impact: Full-table scans as datasets grow; slow page load times and high memory usage on large installations
- Fix approach: Implement cursor-based pagination with limit/offset parameters

**Client-Side Filtering on Large Datasets:**
- Issue: DraftsClientShell filters 10000+ drafts in useMemo on every render
- Files: `src/components/drafts/DraftsClientShell.tsx` (lines 25-39)
- Impact: JavaScript execution blocks rendering; filtering happens on every filter change even if dataset didn't change
- Fix approach: Implement server-side filtering via URL query params; use cache invalidation instead of full re-filter

## Fragile Areas

**JSON Parsing Without Shape Validation:**
- Issue: Multiple places parse JSON from Claude and expect specific shape, but only validate after parse
- Files: `src/lib/generation/generator.ts` (line 81-92), `src/lib/research/engine.ts` (line 102), `src/lib/voice/analyzer.ts` (line 47-60)
- Impact: Wrong-shape JSON from Claude crashes without clear error message; no graceful degradation
- Fix approach: Use zod schemas to validate parsed JSON before use; throw descriptive errors on shape mismatch

**Dependency on External Services Without Fallbacks:**
- Issue: Content generation, research, voice analysis all require AI service; no offline mode or caching
- Files: `src/lib/ai/client.ts`, `src/lib/research/engine.ts`, `src/lib/voice/analyzer.ts`
- Impact: Service outage = all functionality down; cannot generate drafts or analyze voice until service returns
- Fix approach: Cache successful generations; implement graceful degradation (e.g., return empty research, skip voice confidence)

**In-Memory Lock for Daemon:**
- Issue: Daemon uses module-level `isProcessing` flag for concurrency control
- Files: `src/daemon/index.ts` (lines 7-10)
- Impact: Works for single-process Kubernetes Deployment, but breaks if pod restarts or multiple instances are deployed
- Fix approach: Migrate to distributed lock (Redis, database row lock) for true at-most-once semantics

**Untyped Error Handling in Components:**
- Issue: Catch blocks assume error is Error type without type guards
- Files: `src/components/channels/VoiceWizard.tsx`, `src/components/channels/CreateChannelForm.tsx`
- Impact: Accessing `.message` on non-Error objects crashes components silently
- Fix approach: Add type guard in catch blocks: `const message = err instanceof Error ? err.message : String(err)`

## Test Coverage Gaps

**No API Route Tests:**
- Issue: API tests exist for libraries but not for route handlers
- Files: No `/tests/api/drafts.test.ts` or `/tests/api/queue.test.ts` files
- Risk: Route-level error handling, validation, and auth are untested; regressions in error responses go undetected
- Priority: High

**Client Component Tests Missing:**
- Issue: React component tests are absent; only library code is tested
- Files: No tests for `src/components/drafts/DraftActions.tsx`, `src/components/queue/QueueItem.tsx`, etc.
- Risk: UI state management bugs (isPending vs isFetching race conditions) are not caught
- Priority: Medium

**No Concurrent Publishing Tests:**
- Issue: Queue-runner retry logic not tested under concurrent item processing
- Files: `src/lib/publishing/queue-runner.ts` — no concurrent scenario tests
- Risk: Race conditions in status updates or retry calculations go undetected
- Priority: Medium

**Credentials Encryption Not Tested:**
- Issue: No test coverage for encrypt/decrypt round-trip or key mismatch scenarios
- Files: `src/lib/crypto.ts` — tests exist but don't cover edge cases like invalid key length
- Risk: Credential decryption failures in production are not anticipated
- Priority: High

## Dependencies at Risk

**Next.js Rapid Release Cycle:**
- Risk: Next.js 16 is bleeding-edge; breaking changes in minor versions are possible
- Impact: Daemon and API routes tightly coupled to Next.js internals (node-cron, Drizzle integration)
- Migration plan: Pin to stable release once 16.x has 2+ minor version bump; maintain breaking change checklist

**Exa API Deprecation:**
- Risk: Exa-js v2.5.0 may become unsupported; no pinned version in package.json
- Impact: Research pipeline breaks if Exa sunsets endpoints
- Migration plan: Add vendor abstraction layer (`src/lib/research/search-adapter.ts`) to decouple from Exa; support fallback to Google Custom Search or similar

**Anthropic Model Version Pinning:**
- Risk: Code hardcodes specific model versions (`claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`)
- Impact: Model becomes unavailable or pricing changes; system can't adapt without code changes
- Migration plan: Store model preference in `channels.generationConfig` JSONB; allow per-channel model override

## Scaling Limits

**Database Connection Pool:**
- Current capacity: Max 10 concurrent connections (see `src/db/client.ts` line 12)
- Limit: With 3-4 research adapters per channel running in parallel, + queue-runner + API requests, pool exhaustion is likely under load
- Scaling path: Increase pool size to 25-50; add connection pool monitoring; consider read replicas for heavy queries

**Publishing Queue Processing:**
- Current capacity: Single daemon instance checking queue every 60 seconds
- Limit: If queue grows to 1000+ items, 60-second check interval means 16+ items/second throughput needed; actual throughput depends on publishing platform API rate limits
- Scaling path: Add sharded daemon instances (one per channel group); implement priority queue; add configurable check interval

**Research Rate Limiting:**
- Current capacity: All research adapters fetch simultaneously without rate limit tracking
- Limit: Exa API has rate limits (~500 req/month); Reddit/Substack fetches are unthrottled and may hit 429 responses
- Scaling path: Implement request budget system per adapter; add exponential backoff with jitter; cache research results to avoid redundant requests

## Missing Critical Features

**No Observability Stack:**
- Problem: Logging is console.log; no structured logs, metrics, or error tracking
- Blocks: Cannot debug production issues; cannot monitor queue health or research pipeline success rates
- Fix: Add OpenTelemetry or Datadog integration; export logs to CloudWatch/Stackdriver

**No User Audit Trail:**
- Problem: No record of who approved/rejected/regenerated drafts; audit log only tracks AI calls
- Blocks: Regulatory compliance (SOC 2); cannot trace decisions back to users
- Fix: Add user tracking to draft status changes; implement event sourcing for full history

**No Draft Version History:**
- Problem: Rejected or regenerated drafts overwrite previous versions; no "undo" or rollback
- Blocks: User cannot compare versions or recover accidentally rejected content
- Fix: Add `draft_versions` table; soft-delete instead of overwrite

**No Rate Limiting:**
- Problem: API endpoints accept unlimited requests from any source
- Blocks: API can be exhausted by DoS; expensive operations (generation, research) can be triggered repeatedly
- Fix: Implement per-IP or per-user rate limiting (e.g., 10 generation requests/minute, 100 research requests/day)

---

*Concerns audit: 2026-02-26*
