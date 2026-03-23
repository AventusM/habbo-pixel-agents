# S13: Wall 3D Depth — Panel Lines and Shading

**Goal:** Room walls look like constructed 3D surfaces instead of flat solid fills. Horizontal panel lines and subtle shading give them the same depth quality the floor already has.
**Demo:** Opening localhost:3000 shows walls with visible horizontal panel lines and a subtle top-to-bottom gradient, matching the classic Habbo wall aesthetic.

## Must-Haves

- Both left and right walls render with evenly-spaced horizontal panel lines following isometric perspective
- Panel lines use a slightly darker shade of the wall base color (not a separate color — derived from the same HSB)
- No regressions to existing wall ledges, ceiling borders, floor rendering, or furniture depth sorting
- Section color overrides (`tileColorMap`) continue to propagate to wall shading

## Proof Level

- This slice proves: integration
- Real runtime required: yes (visual verification in browser)
- Human/UAT required: yes (visual comparison)

## Verification

- Build passes: `node esbuild.config.mjs && node esbuild.config.mjs web`
- All existing tests pass: `npx vitest run`
- Visual: walls at localhost:3000 show panel lines and no longer look paper-flat

## Tasks

- [ ] **T01: Add horizontal panel lines and shading to wall panels** `est:45m`
  - Why: Walls are currently single flat-fill polygons with no visual depth cues
  - Files: `src/isoWallRenderer.ts`
  - Do:
    - In `drawWallPanels()`, after filling each wall polygon, draw evenly-spaced horizontal panel lines that follow the isometric wall angle
    - Lines should be a slightly darker shade of the wall's base color (2-4% lightness reduction)
    - Spacing should be ~16-20px (roughly half a tile height) for visual consistency with the tile grid
    - Lines follow the wall's isometric slope (not straight horizontal — they're parallelogram stripes)
  - Verify: `npx vitest run` passes; visual verification in browser
  - Done when: Both walls show visible panel lines that give depth

## Files Likely Touched

- `src/isoWallRenderer.ts`
