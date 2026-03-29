# Destink - Project Guidelines

## Architecture: Pluggable Provider System

Destink uses a pluggable provider architecture. This is the most important architectural rule:

**Keep ALL provider-specific logic inside provider modules. The core app must not contain platform-specific code.**

### What this means in practice

- Provider modules live in `src/lib/publishing/providers/` and `src/lib/research/adapters/`
- Each provider exports its own metadata, config schema, help text, OAuth config, and display strings
- The app renders UI dynamically from provider data (configSchema, displayName, oauth, helpDetail)
- Never branch on a platform name (`if platform === 'linkedin'`) in components or generic API routes
- Never hardcode provider-specific URLs, field names, or error messages outside the provider module
- If you delete a provider module, the app should still compile and run — just without that provider

### Adding a new publishing provider

1. Create `src/lib/publishing/providers/{name}.provider.ts`
2. Implement the `PublisherProvider` interface from `src/lib/providers/types.ts`
3. Include `configSchema` for credential fields, optional `oauth` config, and `helpDetail` for complex fields
4. Create any platform-specific API routes under `src/app/api/{name}/`
5. The provider is auto-discovered by the registry — no imports needed elsewhere

### Common violations to avoid

- Hardcoded platform display names in components (use `provider.displayName` from the API)
- Platform-specific conditionals in credential forms (use `provider.oauth` and `provider.configSchema`)
- Platform-specific API logic in generic routes like `/api/channels/[id]/credentials`

## Development

- `pnpm dev:all` — start Next.js + daemon
- `pnpm test` — run tests
- `pnpm db:generate` — generate migration after schema changes
- `npx tsc --noEmit` — type check

## Code Style

- One concern per PR
- Run `pnpm test` and `npx tsc --noEmit` before submitting
- Keep provider-specific logic in provider plugins
