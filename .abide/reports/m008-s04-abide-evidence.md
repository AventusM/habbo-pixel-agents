# M008/S04 — abide/JEV evidence for the changed files

- Slice: S04 (`gsd/m008-s04-convention-sweep-uat-closeout`), head at evidence time
  `f53ff2f` (T01–T04 extraction commits; the T05 evidence commit follows and the
  report judges the slice diff, not this commit).
- Rubric: `.abide/rubric.json` (`when: edit` code-shape rules).
- Raw output: `.abide/reports/m008-s04-abide-check.json` (committed verbatim).
- Whole-file audit: `.abide/reports/m008-s04-abide-audit.json` (committed verbatim).

## How the evidence was produced

The rubric's code-shape rules are `when: "edit"` — abide/JEV judges a **diff**, which
is how the hook enforces them per edit (AGENTS.md, "abide/JEV tier"). The slice diff was
reproduced as uncommitted changes in an isolated git worktree off `origin/main` and
judged with that same lens:

```bash
WT=/var/folders/wv/wf2x0t_n065_slt4q22hbvpw0000gn/T/opencode/abide-m008-s04
git worktree add --detach "$WT" origin/main
cp .env "$WT/.env"
git -C "$WT" checkout f53ff2f -- \
  src/RoomCanvas.tsx \
  src/hooks/useKanbanKeyboard.ts src/hooks/useRoomEditorIO.ts src/hooks/useRoomInput.ts \
  src/hooks/useRoomInteraction.ts src/hooks/useRoomMessages.ts \
  tests/room-editor-io.test.ts tests/room-input.test.ts tests/room-interaction.test.ts \
  tests/room-messages.test.ts tests/store-wiring.test.ts
( cd "$WT" && abide check --json )
( cd "$WT" && abide audit src/RoomCanvas.tsx --json )
```

The raw output is committed verbatim; its `root` field names that temporary worktree
used for isolation. No verdict data was altered.

## Result — 11 files, 0 act-band, 0 blocked

| changed file | rules judged | max probability | max band |
| --- | --- | --- | --- |
| `src/RoomCanvas.tsx` | 9 | 0.21 | clear |
| `src/hooks/useRoomInput.ts` | 2 | 0.03 | clear |
| `src/hooks/useRoomEditorIO.ts` | 2 | 0.04 | clear |
| `src/hooks/useRoomInteraction.ts` | 2 | 0.33 | clear |
| `src/hooks/useRoomMessages.ts` | 2 | 0.04 | clear |
| `src/hooks/useKanbanKeyboard.ts` | 2 | 0.04 | clear |
| `tests/room-input.test.ts` | 2 | 0.05 | clear |
| `tests/room-editor-io.test.ts` | 2 | 0.05 | clear |
| `tests/room-interaction.test.ts` | 2 | 0.09 | clear |
| `tests/room-messages.test.ts` | 2 | 0.08 | clear |
| `tests/store-wiring.test.ts` | 2 | 0.04 | clear |

Required rules, diff lens:

| rule | file | probability | band |
| --- | --- | --- | --- |
| `no-app-logic-in-components` | `src/RoomCanvas.tsx` | 0.13 | clear |
| `no-frame-allocations` | `src/RoomCanvas.tsx` | 0.16 | clear |

The `no-app-logic-in-components` verdict improved from 0.32 (S03 head) to 0.13 now that
the interaction, editor-IO, message-bus and input logic have left the component.

## Whole-file `abide audit` caveat

`abide audit` judges a file *as if just written* (whole-file), not the slice diff. Run
against the full `src/RoomCanvas.tsx` it reports `act` for `no-app-logic-in-components`
(p=0.94) and `no-frame-allocations` (p=0.95). Those are the boundary-excluded residual:
the per-frame stage lifecycle effect (`onTick`/`onDraw`, CanvasStage options) that M008's
boundary map explicitly keeps in the shell, plus the two remaining small shell effects
(editor-state→renderState sync, furniture-direction reset) and the inline `onRotate`
prop. They are not regressions from this slice — the diff lens above is the enforcement
lens (AGENTS.md) and is clear on every rule. Full numbers in
`.abide/reports/m008-s04-abide-audit.json`.

## Parity checklist (S04 UAT)

- [ ] Room render + spawn/walk/despawn unchanged (frame loop still drives avatarManager/idleWander/teleport).
- [ ] Camera follow unchanged (autoFollowTick in the draw pass; jumpToSection via the bus).
- [ ] Kanban filter chip cycles All / GSD only / Non-GSD (g/G and bus `kanbanCards`); expanded-note keyboard traversal (arrows/n/p/b/Escape) unchanged.
- [ ] Editor mode: paint/color/furniture placement, rotate, save/load, dev capture unchanged.
- [ ] Click/context-menu: note hit-testing, avatar select, right-click chair sit/move unchanged.

## RoomCanvas size

`src/RoomCanvas.tsx`: `origin/main` 1036 lines → slice head **478 lines** (−558, −54%).
The milestone success criterion targets a thin orchestrator under ~400 lines; the
residual is the boundary-excluded frame-path stage effect plus the small shell effects
listed above. 478 vs ~400 is recorded as a **documented deviation** in VALIDATION.md
(frame-path extraction is out of M008's boundary map).
