---
id: Q15
title: "JEV handoff report — end-of-pass abide evidence artifact + session-end hook"
type: quick
status: in_progress
---
# Q15: JEV handoff report — PLAN

## Goal

Every agent pass ends with one inspectable JEV/abide report artifact for its changed
files (verdict, per-rule bands, coverage gaps), so builder → reviewer → fixer handoffs
share one piece of common ground instead of self-reported prose. Precedent: M008/S02
PR #128 escalated because the JEV/abide report for its changed files was
missing/unverifiable (`.abide/events.jsonl` is gitignored; recent entries were `skip`).

## Steps

1. Pure module `scripts/jeve-report.mjs`: parse `.abide/events.jsonl` + `.abide/rubric.json`,
   scope-match changed files, aggregate per-rule bands + per-file coverage, decide the
   verdict, render markdown. No fs/network in the pure functions.
2. CLI `scripts/hooks/jeve-report.mjs`: git range → changed files; optional `--live`
   (`abide check --json` on uncommitted changes); write
   `<out>/<name>-<sha8>.{json,md}` (+ `--latest`), optional `--pr <n>` comment,
   `--require-clear` exit code, `--feed` row into `.gsd/hooks-feed.jsonl`.
   Test overrides: `--events/--rubric/--files/--head-sha/--base-sha/--name/--out`.
3. opencode plugin `.opencode/plugin/jeve-handoff.ts`: on `session.idle`, best-effort run
   the CLI into `.gsd/runtime/jeve-handoff` with `--latest --feed`; never breaks a session.
4. Tests `tests/jeve-report.test.ts`: pure aggregation/verdict/markdown + CLI smoke on temp
   fixtures (no network, no live abide).
5. Docs `docs/agent-hooks/JEVE-HANDOFF.md`: artifact schema, CLI usage, plugin behavior,
   lane wiring (continue closeout + fix pass produce it; review lane verifies against it).

## Verification

- `npx vitest run` green, `npx tsc --noEmit` 0, `npm run lint` 0 errors (worktree).
- Demo: CLI run on this branch produces `.abide/reports/gsd-q15-jeve-handoff-<sha8>.{json,md}`
  and `--require-clear` exits non-zero when coverage is unverified.
- abide/JEV judges every edit during the build; repairs happen in-turn.
