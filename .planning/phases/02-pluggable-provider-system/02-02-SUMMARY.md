---
phase: 02-pluggable-provider-system
plan: "02"
subsystem: publishing
tags: [provider-pattern, registry, queue-runner, substack, linkedin]
dependency_graph:
  requires:
    - "02-01 — PublisherProvider interface and Registry<T> class"
  provides:
    - "substack.provider.ts — Substack wrapped as PublisherProvider POJO"
    - "linkedin.provider.ts — LinkedIn wrapped as PublisherProvider POJO"
    - "publisher-registry.ts — singleton registry with isPublisherProvider guard"
    - "queue-runner.ts — registry-based dispatch, no if/else platform chains"
  affects:
    - "queue-runner.ts — platform dispatch logic replaced"
    - "tests/lib/publishing/queue-runner.test.ts — mocks updated from direct imports to registry"
tech_stack:
  added: []
  patterns:
    - "Provider POJO wrapping existing functions (no class instantiation)"
    - "Registry singleton populated via loadDirectory() at startup"
    - "Duck-type guard (isPublisherProvider) for provider validation including apiVersion check"
    - "process.cwd() + relative path for provider directory resolution (tsx + Next.js compatible)"
key_files:
  created:
    - src/lib/publishing/providers/substack.provider.ts
    - src/lib/publishing/providers/linkedin.provider.ts
    - src/lib/publishing/publisher-registry.ts
    - tests/lib/publishing/providers/substack.provider.test.ts
    - tests/lib/publishing/providers/linkedin.provider.test.ts
  modified:
    - src/lib/publishing/queue-runner.ts
    - tests/lib/publishing/queue-runner.test.ts
decisions:
  - "initPublisherRegistry uses process.cwd() + src/lib/publishing/providers for directory path — works in tsx dev and Next.js contexts"
  - "Provider files do not self-register — pull model only, registry discovers them"
  - "isPublisherProvider checks apiVersion === PROVIDER_API_VERSION to reject version-mismatched providers"
  - "queue-runner throws 'No publisher registered for platform X' when registry.get() returns undefined — unified unknown-platform error path"
metrics:
  duration: "4 minutes"
  completed_date: "2026-02-28"
  tasks_completed: 2
  files_created: 5
  files_modified: 2
requirements_satisfied:
  - PUB-02
  - PUB-03
  - PUB-04
  - PUB-05
  - PUB-06
---

# Phase 2 Plan 02: Publisher Provider Migration and Registry Wiring Summary

**One-liner:** Substack and LinkedIn wrapped as PublisherProvider POJOs; queue-runner dispatches via singleton registry — no if/else platform chains remain.

## What Was Built

### Provider Files

**src/lib/publishing/providers/substack.provider.ts**
Default-exported `PublisherProvider` object wrapping `publishToSubstack` and `formatForSubstack` from the existing substack.ts. The `formatDraft` wrapper strips the `channel` argument (formatForSubstack only takes a draft). No self-registration — the registry discovers this file.

**src/lib/publishing/providers/linkedin.provider.ts**
Same pattern for LinkedIn — wraps `publishToLinkedIn` and `formatForLinkedIn`. Both files satisfy the full `PublisherProvider` interface with metadata, `configSchema`, `publish`, and `formatDraft`.

### Publisher Registry

**src/lib/publishing/publisher-registry.ts**
- `isPublisherProvider(val)` — duck-type guard checking all required fields and `apiVersion === PROVIDER_API_VERSION`
- `publisherRegistry` — `Registry<PublisherProvider>` singleton keyed by `p.platform`
- `initPublisherRegistry()` — calls `loadDirectory(process.cwd() + '/src/lib/publishing/providers', '.provider.ts', validate)` to discover and register providers at startup

### Queue Runner

**src/lib/publishing/queue-runner.ts**
Removed direct imports of `publishToSubstack` and `publishToLinkedIn`. Replaced the if/else dispatch block with:

```typescript
const provider = publisherRegistry.get(item.channel.platform);
if (!provider) {
  throw new Error(`No publisher registered for platform '${item.channel.platform}'`);
}
platformResponse = await provider.publish(item.draft, item.channel);
```

Adding a third publisher now requires only a new `*.provider.ts` file — zero changes to queue-runner.

## Tests

- **substack.provider.test.ts** — 5 tests: metadata fields, publish() delegation with (draft, channel), formatDraft() delegation with (draft) only
- **linkedin.provider.test.ts** — 5 tests: same coverage for LinkedIn
- **queue-runner.test.ts** — 11 tests: updated to mock `publisherRegistry.get()` returning a mock provider object; unknown platform test mocks `get()` returning undefined

All 21 tests pass. `npx tsc --noEmit` exits 0.

## Verification Results

1. `npx tsc --noEmit` — exit 0
2. `npm test -- tests/lib/publishing/providers/` — 10/10 pass
3. `npm test -- tests/lib/publishing/queue-runner.test.ts` — 11/11 pass
4. No `publishToSubstack` or `publishToLinkedIn` in queue-runner.ts
5. No `if.*platform.*substack` or `else.*platform.*linkedin` in queue-runner.ts
6. `publisherRegistry.get` present in queue-runner.ts

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 792d0ac | feat(02-02): create Substack and LinkedIn publisher provider files |
| Task 2 | b472319 | feat(02-02): add publisher registry and wire queue-runner dispatch |

## Self-Check

### Files exist

- FOUND: src/lib/publishing/providers/substack.provider.ts
- FOUND: src/lib/publishing/providers/linkedin.provider.ts
- FOUND: src/lib/publishing/publisher-registry.ts
- FOUND: tests/lib/publishing/providers/substack.provider.test.ts
- FOUND: tests/lib/publishing/providers/linkedin.provider.test.ts

### Commits exist

- FOUND: 792d0ac — feat(02-02): create Substack and LinkedIn publisher provider files
- FOUND: b472319 — feat(02-02): add publisher registry and wire queue-runner dispatch

## Self-Check: PASSED
