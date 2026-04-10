---
estimated_steps: 4
estimated_files: 1
skills_used: []
---

# T01: Desaturate wall colors, remove stripes, fix baseboard

In isoWallRenderer.ts:
1. Strip saturation (s: 0) from wall HSB in drawWallPanels, drawWallEdges, and corner post
2. Remove drawWallPanelLines calls for both walls
3. Change baseboard fillStyle from capTop to base on both walls

## Inputs

- `src/isoWallRenderer.ts`

## Expected Output

- `src/isoWallRenderer.ts (modified)`

## Verification

Visual inspection: walls are flat neutral gray, no stripes, no baseboard highlight
