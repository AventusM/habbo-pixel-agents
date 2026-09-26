# M008/S02 — abide/JEV evidence for the changed files

- PR: #128 (`gsd/m008-s02-chrome`), head at evidence time `2ea7578`
- Review finding addressed: *"the JEV/abide report for the changed files is
  missing/unverifiable"* — this file makes that report inspectable and reproducible.
- Rubric: `.abide/rubric.json` (10 `when: edit` rules; 3 further rules are lint-enforced
  and 3 are unenforceable — see `abide report`).

## How the evidence was produced

The rubric's code-shape rules are `when: "edit"` — abide/JEV judges a **diff**, which is
how the hook enforces them per edit (AGENTS.md, "abide/JEV tier"). The PR's diff was
reproduced as uncommitted changes and judged with that same lens:

```bash
# from any clean checkout of this repo (needs the abide CLI + a configured JEV key)
git checkout --detach origin/main
git checkout origin/gsd/m008-s02-chrome -- \
  src/RoomCanvas.tsx src/components/KanbanFilterChip.tsx \
  src/components/RoomDevChrome.tsx src/components/RoomStage.tsx \
  src/hooks/useRoomHud.ts tests/components.test.ts
abide check --json
```

The command above is the exact one used. The raw output is committed verbatim as
`.abide/reports/m008-s02-abide-check.json`; its `root` field names the temporary git
worktree used for isolation (the primary checkout had unrelated uncommitted edits in
flight at evidence time). No verdict data was altered.

## Result — 37 checks, 0 blocked, 0 act-band

| changed file | rules judged | max probability | max band |
| --- | --- | --- | --- |
| `src/RoomCanvas.tsx` | 9 | 0.16 | clear |
| `src/components/KanbanFilterChip.tsx` | 8 | 0.03 | clear |
| `src/components/RoomDevChrome.tsx` | 8 | 0.05 | clear |
| `src/components/RoomStage.tsx` | 8 | 0.05 | clear |
| `src/hooks/useRoomHud.ts` | 2 | 0.03 | clear |
| `tests/components.test.ts` | 2 | 0.04 | clear |

Within the patch: D021's `no-app-logic-in-components` on `src/RoomCanvas.tsx` is
**0.28 (clear)** and AGENTS.md's `no-frame-allocations` on the same diff is
**0.19 (clear)** — the extraction moved logic out of the shell, it did not add any.

## Whole-file audit context (not a regression)

`abide audit` judges a whole file *"as if just written"* — a different lens from the
edit-phase enforcement above. On `src/RoomCanvas.tsx` it still reports the god
component's pre-existing state, identically before and after this slice:

| file | rule | `origin/main` (`ad4f6a0`) | branch (`2ea7578`) |
| --- | --- | --- | --- |
| `src/RoomCanvas.tsx` | `no-app-logic-in-components` | 0.95 act | 0.95 act |
| `src/RoomCanvas.tsx` | `no-frame-allocations` | 0.96 act | 0.96 act |

These whole-file flags are the extraction targets of the remaining M008 slices
(S03 store wiring, S04 convention sweep); they are not introduced by the S02 diff.
Raw whole-file audit output (changed files): `.abide/reports/m008-s02-abide-audit.json`.
