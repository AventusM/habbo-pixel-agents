# S01: Neutral gray walls — remove color, stripes, and baseboard highlight

**Goal:** Make walls neutral gray, remove panel stripe pattern, and eliminate baseboard color mismatch
**Demo:** Room renders with clean flat gray walls, no blue tint, no stripes, no white baseboard line

## Must-Haves

- Not provided.

## Proof Level

- This slice proves: Not provided.

## Integration Closure

Not provided.

## Verification

- Not provided.

## Tasks

- [x] **T01: Desaturate wall colors, remove stripes, fix baseboard** `est:15min`
  In isoWallRenderer.ts:
1. Strip saturation (s: 0) from wall HSB in drawWallPanels, drawWallEdges, and corner post
2. Remove drawWallPanelLines calls for both walls
3. Change baseboard fillStyle from capTop to base on both walls
  - Files: `src/isoWallRenderer.ts`
  - Verify: Visual inspection: walls are flat neutral gray, no stripes, no baseboard highlight

## Files Likely Touched

- src/isoWallRenderer.ts
