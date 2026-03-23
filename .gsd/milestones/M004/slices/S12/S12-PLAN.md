# S12: Floor & Wall Thickness for Habbo-Authentic Room Depth

**Goal:** Floor tiles and walls have visible thickness/depth — floor tiles show darker side faces along their front edges (like a slab), and walls show edge depth where they meet the floor, matching the classic Habbo room look.
**Demo:** Opening localhost:3000 shows the room with floor tiles that have a visible 4-6px thick edge along the bottom-left and bottom-right faces, and walls with a visible front edge strip where they terminate, giving the room a constructed 3D feel instead of paper-flat surfaces.

## Must-Haves

- Floor tiles render with left and right side faces (darker shades) along front-facing edges, ~4-6px depth
- The floor depth uses the existing `tileColors()` left/right shades for visual consistency
- Walls show a visible edge/thickness where they meet the floor
- No regressions to existing tile rendering, furniture depth sorting, or avatar positioning
- Section color overrides (`tileColorMap`) continue to work with the new floor depth

## Proof Level

- This slice proves: integration
- Real runtime required: yes (visual verification in browser)
- Human/UAT required: yes (compare against Habbo reference screenshot)

## Verification

- Build passes: `node esbuild.config.mjs && node esbuild.config.mjs web`
- All existing tests pass: `npx vitest run`
- Visual: floor tiles in localhost:3000 show darker side faces along bottom edges
- Visual: room no longer looks paper-flat — clear 3D depth on floor and walls

## Observability / Diagnostics

- Runtime signals: none (purely visual change)
- Inspection surfaces: browser canvas — zoom in to verify side face pixel alignment
- Failure visibility: visual regression — tiles look broken or furniture floats

## Tasks

- [x] **T01: Add floor tile side faces (slab depth)** `est:45m`
  - Why: Floor tiles are currently flat rhombuses with no visible thickness. Habbo floors have a visible edge — darker left and right parallelogram faces hanging below the front edges of each tile, typically 4-6px deep.
  - Files: `src/isoTileRenderer.ts`, `src/isometricMath.ts`
  - Do:
    - Add a `FLOOR_THICKNESS` constant (~6px) to `isometricMath.ts`
    - In `drawFloorTile()`, after drawing the top face and border, draw the left face (bottom-left edge to bottom vertex) and right face (bottom vertex to bottom-right edge) as parallelograms extending `FLOOR_THICKNESS` pixels downward
    - Use `tileColors(hsb).left` for the left face and `tileColors(hsb).right` for the right face — same shading as wall faces
    - Only draw the front-facing side faces (left and right from the camera's perspective — the bottom-left and bottom-right edges of the rhombus)
    - Ensure per-tile color overrides from `tileColorMap` apply to the side faces too
  - Verify: `npx vitest run` — all existing tests pass; visually verify in browser that tiles have depth
  - Done when: Floor tiles show visible darker side faces along their front edges

- [x] **T02: Add wall edge thickness** `est:30m`
  - Why: Walls currently terminate as flat panels where they meet the floor. Habbo walls have a visible front edge strip showing their depth, making them look like real walls rather than wallpaper.
  - Files: `src/isoWallRenderer.ts`
  - Do:
    - At the bottom edge of each wall panel where it meets the floor, draw a thin strip (2-4px) in the darker wall shade to represent the wall's front face/thickness
    - This applies to both left-wall and right-wall panels
    - Use the `right` shade from `tileColors()` for the wall edge (darkest shade)
  - Verify: `npx vitest run` — all tests pass; visually verify walls have visible edge depth
  - Done when: Walls show a visible thickness strip where they terminate at the floor

## Files Likely Touched

- `src/isoTileRenderer.ts`
- `src/isometricMath.ts`
- `src/isoWallRenderer.ts`
