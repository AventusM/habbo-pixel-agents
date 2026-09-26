---
id: Q14
title: "Session-start GitHub→GSD sync wake (inbox consumer)"
type: quick
status: done
---
# Q14: Session-start GitHub→GSD sync wake — PLAN

## Goal

Surface unseen GitHub→GSD sync intents when work begins, and give every harness
one way to consume them (the M005 consumer follow-up, D024).

## Steps

1. Pure module `scripts/gsd-sync-wake.mjs`: parse inbox JSONL, filter unseen
   (against seen.json), format one compact note, mark seen — no fs in the module.
2. CLI `scripts/hooks/gsd-sync-wake.mjs`: stdout = note only (empty when idle),
   stderr = diagnostics, `--no-mark` reads without consuming.
3. opencode plugin `.opencode/plugin/sync-wake.ts`: on the first `chat.message`
   of a session, shell the CLI (cwd = project) and inject stdout as a synthetic
   part; one wake per session; errors swallowed.
4. Tests: pure functions + CLI smoke on temp files.
5. Verification: vitest + tsc; live read-only demo against the real inbox.
