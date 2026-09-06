# M003: Refactor: Architecture Map, Failure-Mode Hardening, Render Layers, State Store

**Vision:** Make the current architecture visible, harden the places that demonstrably go wrong, and formalize the patterns that emerged ad hoc during feature work. Deliver an honest architecture map (module graph, data flow, render pipeline, event flow) as living docs; extract the canvas/asset/bootstrap concerns out of the 1,882-line RoomCanvas; turn the ad-hoc render-layer caches into an explicit layer pipeline; consolidate app state (agents, cards, camera, demo-vs-live) behind a typed store with explicit invalidation. Keep the room pixel-perfect and fast throughout (536-test suite + visual UAT as guardrails).

## Success Criteria

- Living architecture docs (generated module graph + hand-annotated data flow, render pipeline, event lifecycle, asset pipeline) committed and regenerable
- Failure-mode inventory: every known incident mapped to root cause, guard, and residual risk
- Single asset-bootstrap for web + extension; typed event bus with startup replay; degraded states visible in UI
- CanvasStage + WorldLayer pipeline extracted from RoomCanvas; module-level renderer state eliminated
- Typed app-state store with explicit demo/live mode machine; WS reconnect regression-tested
- Suite green throughout; pan/zoom/idle render cadence not regressed (measured)

## Slices

- [ ] **S01: Architecture visualization + honest current-state map** `risk:low` `depends:[]`
  > After this: docs/architecture/ with mermaid diagrams (module graph generated via madge, hand-annotated data-flow + render-pipeline + event-lifecycle diagrams), plus a documented failure-mode inventory with the concrete incidents that demonstrated each (canvas sizing races, demo event lost pre-listener, silent fallbacks, typecheck .tsx gap).

- [ ] **S02: Failure-mode hardening: bootstrap, event bus, surfaced degradation** `risk:medium` `depends:[S01]`
  > After this: Demo page with the network tab throttled: no lost cards; a degraded board fetch shows a visible indicator; both loaders share one bootstrap module (diff shows deletion of duplicated code).

- [ ] **S03: Render layer pipeline: formalize room, notes, and dynamic layers** `risk:medium` `depends:[S01]`
  > After this: CanvasStage owns canvas+layers; RoomCanvas shrank by the extracted code; pan/zoom/walk performance not worse (measured render cadence); behavior identical.

- [ ] **S04: Typed app-state store: agents, cards, camera, mode** `risk:medium` `depends:[S03]`
  > After this: WS drop + reconnect: agents clear/repopulate via store transitions; demo fallback triggers via an explicit mode transition; kanban filter/notes invalidation flows through store subscriptions.

## Boundary Map

| In scope | Out of scope |
|---|---|
| RoomCanvas decomposition (CanvasStage, layer pipeline) | Avatar builder UI (separate follow-up) |
| Shared asset bootstrap + typed event bus + replay | New features on the room (visual changes) |
| Typed app-state store (agents/cards/mode/camera) | Changing asset formats or the RD/PixelLab pipelines |
| Failure-mode inventory + degraded-state surfacing | Rewriting renderers (draw functions stay, signatures may widen) |
<!-- gsd:state-version=5:0 -->
