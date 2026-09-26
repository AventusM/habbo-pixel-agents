# M008/S03 — abide/JEV evidence for the changed files

- Slice: S03 (`gsd/m008-s03-store-wiring`), head at evidence time `b3f515f`
  (T06 evidence commit follows; the report judges the slice diff, not this commit).
- Rubric: `.abide/rubric.json` (`when: edit` code-shape rules).
- Raw output: `.abide/reports/m008-s03-abide-check.json` (committed verbatim).

## How the evidence was produced

The rubric's code-shape rules are `when: "edit"` — abide/JEV judges a **diff**, which
is how the hook enforces them per edit (AGENTS.md, "abide/JEV tier"). The slice diff was
reproduced as uncommitted changes in an isolated git worktree off `origin/main` and
judged with that same lens:

```bash
WT=/var/folders/wv/wf2x0t_n065_slt4q22hbvpw0000gn/T/opencode/abide-m008-s03
git worktree add --detach "$WT" origin/main
cp .env "$WT/.env"
git -C "$WT" checkout origin/gsd/m008-s03-store-wiring -- \
  src/LayoutEditorPanel.tsx src/RoomCanvas.tsx src/components/RoomDevChrome.tsx \
  src/hooks/useKanbanFilter.ts src/hooks/useRoomAudio.ts src/hooks/useStoreValue.ts \
  src/state/kanbanStore.ts src/state/uiStore.ts \
  tests/store-wiring.test.ts tests/uiStore.test.ts
( cd "$WT" && abide check --json )
```

The raw output is committed verbatim; its `root` field names that temporary worktree
used for isolation. No verdict data was altered.

## Result — 10 files, 0 act-band, 0 blocked

| changed file | rules judged | max probability | max band |
| --- | --- | --- | --- |
| `src/LayoutEditorPanel.tsx` | 8 | 0.10 | clear |
| `src/RoomCanvas.tsx` | 9 | 0.32 | clear |
| `src/components/RoomDevChrome.tsx` | 8 | 0.07 | clear |
| `src/hooks/useKanbanFilter.ts` | 2 | 0.07 | clear |
| `src/hooks/useRoomAudio.ts` | 2 | 0.05 | clear |
| `src/hooks/useStoreValue.ts` | 2 | 0.05 | clear |
| `src/state/kanbanStore.ts` | 2 | 0.02 | clear |
| `src/state/uiStore.ts` | 2 | 0.04 | clear |
| `tests/store-wiring.test.ts` | 2 | 0.06 | clear |
| `tests/uiStore.test.ts` | 2 | 0.03 | clear |

Required rules, diff lens:

| rule | file | probability | band |
| --- | --- | --- | --- |
| `no-app-logic-in-components` | `src/RoomCanvas.tsx` | 0.32 | clear |
| `no-frame-allocations` | `src/RoomCanvas.tsx` | 0.11 | clear |

## Whole-file `abide audit` caveat

`abide audit` judges a file *as if just written* (whole-file), not the slice diff. Run
against the full `src/RoomCanvas.tsx` it reports `act` for `no-app-logic-in-components`
and `no-frame-allocations` — those are the pre-existing shell bodies M008 is
progressively extracting across S01/S02/S03, not regressions from this slice. The diff
lens above is the enforcement lens (AGENTS.md) and is clear on every rule.

## Parity checklist (hand-off to S04 UAT)

- [ ] Kanban filter chip label cycles All / GSD only / Non-GSD via `KANBAN_FILTER_LABELS` (now store-backed through `useStoreValue`).
- [ ] Dev-mode chrome gate: dev panel stays dead-gated (`false &&`); dev mode read from `uiStore`.
- [ ] Audio readiness path: first click / context menu → `ensureInitialized()` → `uiStore.setAudioReady(true)`; readiness surface reflects it.
- [ ] Room render + spawn/walk/despawn + camera follow unchanged.

## RoomCanvas size

`src/RoomCanvas.tsx`: `origin/main` 1018 lines → slice head 1036 lines (+18, of which
+15 is the T04-mandated "frame-path refs intentionally kept" rationale block). The store
wiring itself removed a React-state mirror (`devMode`); no store-value mirror remains.
