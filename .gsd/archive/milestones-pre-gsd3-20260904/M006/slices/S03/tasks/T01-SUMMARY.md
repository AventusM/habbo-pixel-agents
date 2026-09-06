---
id: T01
parent: S03
milestone: M006
key_files:
  - src/isoWallRenderer.ts
key_decisions:
  - (none)
duration: 
verification_result: mixed
completed_at: 2026-04-10T16:07:19.124Z
blocker_discovered: false
---

# T01: Fixed wall top cap gap by including corner point (index 0) in both left and right cap polygons.

**Fixed wall top cap gap by including corner point (index 0) in both left and right cap polygons.**

## What Happened

Both left and right wall top cap polygons in drawWallPanels() started their outer and inner ceiling edge loops at index 1, skipping index 0 (the corner point). This left a triangular gap between the corner diamond cap and the start of the wall cap, where the gray wall body showed through instead of the white sharedCapTop color. Changed both caps to start at index 0 so the fill covers the full wall top. The overlap with the corner diamond is invisible since both use the same sharedCapTop color.

## Verification

Built with esbuild, served at localhost:8090, zoomed into wall tops at 3x — white cap strip runs continuously on both walls with no gray gap near the corner.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node esbuild.config.mjs` | 0 | ✅ pass | 5400ms |
| 2 | `Visual inspection at 3x zoom confirms continuous white cap on both walls` | -1 | unknown (coerced from string) | 0ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/isoWallRenderer.ts`
