---
phase: 4
slug: furniture-rendering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-02-28
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- {specific test file}` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds (unit tests only) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- {relevant test file}`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| (To be filled by planner) | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

(To be determined by planner based on research)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual furniture rendering | FURN-03, FURN-05 | Pixel-perfect sprite alignment requires visual inspection | Load webview, place each furniture type, compare against Habbo v14 reference screenshots |
| Multi-tile depth sorting | FURN-04 | Avatar/furniture occlusion only visible at runtime | Place desk with avatar adjacent, verify correct depth ordering |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
