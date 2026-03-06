---
phase: 11-chair-layer-splitting
plan: 01
subsystem: furniture-rendering
tags: [depth-sort, chair, layer-splitting, renderable]
dependency_graph:
  requires: []
  provides: [createNitroChairRenderables]
  affects: [isoFurnitureRenderer, isoTileRenderer]
tech_stack:
  added: []
  patterns: [layer-z-partition, depth-bias-split, renderable-array]
key_files:
  created: []
  modified:
    - src/isoFurnitureRenderer.ts
    - src/isoTileRenderer.ts
    - tests/isoFurnitureRenderer.test.ts
decisions:
  - "Chair layer split threshold is z>0 (strict positive), matching hc_chr metadata convention"
  - "Backrest depth bias +0.8 chosen to exceed avatar +0.6 bias while staying within single tile"
  - "Fallback delegates to createNitroFurnitureRenderable when no backrest layers found"
  - "club_sofa excluded from split path — it is multi-tile furniture routed through multiTileFurniture loop"
metrics:
  duration: 3min
  completed: "2026-03-05"
  tasks: 2
  files: 3
---

# Phase 11 Plan 01: Chair Layer Splitting Summary

**One-liner:** Chair furniture split into seat (z<=0) and backrest (z>0) renderables using Nitro z-values, with +0.8 depth bias ensuring backrest renders in front of sitting avatar.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add createNitroChairRenderables function and unit tests | 3370573 | src/isoFurnitureRenderer.ts, tests/isoFurnitureRenderer.test.ts |
| 2 | Wire createNitroChairRenderables into createFurnitureRenderables call site | 431c9a6 | src/isoTileRenderer.ts |

## What Was Built

`createNitroChairRenderables` in `src/isoFurnitureRenderer.ts`:
- Reads per-direction z-values from Nitro visualization metadata via `getLayerZValues`
- Partitions layers into seat group (z<=0) and backrest group (z>0)
- Seat renderable: `tileX: spec.tileX` — sorts behind the sitting avatar (depth X+Y)
- Backrest renderable: `tileX: spec.tileX + 0.8` — sorts in front (depth X+Y+0.8, past avatar's +0.6 bias)
- Fallback: when no backrest layers (dir 2, dir 4, single-layer chairs), delegates to `createNitroFurnitureRenderable` and returns 1 renderable

`createFurnitureRenderables` in `src/isoTileRenderer.ts`:
- Added `isChairType` gate for single-tile furniture
- Chair-type furniture routes through `createNitroChairRenderables`; each returned renderable receives the camera-origin translate wrap
- Non-chair furniture path completely unchanged
- Multi-tile furniture path (club_sofa) completely unchanged

## Verification

- `npx vitest run tests/isoFurnitureRenderer.test.ts` — 39 tests pass (30 existing + 9 new)
- `npx vitest run` — 249 tests pass across 16 test files, no regressions

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files confirmed present:
- FOUND: src/isoFurnitureRenderer.ts (createNitroChairRenderables exported)
- FOUND: src/isoTileRenderer.ts (isChairType gate added)
- FOUND: tests/isoFurnitureRenderer.test.ts (9 new tests)

Commits confirmed:
- FOUND: 3370573
- FOUND: 431c9a6
