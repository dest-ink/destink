# Feature Research

**Domain:** Pluggable self-hosted content generation and publishing automation
**Researched:** 2026-02-26
**Confidence:** MEDIUM — drawn from competitor analysis (Buffer, Postiz, Mixpost, Ghost, n8n, Activepieces), ecosystem surveys, and published best-practice articles. No direct user research or instrumented data.

---

## Context: What Already Exists

Orbitl's current build (Phase 1-7 complete) already ships:
- Channel management with voice/persona config
- Multi-source research (Exa, Reddit, Substack)
- AI draft generation via Claude with voice confidence scoring
- Draft review UI with approve/reject/edit
- Publish queue with timeline view
- Scheduling with configurable windows
- Background daemon publish loop
- Substack + LinkedIn publishers
- AI audit logging (token usage + cost)

This milestone adds: pluggable provider system, polished UI, Docker/Helm deployment. The research question is: what does "pluggable + polished" mean in this domain, and what separates table stakes from differentiators?

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multi-platform publishing (2+ platforms) | Every scheduling tool supports multiple channels; single-platform feels like a proof-of-concept | MEDIUM | Substack + LinkedIn already exist; pluggable system extends this |
| Draft preview before publish | Users won't approve what they can't see rendered | LOW | Show formatted preview matching target platform's layout |
| Publish status visibility | Users need to know if a post succeeded, failed, or is pending | LOW | Already exists via queue; surface failures prominently in UI |
| Retry failed publishes | Network/API failures happen; users expect to retry without recreating | LOW | Exponential backoff exists; UI must expose retry action |
| Credential storage (encrypted) | Users will not enter API keys that aren't encrypted at rest | LOW | Already implemented via AES-256 |
| Scheduling with timezone support | Publishing at "9am" means 9am in the user's timezone, not UTC | LOW | Critical for Substack/newsletter audiences; easy to overlook |
| Content edit before approval | AI drafts are never perfect; editing must be trivial | LOW | Already exists; polish means the editor must be rich enough |
| Queue management (reorder, delete, pause) | Users change their minds; a locked queue is frustrating | MEDIUM | Timeline view exists; drag-to-reorder and cancel actions needed |
| Basic error messages that explain failures | "Error 500" is useless; "LinkedIn token expired — reconnect" is actionable | LOW | Platform-specific error translation in publisher providers |
| Empty states with next-step guidance | New users with no channels or drafts need to know what to do | LOW | Critical for first-run experience; currently likely missing |
| Loading feedback on async operations | Research and generation take time; users need progress indicators | LOW | Skeleton screens + progress states for research/generation flows |
| Authentication (single-user minimum) | Self-hosted tool with no auth is a security gap for any network-accessible deployment | MEDIUM | Currently no auth; must ship before public deployment recommendation |
| Data export / backup | Self-hosted users own their data and expect to be able to extract it | MEDIUM | Export drafts, channel configs, audit logs as JSON/CSV |

### Differentiators (Competitive Advantage)

Features that set Orbitl apart. Not assumed, but valued. Aligned with Orbitl's core value: "automated, high-quality content that sounds like the creator wrote it."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Drop-in pluggable provider system | Contributors can add a new platform by dropping one file — lower barrier than any competitor | HIGH | Core milestone feature; needs well-documented interface contract + reference implementations |
| Voice confidence score surfaced in UI | Users can see HOW well the AI matched their voice, not just a draft | LOW | Already computed (0-100); just needs UI treatment — badge, tooltip, explanation |
| Per-channel AI cost tracking | Creators know exactly what each channel costs per post/month — builds trust | LOW | Audit log exists; aggregate and surface per-channel in dashboard |
| Research source transparency | Show users WHERE the AI found ideas — not a black box | LOW | Sources stored in research runs; surface them in draft review |
| Pluggable research adapters (not just publishers) | Users can add custom signal sources (RSS feeds, custom APIs, newsletters) | HIGH | Same pattern as publisher providers; consistent extensibility model |
| Voice profile analysis from writing samples | Teach the AI your voice from real examples — not style dropdowns | HIGH | Already built; differentiator vs. tools with generic "professional/casual" toggles |
| Regeneration with notes | "Make it less formal" feedback loop without starting over | LOW | API parameter exists; needs clear UI affordance in draft review |
| AI usage dashboard (aggregate view) | Total spend, cost per draft, cost per channel, trend over time | MEDIUM | Audit log has raw data; dashboard is the aggregation + visualization layer |
| Daily/weekly summary job | Automated digest: what was researched, what was drafted, what was published | MEDIUM | Listed as active requirement; differentiates from one-shot tools |
| Multiple headline options | AI suggests 3-5 headlines; user picks — feels collaborative, not dictatorial | LOW | Already generated (headlineOptions[]); just needs picker UI component |
| Self-hosted with full data ownership | No SaaS lock-in; credentials, drafts, and publishing history stay on your machine | LOW | Architectural — Docker Compose deployment makes this real for users |
| Helm chart for teams | Scale beyond single machine without rebuilding infrastructure | HIGH | Kubernetes deployment option; meaningful for power users |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create scope creep, maintenance burden, or contradict the product's positioning.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Social analytics / engagement metrics | "I want to see how my posts performed" | Deep analytics requires OAuth token refresh loops, platform-specific APIs, and storage — a different product; also out of scope per PROJECT.md | Link out to native platform analytics; don't own the metrics surface |
| Real-time collaboration / multi-user editing | "My team wants to review drafts together" | Multi-user introduces auth complexity, conflict resolution, notifications, permissions — scope expands 3x; contradicts solo-creator positioning | Single-user for v1; the approval workflow IS the collaboration primitive |
| Auto-publish without review | "Skip the approval step for high-volume content" | Risk of publishing broken AI output destroys creator trust; human-in-the-loop is the product's safety moat | Make the review UI so fast (keyboard shortcuts, bulk approve) that skipping it seems unnecessary |
| Built-in image generation | "Generate cover images with the post" | Requires another AI provider integration (DALL-E, Stable Diffusion), media storage, and image optimization — major scope expansion | Accept user-provided images; document how to add image provider as a plugin later |
| Comment/engagement management | "Reply to comments from one place" | Buffer's Community feature required significant engineering for a unified inbox; changes per platform API; not core to content creation | Out of scope; direct users to Buffer or native platform tools |
| SaaS / multi-tenant hosting mode | "Host Orbitl for my clients" | Multi-tenancy requires auth overhaul, data isolation, billing, and support model changes | Self-hosted only per PROJECT.md; explicitly not building this |
| Mobile app | "Approve drafts from my phone" | Native mobile doubles the frontend surface area; mobile-first is not the use case | Responsive web UI; PWA installable from browser if needed |
| Built-in CMS / page editor | "Manage my whole website here" | Ghost, Wordpress, Nuxt Studio already own this space; adding it dilutes the publishing automation focus | Orbitl publishes TO platforms (Substack, LinkedIn); it is not a platform itself |
| Automatic topic selection (fully agentic, no review) | "Just run the whole pipeline without my input" | Research → draft → publish without any human touchpoint removes the quality control that prevents generic AI content | Keep topic selection explicit; make it fast; add "auto-approve" as power-user opt-in ONLY after topic selection |
| Per-post A/B testing | "Test two versions of a post" | Requires platform support (few have it), result tracking, and statistical analysis — not a publishing primitive | Document as a future plugin possibility; don't build now |

---

## Feature Dependencies

```
[Auth (single-user)]
    └──required by──> [Docker Compose deployment] (accessible over network, needs auth)
    └──required by──> [Helm chart deployment] (team use requires auth)

[Pluggable publisher provider interface]
    └──required by──> [Substack provider refactor] (reference implementation)
    └──required by──> [LinkedIn provider refactor] (reference implementation)
    └──required by──> [Any future provider] (Twitter, Medium, Ghost, etc.)

[Pluggable research adapter interface]
    └──required by──> [Exa adapter refactor]
    └──required by──> [Reddit adapter refactor]
    └──required by──> [Substack feed adapter refactor]
    └──enhances──> [Pluggable publisher provider interface] (consistent extensibility model)

[AI audit log (raw data)]
    └──required by──> [AI usage dashboard] (aggregation layer)
    └──required by──> [Per-channel cost display] (filter + sum)
    └──required by──> [Daily summary job] (cost component)

[Draft generation with headlineOptions[]]
    └──enhances──> [Headline picker UI] (surfacing existing data)

[Voice confidence score (computed)]
    └──enhances──> [Voice confidence badge in UI] (surfacing existing data)

[Research sources stored in researchRuns]
    └──enhances──> [Source transparency in draft review] (surfacing existing data)

[Queue management UI]
    └──requires──> [Publish queue (existing)]
    └──enhances──> [Retry failed publishes] (UI action on existing retry logic)

[Polished UI / design system]
    └──enhances──> ALL user-facing features (empty states, loading states, error messages)
    └──required by──> [Meaningful first-run experience]

[Docker Compose deployment]
    └──requires──> [Dockerfiles for web and daemon]
    └──requires──> [DB connection cleanup in jobs] (clean shutdown on container stop)
    └──requires──> [Auth] (network-accessible; open app = open publishing)

[Helm chart]
    └──requires──> [Docker Compose deployment] (Helm wraps Docker images)
    └──requires──> [Auth]
```

### Dependency Notes

- **Auth requires Docker deployment:** Without deployment, the app runs on localhost where auth is optional. Once Docker Compose makes it network-accessible, auth becomes required, not optional.
- **Pluggable interfaces require refactored reference implementations:** The interface contract is only trustworthy once proven by two real implementations (Substack + LinkedIn). Ship both in the same milestone as the interface.
- **AI dashboard requires no new data collection:** All data is already in `aiAuditLog`. The feature is pure aggregation and display — LOW effort for HIGH perceived value.
- **Polished UI is a force multiplier:** Empty states, skeleton loading, and error messages affect every feature. Build them as shared components early in the UI polish phase.

---

## MVP Definition

### This Milestone: Launch With (v1 completion)

Minimum scope to call v1 "done" and ship to real users:

- [ ] **Pluggable publisher interface** — documented TypeScript interface; Substack + LinkedIn refactored as reference providers; auto-discovery from filesystem
- [ ] **Pluggable research adapter interface** — same pattern; Exa/Reddit/Substack adapters refactored
- [ ] **Authentication (single-user)** — password or token; required before Docker deployment recommendation
- [ ] **Docker Compose deployment** — single `docker-compose up` brings up web + daemon + PostgreSQL; includes .env.example
- [ ] **Polished UI: critical flows** — draft review, queue management, channel setup; empty states; loading states; error messages that are actionable
- [ ] **AI usage dashboard** — aggregate spend by channel and by operation type; trend over 30 days
- [ ] **Timezone-aware scheduling** — user configures timezone per channel; "9am" means their 9am
- [ ] **DB connection cleanup** — clean shutdown for daemon and job runners; required for Docker

### Add After Validation (v1.x)

- [ ] **Headline picker UI** — surface `headlineOptions[]` as selectable chips in draft review; data already exists
- [ ] **Voice confidence badge** — show score in draft review with tooltip explaining what it means; data already exists
- [ ] **Research source transparency** — expandable "sources used" section in draft review
- [ ] **Daily/weekly summary job** — automated digest email or log entry; channels + cost + published count
- [ ] **Data export** — JSON export of drafts, channels, audit log; single-click in settings
- [ ] **Retry UI for failed queue items** — button in queue view; backend already handles retries

### Future Consideration (v2+)

- [ ] **Helm chart** — defer until users actually request k3s/Kubernetes scaling
- [ ] **Additional publisher providers** — Twitter/X, Medium, Ghost, Bluesky — let community contribute via pluggable system
- [ ] **Additional research adapters** — RSS feeds, Hacker News, custom webhooks
- [ ] **Multi-user auth** — if the solo-creator assumption is ever invalidated
- [ ] **Bulk approve** — keyboard-driven approval flow for high-volume channels

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Pluggable publisher provider system | HIGH | HIGH | P1 — core milestone goal |
| Pluggable research adapter system | HIGH | HIGH | P1 — core milestone goal |
| Authentication | HIGH | MEDIUM | P1 — required for deployment |
| Docker Compose deployment | HIGH | MEDIUM | P1 — self-hosting is the product |
| Polished UI (empty states, errors, loading) | HIGH | MEDIUM | P1 — determines if product feels done |
| Timezone-aware scheduling | HIGH | LOW | P1 — correctness issue, not polish |
| AI usage dashboard | MEDIUM | LOW | P2 — existing data, new display |
| Headline picker UI | MEDIUM | LOW | P2 — existing data, new display |
| Voice confidence badge | MEDIUM | LOW | P2 — existing data, new display |
| Source transparency in draft review | MEDIUM | LOW | P2 — existing data, new display |
| Daily summary job | MEDIUM | MEDIUM | P2 — differentiating automation |
| Data export | MEDIUM | LOW | P2 — self-hosted user expectation |
| Retry UI for queue failures | MEDIUM | LOW | P2 — queue exists; just needs button |
| Helm chart | LOW | HIGH | P3 — defer until demanded |
| Bulk approve | LOW | MEDIUM | P3 — niche use case |

**Priority key:**
- P1: Must have for v1 launch
- P2: Should have, add in v1.x
- P3: Nice to have, v2+ consideration

---

## Competitor Feature Analysis

| Feature | Buffer (SaaS) | Postiz (OSS) | Mixpost (OSS) | Orbitl Approach |
|---------|---------------|--------------|---------------|-----------------|
| Multi-platform publishing | 8 platforms | 10+ platforms | 10+ platforms | Pluggable system — community-extensible |
| AI content generation | Basic AI assist | Basic AI assist | Basic AI assist | Full pipeline: research → ranked topics → voice-matched draft |
| Voice / persona matching | Generic tones | Not present | Not present | Writing sample analysis → extracted persona → voice confidence score |
| Research automation | Not present | Not present | Not present | Multi-source (Exa, Reddit, Substack, brainstorm) with topic ranking |
| Draft review workflow | Not present | Not present | Not present | Full review UI with approve/reject/edit/regenerate |
| Publish queue | YES | YES | YES | YES — with retry logic |
| Scheduling | YES | YES | YES | YES — with configurable windows per channel |
| Self-hosted | No (SaaS only) | YES | YES | YES — Docker Compose + Helm |
| AI cost tracking | No | No | No | YES — per operation, per channel |
| Plugin/provider system | No | Partial | No | YES — drop-in file with auto-discovery |
| Analytics | YES (extensive) | Basic | YES | OUT OF SCOPE — publish-only |
| Auth | OAuth + team | Single/multi | Single/multi | Single-user (v1) |

**Key finding:** No competitor combines (1) AI voice cloning from writing samples + (2) research automation + (3) pluggable provider system. Buffer owns analytics/scheduling; Postiz/Mixpost own multi-platform self-hosting. Orbitl's moat is the voice-matched content pipeline with an open extension model. Protect that moat — don't diffuse focus into analytics or engagement management.

---

## Sources

- Buffer 2025 product launches: [Everything we launched in Buffer in 2025](https://buffer.com/resources/everything-we-launched-in-buffer-in-2025/)
- Postiz open source social scheduler comparison: [Top 12 Open Source Social Media Scheduler Tools for 2025](https://postiz.com/blog/open-source-social-media-scheduler)
- Mixpost self-hosted social management: [Mixpost](https://mixpost.app)
- AI content workflow stages and human-in-the-loop: [How to Build an AI Driven Content Workflow](https://www.clickrank.ai/ai-driven-content-workflow/)
- Plugin/provider system design patterns: [Building a plugin architecture — ArjanCodes](https://arjancodes.com/blog/best-practices-for-decoupling-software-using-plugins/); [Registry Pattern — GeeksForGeeks](https://www.geeksforgeeks.org/system-design/registry-pattern/)
- Pluggable framework patterns (2025): [Scaling Infrastructure Fast — Scaibu/Medium](https://scaibu.medium.com/scaling-infrastructure-fast-you-need-a-typed-pluggable-framework-now-a8eb7cfafe8a)
- AI cost/token tracking landscape: [Best Tools for Monitoring LLM Costs — DEV Community](https://dev.to/kuldeep_paul/the-best-tools-for-monitoring-llm-costs-and-usage-in-2025-5f3a)
- Awesome-selfhosted publishing category: [awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted)
- Dashboard UI expectations 2025: [20 Principles Modern Dashboard UI/UX Design](https://medium.com/@allclonescript/20-best-dashboard-ui-ux-design-principles-you-need-in-2025-30b661f2f795)
- Content publishing platform expectations: [The Best Content Publishing Platforms in 2025](https://storychief.io/blog/content-publishing-platforms)
- Competitor landscape (Postiz vs Mixpost): [Mixpost vs Postiz comparison](https://openalternative.co/compare/mixpost/vs/postiz)

---
*Feature research for: Pluggable self-hosted content generation and publishing automation (Orbitl)*
*Researched: 2026-02-26*
