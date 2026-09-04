---
id: S12
parent: M004
milestone: M004
provides:
  - Floor slab depth and visible wall ledges for the Habbo room renderer
requires:
  - slice: S01
    provides: Shared standalone room renderer and room geometry pipeline
affects: []
key_files:
  - src/isometricMath.ts
  - src/isoTileRenderer.ts
  - src/isoWallRenderer.ts
key_decisions:
  - Floor slab depth uses tileColors() shades so per-tile HSB overrides carry through the new faces
  - Wall panels stay behind the floor, but visible wall ledges render after the floor pass so thickness remains readable
patterns_established:
  - Static room geometry can use a two-pass wall render: continuous panels before floors, ledges and borders after the floor draw
observability_surfaces:
  - Browser room rendering at http://localhost:3000
  - tests/isometricMath.test.ts, tests/isoTileRenderer.test.ts, tests/isoWallRenderer.test.ts
  - node esbuild.config.mjs && node esbuild.config.mjs web
  - npx vitest run
drill_down_paths: []
duration: 1 slice session
verification_result: passed
completed_at: 2026-03-23
---

# S12: Floor & Wall Thickness for Habbo-Authentic Room Depth

**The room floor now reads as a slab and the perimeter walls end in visible ledges, giving the Habbo room real depth instead of paper-flat surfaces.**

## What Happened

S12 added `FLOOR_THICKNESS = 6` in `src/isometricMath.ts` and used it in `drawFloorTile()` to extrude the two front-facing side faces from each floor diamond using the existing `tileColors()` left and right shades. That kept section color overrides flowing through the new slab faces instead of introducing a separate palette path.

Wall thickness took a few corrective passes before it looked right. The first pass added visible front faces, but the ledges were partially hidden by the floor plane. Follow-up fixes moved wall-edge rendering into a second pass after the depth-sorted floor draw, stretched the ledges to the full wall length, added ceiling border lines, and offset the ledges inward toward the room so they stayed visible instead of collapsing behind the floor.

The final state keeps large wall panels behind the room while drawing only the visible ledge and border geometry on top, which matches the classic Habbo read much better in the browser.

## Verification

- `node esbuild.config.mjs && node esbuild.config.mjs web` passed on 2026-03-23
- `npx vitest run` passed 442/442 on 2026-03-23
- Browser verification at `http://localhost:3000` showed darker slab faces along the front floor edge and visible wall ledges plus ceiling lines on both perimeter walls

## Requirements Advanced

- ROOM-03 — floor shading now exposes visible front slab faces while preserving the existing three-tone Habbo palette
- ROOM-05 — perimeter walls now terminate with visible front-face ledges and border lines instead of ending as flat panels

## Requirements Validated

- ROOM-03 — browser zoom verification showed the front floor edge rendering with darker side faces on live room output
- ROOM-05 — browser zoom verification showed left and right wall ledges remaining visible after the post-floor edge pass

## New Requirements Surfaced

- none

## Requirements Invalidated or Re-scoped

- none

## Deviations

The written plan assumed a thin wall thickness strip would be enough. In practice the ledges disappeared behind the floor until wall-edge rendering moved into a post-floor pass, extended across the full wall length, and shifted inward toward the room.

## Known Limitations

- Slab depth and wall ledge depth are fixed constants rather than theme-specific tuning values
- Visual proof is browser-based; there are no pixel-golden tests for the slab and ledge geometry

## Follow-ups

- If room themes diverge later, expose slab and wall thickness as renderer tuning constants instead of keeping them fully hardcoded inside the wall renderer
- Consider focused visual regression captures if room geometry keeps changing slice to slice

## Files Created/Modified

- `src/isometricMath.ts` — added shared `FLOOR_THICKNESS` constant for room geometry
- `src/isoTileRenderer.ts` — draws floor slab side faces and runs the wall-edge pass after floor tiles
- `src/isoWallRenderer.ts` — renders full-length wall ledges, ceiling lines, and inward-offset wall thickness geometry

## Forward Intelligence

### What the next slice should know
- Wall thickness only reads correctly because the room is rendered in two passes: wall panels before floors, wall ledges after floors

### What's fragile
- `src/isoWallRenderer.ts` edge polygons depend on the traced outer-edge tile lists, so irregular room perimeters or future wall-layout changes should be checked visually

### Authoritative diagnostics
- Zoomed browser screenshots of the front floor edge and back-corner wall at `http://localhost:3000` — fastest truth for whether slab and ledge geometry still read correctly

### What assumptions changed
- "A thin strip at the wall-floor junction is enough" — the strip was not reliably visible until it moved to a post-floor render pass and was offset inward
