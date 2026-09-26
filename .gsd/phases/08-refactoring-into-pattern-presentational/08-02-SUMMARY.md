# S02 Summary — Presentational split of room chrome

**Milestone:** M008
**Slice:** S02
**Status:** done-in-fact — delivered via direct `feat(M008/S02)` commits on `gsd/m008-s02-chrome` (T01–T05), T06 parity sweep green. Task rows stay pending canonical completion (no running Attempt; D018 constraint). Sealed as skipped with delivery reasons per the D014 precedent.

## What happened

The shell's UI chrome moved out of `src/RoomCanvas.tsx` into presentational components under `src/components/` (props in, JSX out — no store/client imports, local UI state only) plus one hook for HUD data wiring (D021 convention):

- **T01** `624b8d5` — created `src/components/` and extracted the kanban source filter chip into `KanbanFilterChip.tsx` (label via props; shell derives it from `useKanbanFilter` + `KANBAN_FILTER_LABELS`).
- **T02** `6d0a5ae` — extracted the full-bleed `<canvas>` surface into `RoomStage.tsx` (`canvasRef`, `onClick`, `onContextMenu` via props; native pointer gestures stay in `CanvasStage`).
- **T03** `097e970` — extracted the debug/dev chrome host into `RoomDevChrome.tsx`, preserving the existing dead `false &&` gate and every editor/dev callback via props.
- **T04** `2b645ca` — extracted the orchestration HUD + exp-history HUD store wiring out of the shell's `onDraw` into `src/hooks/useRoomHud.ts` (`agentStore.snapshot()`, `expHistoryFromRuns(...)`); shell forwards plain data into `SceneInputs`.
- **T05** `92601b7` — presentational purity pass: `src/components/*` audited to props-only (no stores/clients/host modules); added `tests/components.test.ts` locking purity + render parity via `react-dom/server`.
- **T06** (this pass) — parity sweep + abide report.

## Evidence (T06)

- `npx vitest run` → 52 files, **703 tests passed**.
- `npx tsc --noEmit` → **exit 0**.
- `node esbuild.config.mjs` → **exit 0** (extension + webview + web built; assets copied).
- `npm run lint` → **exit 0** (0 errors, 90 pre-existing warnings).
- abide per-edit record on S02 files (`src/components/*.tsx`, `src/hooks/useRoomHud.ts`, `src/RoomCanvas.tsx`): **78 checks, 0 blocked, 0 act-band verdicts**; `no-app-logic-in-components` max probability **0.41 (clear)**; `no-frame-allocations` max **0.41 (clear)**.
- Purity: imports under `src/components/` are limited to React types + `LayoutEditorPanel` (presentational) — **no `src/state/*` stores, no `wsClient`/`githubProjects`/`azureDevOpsBoards`, no host modules**.
- `src/RoomCanvas.tsx`: **1038 → 1018 lines**.

## Parity checklist (for S04 UAT)

- kanban filter chip: same fixed-position styling, same `Kanban: <label> · press G` text, now rendered by `KanbanFilterChip` from the shell-derived label.
- room canvas: same full-bleed canvas (`width/height 100%`, `display:block`, `touchAction:none`), same ref and click/context-menu handlers; gestures unchanged.
- debug/dev chrome: dead `false &&` gate preserved exactly; same props flow into `LayoutEditorPanel`.
- orchestration + exp-history HUD: `SceneInputs.orchState`/`expHistory` still supply `agentStore.snapshot()` / `expHistoryFromRuns(expRunStore.all(), expRunStore.visible)`, now behind `useRoomHud`; draw order and per-frame allocation profile unchanged.

## Deviations

- The chrome extraction reduced `RoomCanvas.tsx` by 20 lines (1038 → 1018) rather than a large cut: S02's scope is the chrome surfaces, which are small; the bulk of the shell's residual lines (input/editor handling, frame/draw orchestration, store wiring) is S03 scope. Line-count target revisited at S04.

## Pending

- Slice PR (`gsd/m008-s02-chrome` → `main`) awaiting human review/merge (never auto-merged).
- S03 (store wiring) to continue toward the milestone's < ~400 line target.
