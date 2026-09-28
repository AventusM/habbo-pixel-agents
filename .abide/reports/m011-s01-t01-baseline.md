# M011/S01 T01 — Worktree skip baseline (before-evidence)

Date: 2026-09-28. Harness: real `snapshotTree` imported from the installed CLI
(`~/.local/share/abide/packages/cli/dist/lib/git.js`); hook path driven through
the real entrypoint (`dist/abide-hook.js turn-start|stop`) with cwd in a fresh
worktree (`git worktree add --detach` at `feacfca`).

## Skip reproduced in a fresh worktree

Sequence: `turn-start` (session `ses_m011s01wt01`, prompt `turn-t01`) → append a
probe line to `docs/abide-worktree-probe-t01.md` → 4 parallel `stop` hooks.
All 4 stops wrote skip events to the worktree's `.abide/events.jsonl`:

```json
{"kind":"skip","at":"2026-09-28T20:27:53.902Z","phase":"turn","sessionId":"ses_m011s01wt01","reason":"turn diff incomplete: git could not snapshot the working tree in time","files":[]}
```

(×4, same second; full lines in `.abide/events.jsonl` of the throwaway worktree,
removed after the pass. Same signature as live main-checkout skips, e.g.
`ses_f16533164ffeDGxTv8BL4j6KbE` at `2026-09-28T20:20:13Z`.)

## Timing table: sequential snapshotTree (real function, ms)

| checkout | budget | run 1 | run 2 | run 3 |
|---|---|---|---|---|
| main | 8000 (STOP) | 220 | 95 | 99 |
| worktree (fresh) | 8000 (STOP) | 52 | 47 | 46 |
| main | 5000 (TURN_START) | 266 | 97 | 97 |
| worktree (fresh) | 5000 (TURN_START) | 53 | 47 | 50 |

Isolated snapshots succeed everywhere, ~20–100× under budget — and the fresh
worktree is FASTER than main, not slower. Raw git speed in worktrees is not
the skip driver (see T02 root-cause note).

## Shared-scratch contention (mechanism check, same function)

12 parallel snapshots with a UNIQUE scratch index each: 12/12 ok (~350–400 ms).
6 parallel snapshots sharing ONE scratch index (what every hook in a turn does —
`snapshotTree(root, path.join(turnDir, "index"))`): 1/6 ok, 5/6 fail in ~30 ms.
Direct `git add -A` with a shared `GIT_INDEX_FILE` fails with:

```text
fatal: Unable to create '.../index.lock': File exists.
Another git process seems to be running in this repository, e.g.
```

## Environment facts

- `git version 2.50.1 (Apple Git-155)`
- main: `count: 6979, size: 32392, in-pack: 3226`; 217 untracked files
  (mostly `.gsd/exec/` run logs); worktree at creation: `count: 6988`, 0 untracked
- `core.fsmonitor` and `core.untrackedCache` unset in BOTH checkouts
- Budgets (`packages/cli/src/lib/constants.ts`): `GIT_TIMEOUT_MS=5000`,
  `TURN_START_TIMEOUT_MS=5000`, `STOP_GIT_TIMEOUT_MS=8000`
- `.abide/events.jsonl` is gitignored; this file is the committed before-evidence.
