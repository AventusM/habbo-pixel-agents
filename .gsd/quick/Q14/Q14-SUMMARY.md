---
id: Q14
title: "Session-start GitHub→GSD sync wake (inbox consumer)"
type: quick
status: done
completed: 2026-09-26
verification_result: passed
files_modified:
  - scripts/gsd-sync-wake.mjs
  - scripts/gsd-sync-wake.d.mts
  - scripts/hooks/gsd-sync-wake.mjs
  - .opencode/plugin/sync-wake.ts
  - tests/gsd-sync-wake.test.ts
---

# Q14: Session-start GitHub→GSD sync wake — SUMMARY

## Problem

The GitHub→GSD inbox (`.gsd/runtime/github-sync/inbox.jsonl`, D024) accumulated
intents that nothing consumed: no session-start surfacing, no seen-state, and no
cross-harness way to drain it. This was the recorded M005 consumer follow-up.

## Fixes

1. **Pure module** `scripts/gsd-sync-wake.mjs`: `parseInbox` / `collectPending`
   (unseen only, newest first) / `formatWake` (caps at 5 + "…and N more") /
   `markSeen` (pure, no mutation).
2. **CLI** `scripts/hooks/gsd-sync-wake.mjs`: stdout carries only the note
   (empty when idle); diagnostics on stderr; `--no-mark` reads without consuming.
3. **opencode plugin** `.opencode/plugin/sync-wake.ts`: first message of a
   session shells the CLI (cwd = project) and injects the note as a synthetic
   part; one wake per session; errors swallowed.
4. **Seen-state** at `.gsd/runtime/github-sync/seen.json` (runtime, gitignored).

## Verification

- `npx vitest run`: **51 files / 692 tests passed** (8 new: pure + CLI spawn);
  `npx tsc --noEmit` exit 0.
- Live read-only demo against the real inbox (`--no-mark`): printed the 3
  pending transitions; `seen.json` intentionally left unwritten so the next
  opencode session receives the wake.
- Effect appears in **new** opencode sessions (project plugins load at startup).

## Forward notes

- Remaining optional wiring: Claude/Copilot SessionStart entries that call the
  same CLI (hook-gate spec pattern), and running the S06 watcher continuously.
- The wake is advisory: applying intents to canonical GSD state stays with the
  session's GSD-aware agent/MCP tools (authority fencing, D024).
