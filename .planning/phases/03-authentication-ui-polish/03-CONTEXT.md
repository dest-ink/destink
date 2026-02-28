# Phase 3: Authentication & UI Polish - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Add single-user authentication so the app is safe to expose over a network, and polish every screen to production quality — empty states, loading states, error states, and the key draft review signals (voice confidence, headline picker, source attribution). The app must require login before any data is accessible, and every screen must be polished enough to hand to a real user.

</domain>

<decisions>
## Implementation Decisions

### Account creation
- First-visit setup wizard: first visitor sees a registration form, creates account on submit, then registration is permanently locked
- No env var seeding or CLI commands — the app handles it

### Login page
- Centered card layout with app logo above, email + password fields
- Minimal — just the form, no split layout or side content
- Login errors shown as inline red text below form fields ("Invalid email or password")

### Session behavior
- Long-lived sessions: 30-day expiry, refreshed on activity
- Session persists across browser refresh
- User can log out from any page, redirected to login screen

### Draft review signals
- Voice confidence: color-coded badge ("87% voice match") — green (80%+), yellow (60-79%), red (<60%)
- Headline picker: radio list showing all options, selected headline updates draft preview in real-time
- Voice badge + headline picker in a header toolbar above the draft body
- Research sources: collapsible "Sources (N)" section below the draft body, collapsed by default, expands to show titles + links

### Empty states
- Friendly message + primary CTA button on all list views
- E.g., "No channels yet" with "Add your first channel" button
- Each empty state has a specific next-step call to action

### Error handling
- Toast notifications (bottom-right) for transient errors, inline messages for form validation
- Platform-specific actionable messages upfront: "Substack API key expired — update in channel settings"
- No generic 500s — errors tell the user what happened and what to do

### Retry affordances
- Failed queue items show red status badge + inline "Retry" button on the queue row
- One-click retry per item, no bulk selection needed

### Visual identity
- Bold & modern aesthetic (Arc/Raycast direction) — strong accent colors, gradients, bolder typography
- Dark mode + light mode with system preference detection + manual toggle
- Primary accent: warm orange/amber tones
- Compact information density — tighter spacing, more items visible at once, dashboard-like

### Per-channel cost data
- Cost data visible in channel dashboard (UI-09)

### Claude's Discretion
- Exact color palette values and gradient implementations
- Loading skeleton designs for async operations
- Typography choices (font family, scale)
- Exact spacing/grid system within "compact" constraint
- Toast animation and auto-dismiss timing
- Setup wizard flow details (number of steps, field validation)
- How dark/light toggle is presented (icon button, dropdown, settings page)

</decisions>

<specifics>
## Specific Ideas

- "Bold & modern" like Arc browser or Raycast — not the typical SaaS look
- Warm orange/amber accent gives creator-energy feel, distinguishes from typical blue tech tools
- Compact density for a power-user dashboard feel — this is a daily-use tool
- Voice confidence badge should be glanceable — color coding makes it instant to assess quality
- Headline picker with real-time preview so the user can see how each option reads in context
- Platform-specific errors are key — a creator needs to know exactly what broke and how to fix it

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-authentication-ui-polish*
*Context gathered: 2026-02-28*
