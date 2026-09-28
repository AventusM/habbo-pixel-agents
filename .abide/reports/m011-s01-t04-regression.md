# M011/S01 T04 — Regression check + evidence + docs

## No regression in the slice checkout

- `npx vitest run`: 73 files, 960 tests, all passed (4.43 s).
- `npx tsc --noEmit`: exit 0.
- `npm run lint`: skipped per the task (no ts/tsx changed — only `.md`
  evidence/docs files on this branch).
- Probe edit still verdicts: created `src/m011-s01-t04-probe.ts`, ran
  `abide check --json` → edit phase 7 rules / 7 verdicts (`$0.00005`),
  then removed the probe; `git status -- src scripts tests` clean after.

## Evidence committed (before → after)

- `.abide/reports/m011-s01-t01-baseline.md` — fresh-worktree skip reproduced
  (4 parallel stops → 4 `kind: skip`, same `git could not snapshot…` reason)
  + sequential timing table (worktree 46–53 ms vs main 95–266 ms).
- `.abide/reports/m011-s01-t02-root-cause.md` — shared-scratch `index.lock`
  race; toggle matrix (sequential-shared 3/3, parallel-unique 12/12,
  parallel-shared 1/6 ×2).
- `.abide/reports/m011-s01-t03-workaround.md` — upstream issue
  `coldteadotai/abide#14` + fresh-worktree `kind: check` verdict
  (7/7 rules `clear`, `blocked: false`, no skip).

## Docs

`docs/agent-hooks/JEVE-HANDOFF.md` gained "Worktree snapshots and the skip
signature (M011/S01)": what the skip signature means, the upstream issue link,
the ride-through / `abide check` workaround, and the no-tuning note.
