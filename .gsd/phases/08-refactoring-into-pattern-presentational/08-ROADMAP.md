# M008: Refactoring into pattern: presentational-container extraction of the room shell (D021 convention)

**Vision:** Refactor the room shell to the selected patterns.dev convention (presentational-container-pattern in its hooks-first form, D021): RoomCanvas.tsx becomes a thin orchestrator; application logic (audio, avatar/teleport lifecycles, camera follow, store wiring) moves into custom hooks, containers, or src/state stores; UI chrome becomes presentational components that receive props and render. Every slice is enforced per-edit by abide/JEV rule no-app-logic-in-components, so the convention holds while the refactor is in flight.

## Success Criteria

- RoomCanvas.tsx is a thin orchestrator (target under ~400 lines) composed of custom hooks + presentational components; no application logic inline in components.
- abide/JEV reports zero act verdicts for no-app-logic-in-components on the milestone's changed files (enforced per edit throughout).
- Behavior parity: vitest suite + tsc + build green; UAT checklist (spawn/walk/despawn, camera follow, kanban filter, editor mode) passes.
- No new dependencies; frame path stays allocation-free (no-frame-allocations clear).

## Slices

- [ ] **S02: Presentational split of room chrome** `risk:low` `depends:[S01]`
  > After this: Same visuals; chrome components in their own files, no store imports — props in, JSX out.

- [ ] **S03: Complete store wiring: remove mirrored and ref state** `risk:medium` `depends:[S01]`
  > After this: Single source of truth per value; no setX mirrors of store data in the shell; behavior unchanged.

- [ ] **S04: Convention sweep, UAT + closeout** `risk:low` `depends:[S02,S03]`
  > After this: Green gate matrix + signed UAT checklist; abide report shows no act verdicts; milestone validated.

## Boundary Map

In scope: src/RoomCanvas.tsx, new src/hooks/*, presentational components extracted from the shell, shell store wiring. Out of scope: renderer internals (src/iso*Renderer*.ts, src/render/*), asset pipeline, integrations clients, agent provisioning; no visual redesign; no frame-path changes beyond preserving the allocation-free invariant.
<!-- gsd:state-version=111:0 -->
