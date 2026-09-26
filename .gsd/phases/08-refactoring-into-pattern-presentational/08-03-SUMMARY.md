# S03 Summary — Complete store wiring: remove mirrored and ref state

**Milestone:** M008
**Slice:** S03
**Status:** done-in-fact — delivered via direct `feat(M008/S03)` commits on `gsd/m008-s03-store-wiring` (T01–T06), T06 gate sweep green. Task rows left pending canonical completion (no running Attempt; D018 constraint). Sealed as skipped with delivery reasons per the D014 precedent.

## What happened

The remaining mirrored React state / inferred ref state where a `src/state` store is the source of truth was replaced with store subscriptions behind hooks (D021 convention). Store-backed values now have a single read path (`useStoreValue`), and the shell holds no mirror of them.

- **T01** `a5571f7` — created `src/hooks/useStoreValue.ts` (`useSyncExternalStore` + `store.subscribeSelector`, snapshot `selector(store.get())`); rewrote `useKanbanFilter` to read `kanbanStore` through it (no state mirror); exposed `kanbanStore.get()`; added `tests/store-wiring.test.ts`.
- **T02** `65aa7ad` — created `src/state/uiStore.ts` (`{ devMode, audioReady }` on `createStore`, same pattern as `appMode.ts`); shell reads `devMode` via `useStoreValue(uiStore, selectDevMode)`, the bus writes `uiStore.setDevMode(...)`; added `tests/uiStore.test.ts`.
- **T03** `64bcf20` — audio readiness is now a `uiStore` value: `ensureInitialized()` writes `uiStore.setAudioReady(true)` only after init succeeds; `useRoomAudio` exposes `ready` via `useStoreValue`; shell wired through `RoomDevChrome` → `LayoutEditorPanel` sound tester.
- **T04** `0b4adfa` — store-mirror sweep (none remained beyond the editor's local UI state, D021-exempt) + documented "frame-path refs intentionally kept" block with per-ref performance rationale.
- **T05** `b3f515f` — no-mirror guard tests: source-guards for `useKanbanFilter`/`RoomCanvas`, `useStoreValue` read-through contract, audio-readiness store path.
- **T06** `b656592` — full gate sweep + committed abide/JEV evidence (`.abide/reports/m008-s03-abide-*`).

## Evidence (T06)

- `npx vitest run` → 54 files, **717 tests passed**.
- `npx tsc --noEmit` → **exit 0**.
- `node esbuild.config.mjs` → **exit 0** (extension + webview + web built; assets copied).
- `npm run lint` → **exit 0** (0 errors, 90 pre-existing warnings).
- abide/JEV diff-lens on the 10 changed files → **0 act-band, 0 blocked**; `no-app-logic-in-components` max **0.32 (clear)** and `no-frame-allocations` max **0.11 (clear)** on `src/RoomCanvas.tsx`; raw output `.abide/reports/m008-s03-abide-check.json`, summary `.abide/reports/m008-s03-abide-evidence.md`.
- No store-value mirror remains: `devMode` store-backed, kanban filter store-backed, audio readiness store-backed; remaining refs/state are canvas/render scratch and D021-exempt local editor UI state.

## Parity checklist (for S04 UAT)

- Kanban filter chip label cycles All / GSD only / Non-GSD via `KANBAN_FILTER_LABELS` (now store-backed through `useStoreValue`).
- Dev-mode chrome gate: dev panel stays dead-gated (`false &&`); dev mode read from `uiStore`.
- Audio readiness path: first click / context menu → `ensureInitialized()` → `uiStore.setAudioReady(true)`; readiness surface reflects it.
- Room render + spawn/walk/despawn + camera follow unchanged.

## Deviations

- `src/RoomCanvas.tsx` grew 1018 → 1036 lines (+18), of which +15 is the T04-mandated "frame-path refs intentionally kept" rationale block; the store wiring itself removed a mirror. The < ~400-line thin-orchestrator target stays S04's concern.

## Pending

- Slice PR (`gsd/m008-s03-store-wiring` → `main`) awaiting human review/merge (never auto-merged).
- S04 (convention sweep, UAT + closeout) to follow.
