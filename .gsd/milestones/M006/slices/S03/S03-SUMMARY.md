---
id: S03
parent: M006
milestone: M006
provides:
  - (none)
requires:
  []
affects:
  []
key_files:
  - ["src/isoWallRenderer.ts"]
key_decisions:
  - (none)
patterns_established:
  - (none)
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-04-10T16:07:32.360Z
blocker_discovered: false
---

# S03: Wall Top Cap Corner Gap Fix

**Fixed wall top cap gap near corner by including index 0 in both left and right cap polygons.**

## What Happened

The white cap strip (sharedCapTop) at the top of both walls had a triangular gap near the back corner. Both left and right wall cap polygon loops started at bottomPoints[1], skipping the corner point at index 0. The corner diamond cap only covered a small area at the apex, leaving the diagonal segment from corner to first tile uncovered. Fixed by starting both cap loops at index 0. The overlap with the corner diamond is invisible since both use the same color.

## Verification

Built and visually inspected at 3x zoom — continuous white cap on both walls, no gray gap.

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

None.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

- `src/isoWallRenderer.ts` — Changed left and right wall top cap polygons to start at index 0 instead of 1, filling the corner gap
