# S03: Wall Top Cap Corner Gap Fix

**Goal:** Fix the wall top cap not extending to the corner — both left and right wall caps skipped bottomPoints[0], leaving a triangular gray gap near the back corner.
**Demo:** Wall top white cap strip runs continuously from corner to wall end on both sides — no gray gap near the back corner

## Must-Haves

- White cap strip runs continuously from corner to wall end on both walls with no gray gap.

## Proof Level

- This slice proves: Not provided.

## Integration Closure

Not provided.

## Verification

- Not provided.

## Tasks

- [x] **T01: Fix wall top cap index to include corner point** `est:5min`
  Change both left and right wall top cap polygon drawing from starting at bottomPoints[1]/floorEdgePoints[1] to bottomPoints[0]/floorEdgePoints[0] so the sharedCapTop fill covers the full wall top including the corner segment.
  - Files: `src/isoWallRenderer.ts`
  - Verify: Build succeeds, visual inspection shows continuous white cap strip on both walls.

## Files Likely Touched

- src/isoWallRenderer.ts
