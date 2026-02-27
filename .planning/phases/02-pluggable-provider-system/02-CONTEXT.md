# Phase 2: Pluggable Provider System - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor publishers and research adapters from hardcoded if/else chains and static import arrays into auto-discovered, drop-in modules. A contributor adds a new platform by creating one file — no changes to core orchestration code. Providers are self-describing: they carry their own metadata and configuration schema so the UI can render dynamically from the registry.

</domain>

<decisions>
## Implementation Decisions

### Interface contract design
- Plain object exports (not classes) — each provider file exports a typed object literal matching its interface
- Separate interfaces for publishers (PublisherProvider) and research adapters (ResearchAdapter) — they solve different problems
- Publisher required methods: `publish(draft, channel)`, `formatDraft(draft, channel)`, plus metadata: `{ name, platform, apiVersion }`
- Publisher optional method: `getMetrics(postId)` — for fetching post performance data back from the platform (views, engagement). Not all platforms may support this initially; providers that don't implement it return null
- Research adapter interface is separate — `search(config)` returning `ResearchSource[]`

### Self-describing providers
- Providers export display metadata: `{ name, displayName, description, icon }` — the UI reads this from an API endpoint backed by the registry
- Providers export a `configSchema` array describing their configuration fields: `[{ key, label, type, required }]` — field types include `string`, `secret`, `url`, `number`, etc.
- The UI renders config forms dynamically from the provider's declared schema — no hardcoded forms per platform
- The registry is the single source of truth: platform dropdowns, config forms, and available adapters all come from registered providers

### Discovery & registration
- Flat directory structure: `src/lib/publishing/providers/*.provider.ts` and `src/lib/research/adapters/*.adapter.ts`
- Startup scan: scan provider directories once at app startup, validate, build the registry, freeze it
- Generic `Registry<T>` class instantiated as `publisherRegistry` and `adapterRegistry` — same discovery/registration logic, separate types and directories
- Research adapters are channel-configurable: each channel specifies which research adapters to use, rather than all adapters always running

### Error & validation behavior
- Malformed providers at startup: skip the broken provider + log a loud, clear warning (file name + what's wrong). Other valid providers still register. One bad file doesn't crash the app
- The registry drives what platforms are available in the UI — if no publisher is registered for a platform, that platform simply doesn't appear as a choice when creating channels. Prevents the mismatch case entirely
- PROVIDER_API_VERSION constant for forward compatibility gating

### Migration strategy
- All existing modules migrated at once in this phase: Substack publisher, LinkedIn publisher, Exa adapter, Reddit adapter, Substack Monitor adapter
- Brainstorm adapter (currently used directly in generation, not wired into orchestrator) also becomes a pluggable research adapter — channels can opt in/out
- App is not live — no database migration needed. Schema designed cleanly from scratch
- No legacy code paths preserved. Clean break: old if/else dispatch and hardcoded imports are fully replaced

### Claude's Discretion
- Exact TypeScript type definitions and generics for Registry<T>
- Internal registry data structures (Map vs other)
- File scanning mechanism (glob pattern, fs.readdir, etc.)
- Zod schema generation from configSchema for runtime validation
- API endpoint design for exposing registry to the frontend
- Test strategy and coverage approach

</decisions>

<specifics>
## Specific Ideas

- Post performance tracking is a key motivation: the system should eventually learn what types of posts perform well and adjust content strategy. getMetrics() is the first step toward this feedback loop.
- "The app should automatically know what providers are available and should list out any available providers. The app should never have hardcoded publishers or research providers; it should always use what has been registered with the system and offer those as choices."
- Provider config schemas should be rich enough that the UI never needs platform-specific code — a new provider file is truly all that's needed.

</specifics>

<deferred>
## Deferred Ideas

- Post performance analytics dashboard (using getMetrics data) — future phase or v2
- Algorithmic content strategy based on performance data — v2 (ANAL-03 voice drift detection is related)
- Provider marketplace / community registry — v2 (PROV-03)

</deferred>

---

*Phase: 02-pluggable-provider-system*
*Context gathered: 2026-02-27*
