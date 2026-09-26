# S03 Summary — ESLint gate (typescript-eslint + react-hooks) wired into CI

**Milestone:** M007
**Slice:** S03
**Status:** done-in-fact (task rows pending per D018 precedent)

## What happened
- Installed eslint ^10.11.0, @eslint/js ^10.0.1, typescript-eslint ^8.70.1, eslint-plugin-react-hooks ^7.1.1 (devDependencies).
- Created `eslint.config.js` (flat): js recommended + typescript-eslint recommended + react-hooks (`rules-of-hooks` error, `exhaustive-deps` warn). Pragmatic tuning with in-config rationale: `no-explicit-any` = warn (89 pre-existing usages), `no-unused-vars` ignores `^_` and catch bindings, `no-empty` allows empty catch.
- Added `lint` / `lint:fix` scripts; wired `npm run lint` into `.github/workflows/ci.yml` (after typecheck) and updated `.github/copilot-instructions.md` commands.
- Fixed all 48 initial errors by hand in-session (a background subagent was cancelled — it inherited the old config's disabled deepseek-v4-pro model):
  - 46 no-unused-vars: removed unused imports/declarations; `_`-prefixed the cascade-risky ones (recessedPts x3, drawWallPanelLines, atlasName param, spec/idleSpec/walkSpec/args in tests) per the configured `^_` convention.
  - Removed two dead module-private helpers (`drawLeftFace`, `drawRightFace`) in isoTileRenderer.
  - RoomCanvas:347 — dropped the useless assignment, kept the `spawnAvatar` call.
  - RoomCanvas:1320 — kept the intentionally-disabled LayoutEditorPanel block with a scoped `eslint-disable-next-line`.

## Verification
- `npx eslint src tests` -> exit 0, 0 errors, 92 warnings (89 no-explicit-any + 3 exhaustive-deps, all intentional).
- `npx tsc --noEmit` -> 1 pre-existing error in untracked M004 WIP (`tests/expRunStore.test.ts:96`, `snapshot` not on ExpRunStore) — unrelated to M007.
- `npx vitest run` -> 660 passed, 2 failed; both failures are untracked M004 WIP files (`expRunStore.test.ts`, `exp-dispatch.test.ts`). The three test files touched by this slice pass 49/49.

## Deviations / notes
- `_`-prefixed renames were used for variables whose deletion cascades (dead-code sweep is a follow-up, not this gate's job).
- Any-usage warnings are the tracked backlog; tightening to error is a follow-up.
- package-lock.json is gitignored in this repo (npm deps recorded via package.json).
