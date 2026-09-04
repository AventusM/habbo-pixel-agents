---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T01: Fix wall top cap index to include corner point

Change both left and right wall top cap polygon drawing from starting at bottomPoints[1]/floorEdgePoints[1] to bottomPoints[0]/floorEdgePoints[0] so the sharedCapTop fill covers the full wall top including the corner segment.

## Inputs

- `src/isoWallRenderer.ts`

## Expected Output

- `src/isoWallRenderer.ts (modified)`

## Verification

Build succeeds, visual inspection shows continuous white cap strip on both walls.
