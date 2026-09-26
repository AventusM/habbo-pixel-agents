# S04 Summary — Convention sweep, UAT + closeout

**Milestone:** M008
**Slice:** S04
**Status:** done-in-fact — delivered via direct `feat(M008/S04)` commits on `gsd/m008-s04-convention-sweep-uat-closeout` (T01–T05), full gate matrix green, abide/JEV diff-lens clear. Task rows left pending canonical completion (no running Attempt; D018 constraint). Sealed as skipped with delivery reasons per the D014 precedent.

## What happened

The remaining non-frame application logic was extracted out of `src/RoomCanvas.tsx` into custom hooks (D021 convention), turning the shell into a thin orchestrator; then the convention sweep delivered the green gate matrix, abide/JEV diff-lens evidence and the UAT checklist.

- **T01** `9fc01f7` — created `src/hooks/useRoomInput.ts` (`mouseToTile`, `updateHover`, `onHoverEnd`, all `useCallback`-stable so the CanvasStage options hold stable references); shell wires `onHover`/`onHoverEnd` directly. Added `tests/room-input.test.ts`.
- **T02** `8f3eebb` — created `src/hooks/useRoomEditorIO.ts` (`renderRoomBuffer`, `reRenderRoom`, `setBoothFrame`, `handleSave`, `handleLoad`, `handleDevCapture`); called before `useRoomAgents` so its `setBoothFrame` feeds the spawn/despawn orchestration. Added `tests/room-editor-io.test.ts`.
- **T03** `c703136` — created `src/hooks/useRoomInteraction.ts` (`handleClick`, `handleContextMenu`, `useCallback`-wrapped): note hit-testing, editor paint/color/furniture placement, avatar selection, right-click chair sit/move with the rAF sit-arrival loop. Added `tests/room-interaction.test.ts`.
- **T04** `f53ff2f` — created `src/hooks/useRoomMessages.ts` (the 19-case extension-message dispatcher via `onMessage` + cleanup) and `src/hooks/useKanbanKeyboard.ts` (`g/G` filter cycle + note traversal). Adjusted the `devMode` guard in `tests/store-wiring.test.ts` to point at the dispatcher. Added `tests/room-messages.test.ts`.
- **T05** `22b2ca3` — full gate matrix + abide/JEV diff-lens evidence (`.abide/reports/m008-s04-abide-*`) + line-count measurement.

## Evidence (T05/T06)

- `npx vitest run` → 58 files, **744 tests passed**.
- `npx tsc --noEmit` → **exit 0**.
- `node esbuild.config.mjs` → **exit 0** (extension + webview + web built; assets copied).
- `npm run lint` → **exit 0** (0 errors, 90 pre-existing warnings).
- abide/JEV diff-lens on the 11 changed files → **0 act-band, 0 blocked**; `no-app-logic-in-components` **0.13 (clear)** and `no-frame-allocations` **0.16 (clear)** on `src/RoomCanvas.tsx` (down from 0.32 at the S03 head); raw output `.abide/reports/m008-s04-abide-check.json`, summary `.abide/reports/m008-s04-abide-evidence.md`.
- Whole-file `abide audit src/RoomCanvas.tsx` still reports `act` for `no-app-logic-in-components` (0.94) / `no-frame-allocations` (0.95) — the boundary-excluded frame-path stage effect plus the two remaining small shell effects; not a slice regression. Raw output `.abide/reports/m008-s04-abide-audit.json`.

## Parity checklist (S04 UAT)

- Room render + spawn/walk/despawn unchanged.
- Camera follow unchanged.
- Kanban filter chip cycles All / GSD only / Non-GSD; expanded-note keyboard traversal unchanged.
- Editor mode (paint/color/furniture/rotate/save/load/dev capture) unchanged.
- Click/context-menu (note hit-testing, avatar select, chair sit/move) unchanged.

## Deviations

- `src/RoomCanvas.tsx`: 1036 → **478 lines** (−558, −54%). The milestone target of a thin orchestrator under ~400 lines was **not fully reached**; the residual is the boundary-excluded per-frame stage lifecycle effect (`onTick`/`onDraw` + CanvasStage options) plus the two small shell effects (editor-state→renderState sync, furniture-direction reset). Frame-path extraction is out of M008's boundary map, so this is a **documented deviation** recorded in VALIDATION.md.
- Q15 `scripts/hooks/jeve-report.mjs` is **not merged** (it lives unmerged on `gsd/q15-jeve-handoff`), so no Q15 handoff report was produced or fabricated; abide/JEV evidence stands in as the inspectable diff-lens record.

## Pending

- Slice PR (`gsd/m008-s04-convention-sweep-uat-closeout` → `main`) awaiting human review/merge (never auto-merged).
- M008 validated + completed on this record per D027 (last slice).
