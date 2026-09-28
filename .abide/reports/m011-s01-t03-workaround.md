# M011/S01 T03 — Workaround landed (cause is upstream)

## Cause location

`snapshotTree` shared-scratch lock race, inside the published abide CLI
(`packages/cli/src/lib/git.ts:173`, `hooks/stop.ts`, `hooks/turnStart.ts`).
No repo-owned knob exists (only `ABIDE_DEBUG` / `ABIDE_HOME_DIR` env; the
sessions dir is global by design). Deliberately no `.gitignore`/config/tuning
churn: measured snapshot costs are 50–260 ms against 5 s/8 s budgets.

## Upstream issue (filed)

https://github.com/coldteadotai/abide/issues/14 — root cause, toggle matrix,
repro, and suggested fix (per-invocation scratch path or lock retry, plus a
distinct skip message so lock contention stops masquerading as slow git).

## Documented workaround (repo-owned)

1. Ride through: a skipped turn loses no enforcement — the next sequential
   hook snapshots fine (T01 table). Skips come in same-second pairs during
   parallel tool batches; that signature means "lock race", not "slow repo".
2. Deterministic re-check: `abide check <files>` reproduces the verdicts on
   demand. It uses the `workingTreeDiff` path, and `GIT_INDEX_FILE` is set
   ONLY in `snapshotTree` (single grep hit: `lib/git.ts:173`), so `check` is
   immune to the race by construction. Demonstrated in a fresh worktree:
   `abide check --json src/m011-s01-probe-t03.ts` → edit phase, 7 rules
   judged, all `clear`, `$0.00005`.

## After-evidence: fresh-worktree edit → check verdict, no skip

New worktree at `bf72d01`, real hook path
(`abide-hook.js turn-start` → probe edit → single `stop`), session
`ses_m011s01wt03` / `turn-t03c`, worktree `.abide/events.jsonl`:

```json
{"kind":"check","at":"2026-09-28T20:30:09.615Z","phase":"turn","sessionId":"ses_m011s01wt03","promptId":"turn-t03c","files":["src/m011-s01-probe-t03.ts"],"rules":7,"latencyMs":1228,"modelLatencyMs":1119,"usage":{"inputTokens":1268,"outputTokens":154,"costUsd":5.3e-05},"verdicts":[{"ruleId":"no-new-object-in-memo-props","probability":0.02,"band":"clear"},{"ruleId":"no-derived-state-effect","probability":0.02,"band":"clear"},{"ruleId":"no-listener-without-cleanup","probability":0.01,"band":"clear"},{"ruleId":"no-fetch-in-components","probability":0.02,"band":"clear"},{"ruleId":"lazy-loading-fallback","probability":0.02,"band":"clear"},{"ruleId":"no-children-clone-for-state","probability":0.01,"band":"clear"},{"ruleId":"no-app-logic-in-components","probability":0.02,"band":"clear"}],"blocked":false}
```

Before (T01): 4/4 parallel stops skipped with
`turn diff incomplete: git could not snapshot the working tree in time`.
After (sequential hooks): `kind: check`, 7/7 rules `clear`, `blocked: false`.
A docs-only probe in the same worktree also verdicts (`rules: 0` — no code
rules apply to markdown — still `kind: check`, not a skip).
