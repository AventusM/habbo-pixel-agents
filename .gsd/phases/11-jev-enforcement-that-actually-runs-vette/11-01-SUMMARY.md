# M011/S01 SUMMARY — Worktree snapshot reliability (delivered, seal pending review per D018)

All 4 planned tasks executed live on branch
`gsd/m011-s01-worktree-snapshot-reliability` (base `origin/main` @ `766301a`):

- T01 reproduce + measure → fresh detached worktree at `feacfca`; real hook
  path (`abide-hook.js turn-start` → probe edit → 4 parallel `stop`) wrote 4
  `kind: skip` rows (`git could not snapshot the working tree in time`) to the
  worktree `.abide/events.jsonl`; sequential `snapshotTree` table: worktree
  46–53 ms vs main 95–266 ms (commit `eede470`).
- T02 root cause → NOT worktree slowness. Every hook in a turn shares one
  scratch index (`turnDir/<session>/<turn>/index`); concurrent hooks collide
  on `index.lock` (`fatal: Unable to create …index.lock`, ~30 ms, nonzero
  exit, not a timeout) and Stop maps it to the same timeout message. Toggle
  matrix: sequential-shared 3/3, parallel-unique 12/12, parallel-shared 1/6
  twice (commit `bf72d01`).
- T03 workaround → cause is inside the published abide CLI (no repo knob), so
  per plan: filed upstream https://github.com/coldteadotai/abide/issues/14 and
  landed the documented workaround (ride-through + race-immune
  `abide check <files>`); fresh-worktree code edit → `kind: check`, 7 rules,
  7× `clear`, `blocked: false`, no skip (commit `59da48b`).
- T04 regression + docs → vitest 73 files / 960 tests passed,
  `tsc --noEmit` clean, probe-edit `abide check` verdicts in the slice
  checkout, docs section in `docs/agent-hooks/JEVE-HANDOFF.md`
  (commit `dd3c190`).

Verification: `npx vitest run` green; `npx tsc --noEmit` green;
`node esbuild.config.mjs` exit 0; `npm run lint` skipped (no ts/tsx changed).

Seal: executed live with pushed commits (evidence above); the GSD DB seal was
not applied mechanically — this lane has no `gsd_gsd_*` MCP tools, and
hand-writing attempt-grade rows is forbidden (D039), so slice/task rows stay
pending for the next auto pass (D018/D037 precedent). GitHub reconcile is
seal-skipped: #146 commented, stays OPEN for the review lane's close-at-merge
(D039: never close pre-merge). No merges by this lane.
