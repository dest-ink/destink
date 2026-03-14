---
phase: 14
slug: automation-config
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/lib/cron-utils.test.ts` |
| **Full suite command** | `npx vitest run tests/lib/cron-utils.test.ts && npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run tests/lib/cron-utils.test.ts && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | AUTO-01 | unit | `npx vitest run tests/lib/cron-utils.test.ts` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | AUTO-01 | tsc | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 14-03-01 | 03 | 2 | AUTO-01,02,03,05 | tsc | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/cron-utils.test.ts` — stubs for INTERVAL_PRESETS mapping and getNextRunAt utility
- [ ] Verify vitest.config.ts includes `tests/**/*.test.ts` pattern (already configured)

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Interval picker dropdown shows all presets | AUTO-01 | Visual UI rendering | Navigate to /research/[id]/automation, click Add Schedule, verify dropdown options |
| Next run time preview updates when interval changes | AUTO-01 | Real-time UI interaction | Select different intervals, confirm preview text updates |
| Schedule card shows correct info after save | AUTO-01 | DB round-trip + visual | Create schedule, verify card displays name, interval, next run |
| Override fields show researcher defaults as placeholders | AUTO-03 | Visual placeholder rendering | Add schedule with overrides empty, confirm placeholder shows researcher values |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
