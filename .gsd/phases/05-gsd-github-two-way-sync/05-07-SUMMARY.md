---
id: S07
parent: M005
milestone: M005
provides:
  - "Proven round trip: GitHub↔GSD converge in one hop each way with no oscillation; gsd:synced echo guard"
requires:
  - slice: S06
    provides: "the reaction path this UAT exercised live"
affects:
  - scripts/gsd-github-sync.mjs
  - scripts/hooks/gsd-event-hook.mjs
key_files:
  - scripts/gsd-github-sync.mjs
  - scripts/hooks/gsd-event-hook.mjs
  - tests/gsd-event-hook.test.ts
  - .gsd/exec/c136d220-1c18-4462-9e50-aac6db19b85c.stdout
key_decisions:
  - "Echo guard upgraded to a gsd:synced label (D026): reactions run as the repo user, so the comment marker alone could not stop S05 from recording our own close"
patterns_established:
  - "UAT-driven protocol repair: the round-trip rehearsal surfaced the echo gap before it could oscillate"
observability_surfaces:
  - ".gsd/runtime/github-sync/inbox.jsonl (#118 close+reopen intents)"
  - "GitHub #110: gsd:synced label + marker comment + close"
drill_down_paths:
  - .gsd/exec/c136d220-1c18-4462-9e50-aac6db19b85c.stdout
duration: 60m
verification_result: passed
completed_at: 2026-09-26
---

# S07: Backfill + UAT round-trip

**Reconcile clean, and the full loop proven live: close/reopen sync exactly once, reactions label+comment+close, echoes ignored.**

## What Happened

- Reconcile (read-only, `.gsd/exec/c136d220-1c18-4462-9e50-aac6db19b85c.stdout`): 18 issue↔GSD pairs agree; two flags (#102/#104) are M004-era lane-task issues (correctly closed, not milestone issues) — zero stragglers; slices without issues are informational (local work / not yet published).
- Echo gap found by UAT design and fixed (D026): reactions run as the authenticated user, so the `<!-- gsd-sync -->` comment alone could not stop S05 from recording our own close. Protocol upgrade: the hook labels the issue `gsd:synced` before acting, and S05 ignores labeled issues (commit 8b94c46; stub-gh integration test added).
- Live UAT: scratch **#118** (M099/S01) — GitHub close → signed delivery → 1 intent; reopen → 1 intent. Live GSD→GitHub: fixture complete-slice (M005/S06) → **#110** labeled `gsd:synced`, commented with the marker, closed. Echo rehearsal: #110's labeled close delivery → `202 ignored`, inbox unchanged (3→3). #118 left OPEN for manual replay.

## Verification

- `npx vitest run`: 50 files / 684 tests; `npx tsc --noEmit` clean; `node --check` ok.
- Transcripts above; reconcile artifact persisted under `.gsd/exec/`.

## Forward Intelligence

### What the next milestone should know
- Consumer step: applying inbox intents to canonical slice state (evidence/flag via MCP) remains agent-side; the inbox file is the durable handoff (D024).
- To demo manually: close/reopen #118 with the dashboard running; each transition lands exactly one notification.

### What's fragile
- Delivery simulation stands in for a real webhook endpoint (no public URL configured); payload shapes mirror GitHub's.
