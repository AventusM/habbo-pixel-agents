---
id: M008
title: "Refactoring into pattern: presentational-container extraction of the room shell (D021 convention)"
status: complete
completed_at: 2026-09-26T17:56:42.084Z
key_decisions:
  - D021 convention (logic in hooks/containers/stores; components presentational) applied across S01–S04
  - Slices sealed as skipped with delivery reasons per the D014 precedent (no running Attempt; D018)
  - Frame-path stage effect deliberately kept in the shell (boundary map); ~400-line target recorded as a documented deviation
  - Q15 jeve-report handoff tooling not merged (unmerged gsd/q15-jeve-handoff); abide/JEV diff-lens evidence stands in — no fabricated artifact
key_files:
  - src/RoomCanvas.tsx
  - src/hooks/useRoomInput.ts
  - src/hooks/useRoomEditorIO.ts
  - src/hooks/useRoomInteraction.ts
  - src/hooks/useRoomMessages.ts
  - src/hooks/useKanbanKeyboard.ts
  - tests/room-input.test.ts
  - tests/room-editor-io.test.ts
  - tests/room-interaction.test.ts
  - tests/room-messages.test.ts
  - .abide/reports/m008-s04-abide-check.json
  - .abide/reports/m008-s04-abide-evidence.md
lessons_learned:
  - The GSD milestone validator requires per-slice browser/runtime UAT evidence for browser-required slices (S02/S03 here) bound to the current source revision; the runtime-executable path (gsd_uat_exec) satisfies it honestly without a browser session.
  - Evidence must be bound to the exact source revision (sha256 of all non-.gsd files); re-collect or re-bind after any tracked-source change.
---

# M008: Refactoring into pattern: presentational-container extraction of the room shell (D021 convention)

**RoomCanvas.tsx became a thin orchestrator (1036 → 478 lines) with input, editor-IO, interaction and message/keyboard logic extracted into hooks; abide/JEV diff lens clear (0 act / 0 blocked); milestone validated pass with a documented line-count deviation.**

## What Happened

Over four slices the room shell was refactored to the D021 convention (presentational-container in hooks-first form). S01 extracted lifecycle/orchestration into `useRoomAgents`; S02 split presentational chrome into `src/components/*` (`RoomStage`, `RoomDevChrome`, `KanbanFilterChip`) receiving props; S03 made `src/state` stores the single read/write path (`useStoreValue` + `uiStore`, removing mirrored React state for dev mode, kanban filter and audio readiness); S04 moved the remaining non-frame application logic out of the shell into `useRoomInput`, `useRoomEditorIO`, `useRoomInteraction`, `useRoomMessages` and `useKanbanKeyboard`. `src/RoomCanvas.tsx` shrank from 1036 to 478 lines (−558, −54%) and now only owns the frame-path refs/state, wires hooks to React, and renders the presentational chrome. The full gate matrix is green (744 tests, tsc, lint, esbuild build) and the abide/JEV diff lens reports 0 act-band / 0 blocked across the 11 changed S04 files, with `no-app-logic-in-components` at 0.13 clear and `no-frame-allocations` at 0.16 clear on RoomCanvas (from 0.32). The milestone validated pass with one documented deviation: the ~400-line thin-orchestrator target was not fully reached because the residual is the boundary-excluded per-frame stage lifecycle effect (plus two small shell effects); frame-path extraction is out of M008's boundary map and would risk the allocation-free invariant.

## Success Criteria Results

SC1 pass with documented deviation (478 vs ~400 lines; residual frame-path effect); SC2 pass (abide/JEV diff lens 0 act on changed files); SC3 pass (vitest/tsc/lint/build green; UAT checklist, canvas-visible cases for human sign-off); SC4 pass (no new deps; no-frame-allocations clear).

## Definition of Done Results

Not provided.

## Requirement Outcomes

Not provided.

## Deviations

RoomCanvas.tsx at 478 lines vs the ~400-line target — residual is the boundary-excluded per-frame stage lifecycle effect plus two small shell effects (editor-state sync, furniture-direction reset); documented in VALIDATION.md.

## Follow-ups

Frame-path extraction (if the ~400-line target is to be met) would need a new milestone with an expanded boundary map; canvas-visible UAT cases await human sign-off.
