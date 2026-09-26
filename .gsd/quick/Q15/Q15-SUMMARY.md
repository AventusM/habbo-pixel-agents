---
id: Q15
title: "JEV handoff report — end-of-pass abide evidence artifact + session-end hook"
type: quick
status: done
completed: 2026-09-26
verification_result: passed
files_modified:
  - scripts/jeve-report.mjs
  - scripts/jeve-report.d.mts
  - scripts/hooks/jeve-report.mjs
  - .opencode/plugin/jeve-handoff.ts
  - tests/jeve-report.test.ts
  - docs/agent-hooks/JEVE-HANDOFF.md
  - .gsd/quick/Q15/Q15-PLAN.md
  - .gsd/quick/Q15/Q15-SUMMARY.md
---

# Q15: JEV handoff report — SUMMARY

## Problem

Handoffs between looped agents (builder → reviewer → fixer) had no shared JEV/abide
evidence: `.abide/events.jsonl` is gitignored, so the review lane saw only prose claims
(`78 checks, 0 blocked` with no inspectable artifact) and escalated PR #128 —
"JEV/abide report for the changed files is missing/unverifiable". Recent events were
`skip: turn diff incomplete`, i.e. no rule bands at all.

## What shipped

1. **Pure module** `scripts/jeve-report.mjs` — parses events + rubric, scope-matches
   changed files (`**` crosses dirs, absent scope = all), aggregates worst band / max
   probability / check count per governed model rule, merges optional live verdicts,
   decides `blocked > act > unverified > clear` (or `empty`), and renders greppable
   markdown. No fs/network; typed via `scripts/jeve-report.d.mts`.
2. **CLI** `scripts/hooks/jeve-report.mjs` — git range → changed/deleted split, writes
   `<out>/<name>-<headSha8>.{json,md}` (+ `--latest`), `--live` (`abide check --json`
   on uncommitted changed files), `--pr <n>` comment, `--feed` hooks-feed row (role
   reviewer), `--require-clear` exit 1 when not `clear|empty`, usage/IO exit 2.
   `--head-sha/--base-sha` overrides resolve refs through git (test shas pass through).
3. **Plugin** `.opencode/plugin/jeve-handoff.ts` — on `session.idle` runs the CLI into
   `.gsd/runtime/jeve-handoff` (`--latest --feed`), one run per session at a time, all
   errors swallowed: a rolling end-of-pass artifact for local handoffs.
4. **Tests** `tests/jeve-report.test.ts` — 15 tests: parsing, globs, worst-band
   aggregation, live merge, verdicts, file statuses, skips + base-time window,
   markdown contract, and offline CLI smoke (artifact naming, `--require-clear`
   1/0, deleted→empty).
5. **Docs** `docs/agent-hooks/JEVE-HANDOFF.md` — artifact schema, CLI table, plugin
   behavior, lane wiring (continue lane commits `.abide/reports/*-<sha8>.{json,md}`;
   review lane verifies by head sha; absence/stale/unverified is the JEV finding).

## Verification

- `npx vitest run` → **52 files / 711 tests passed** (includes 15 new).
- `npx tsc --noEmit` → exit 0. `npm run lint` → 0 errors (90 pre-existing warnings).
- Demo on committed head `d2b3fa7`:
  `node scripts/hooks/jeve-report.mjs --base-sha ad4f6a0 --head-sha HEAD --stdout md`
  → `clear .abide/reports/gsd-q15-jeve-handoff-d2b3fa7f.{json,md}` (2 governed rules,
  real event evidence, exit 0); with `--require-clear` → exit 0.
- Fixture with skip-only events → verdict `unverified`, `--require-clear` exit 1.
- abide/JEV judged the edits in-session (`no-derived-state-effect` /
  `no-listener-without-cleanup` clear, 2 checks each).

## Commits

- `7384124` feat(Q15): JEV handoff report — per-pass abide evidence artifact + session-end hook
- `d2b3fa7` fix(Q15): resolve --head-sha/--base-sha refs through git
- (this commit) docs(Q15): JEVE handoff guide + Q15 summary

## Notes

- `--live` costs model spend and is opt-in; tests never call it.
- Event window is bounded to the base commit time when it resolves; skip rows carry no
  files, so they are counted and their reasons noted (never attributed to a file).
- Never merged/pushed by the build; branch `gsd/q15-jeve-handoff` is based on
  `origin/main` (`ad4f6a0`), built in `.gsd/exp-worktrees/q15-jeve-handoff`.
