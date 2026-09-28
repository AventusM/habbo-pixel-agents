# M011/S01 T02 — Root cause: shared scratch index + parallel hooks

## One-paragraph root cause

The skip is not worktree slowness. Every hook in a turn snapshots through ONE
shared scratch git index — `snapshotTree(root, path.join(turnDir(session, turn),
"index"))` (`packages/cli/src/hooks/stop.ts`, `turnStart.ts`; `turnDir` lives
under the global sessions dir, so this holds in every checkout). When two or
more hooks of the same turn run concurrently (parallel tool calls → parallel
hook processes), their `git add -A -- .` invocations share one `GIT_INDEX_FILE`
and collide on its `index.lock`; all but one die in ~30–60 ms with
`fatal: Unable to create '.../index.lock': File exists` (nonzero exit, NOT a
timeout). `snapshotTree` (`packages/cli/src/lib/git.ts`) returns `undefined`
for that, and Stop reports the catch-all
`git could not snapshot the working tree in time` → `kind: skip`. The
worktree premise is refuted by measurement (T01 table): isolated snapshots in
a fresh worktree take 46–53 ms — FASTER than main at 95–266 ms — and fail 0/6;
sharing the scratch path under concurrency fails 5/6 in both checkouts.

## Toggle matrix (same real `snapshotTree`, `GIT_INDEX_FILE` varied)

| condition | result |
|---|---|
| sequential, shared scratch, 3× | 3/3 ok (202/95/96 ms) |
| 12 parallel, UNIQUE scratch each | 12/12 ok (~350–400 ms) |
| 6 parallel, SHARED scratch (hook-faithful), run A | 1/6 ok, 5 fail in ~30–40 ms |
| 6 parallel, SHARED scratch (hook-faithful), run B | 1/6 ok, 5 fail in ~49–59 ms |

Toggling only the scratch-sharing moves success 17% → 100%: concurrency alone
is harmless (row 2), sharing alone is harmless (row 1); the conjunction fails.

## Why the message misleads

`stop.ts` `gitTurnDiff` maps BOTH `snapshotTree → undefined` (any reason,
including the ~30 ms lock race) and an exhausted diff budget to the single
string `git could not snapshot the working tree in time`. Fast failures are
therefore indistinguishable from slow git in `.abide/events.jsonl`.

## Fix selection (consumed by T03)

The defect is inside the published abide CLI (not repo-owned): the per-turn
scratch path must be per-invocation (e.g. `index.<pid>`), or `git add` must
retry past a transient lock. No repo-owned knob exists (only `ABIDE_DEBUG` /
`ABIDE_HOME_DIR` env; sessions dir is global by design). Per the slice plan:
file the upstream issue (best-effort) and land the documented workaround in
repo-owned surface instead. Deliberately NOT done: `fsmonitor`/`untrackedCache`
tuning or `.gitignore` churn — measured costs are already ~20–100× under
budget, so that would be cargo-cult tuning against the evidence.
