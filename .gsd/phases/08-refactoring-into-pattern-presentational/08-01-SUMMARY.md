# S01 Summary — RoomCanvas orchestration extracted into custom hooks

**Milestone:** M008
**Slice:** S01
**Status:** done-in-fact — delivered via direct `feat(M008/S01)` commits on `gsd/m008-s01-hooks` (T01–T05), T06 parity sweep green. Task rows stay pending canonical completion (no running Attempt; D018 constraint). Sealed as skipped with delivery reasons per the D014 precedent.

## What happened

Stage-adjacent orchestration moved out of `src/RoomCanvas.tsx` into named hooks under `src/hooks/`, shell consumes them (D021 convention):

- **T01** `b187770` — created `src/hooks/` and extracted the kanban-filter mirror into `useKanbanFilter`.
- **T02** `769b063` — extracted audio init + AudioManager + sound buffers + `handlePlaySound` into `useRoomAudio`.
- **T03** `6c8ddc5` — extracted auto-follow camera refs + tick glue into `useAutoFollowCamera`.
- **T04** `4b3048a` — extracted agent spawn/despawn/teleport lifecycle into `useRoomAgents` (part 1), preserving ordering and guards.
- **T05** `4f36f45` — extracted `agentStatus`/`agentTool`/`agentLinkedTicket` + idle-wander glue and folded manager construction into `useRoomAgents` (part 2); shell reads handles only.
- **T06** (this pass) — parity sweep + abide report.

## Evidence (T06)

- `npx vitest run` → 51 files, **692 tests passed**.
- `npx tsc --noEmit` → **exit 0**.
- `node esbuild.config.mjs` → **exit 0** (extension + webview + web built; assets copied).
- abide per-edit record on S01 files (`src/RoomCanvas.tsx`, `src/hooks/use*.ts`): **68 checks, 0 blocked, 0 act-band verdicts**; `no-app-logic-in-components` max probability **0.28 (clear)**; `no-frame-allocations` max **0.41 (clear)**.
- Whole-file `abide audit` acts on `src/RoomCanvas.tsx` (0.95/0.96) — expected: it judges the full residual file, whose non-S01 logic (input/editor handling, frame/draw orchestration, chrome) is S02/S03 scope. The milestone criterion is per-edit enforcement, which is clear.
- `src/RoomCanvas.tsx`: **1367 → 1038 lines**.

## Parity checklist (for S04 UAT)

- spawn: `agentCreated` → booth spawn + teleport flash + pending step-out (`useRoomAgents.handleAgentCreated`).
- despawn: `agentRemoved` → walk-to-booth + effect + scheduled removal (`handleAgentRemoved`, `tickDespawns`).
- status/tool/ticket: `agentStatus`/`agentTool`/`agentLinkedTicket` delegate to hook handlers; store updates unchanged.
- auto-follow: `autoFollow` message → `useAutoFollowCamera.setEnabled`; frame-loop tick unchanged.
- kanban filter: `useKanbanFilter` mirror consumed by HUD/draw path.
- audio: `playSound` case → `useRoomAudio.playSound`.

## Deviations

- Plan demo targeted `RoomCanvas.tsx < ~700 lines`; delivered **1038** (1367 → 1038). All listed S01 concerns are extracted; residual lines are non-S01 logic deferred to S02/S03. Line-count target to be revisited at S02.
- `clearAgents` and `jumpToSection` cases remain in the shell (outside S01's listed concerns).

## Pending

- Slice PR (`gsd/m008-s01-hooks` → `main`) awaiting human review/merge (never auto-merged).
- S02 (presentational split) + S03 (store wiring) to bring the shell toward the milestone's < ~400 line target.
