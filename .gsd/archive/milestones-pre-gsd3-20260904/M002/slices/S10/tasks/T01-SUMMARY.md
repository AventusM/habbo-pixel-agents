---
id: T01
parent: S10
milestone: M002
provides: []
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 
verification_result: passed
completed_at: 
blocker_discovered: false
---
# T01: 17-bugfixes-and-wishlist 01

**# Phase 17 Plan 01: In Progress Notes Single-Wall Constraint Summary**

## What Happened

# Phase 17 Plan 01: In Progress Notes Single-Wall Constraint Summary

Confined In Progress sticky notes to the left wall only, removing cross-wall overflow that visually broke the spatial metaphor where right wall = completed work.

## What Was Built

The `drawKanbanNotes` function in `src/isoKanbanRenderer.ts` previously distributed In Progress cards across both the left and right walls when the left wall ran out of tile slots. This fix removes the right-wall overflow loop entirely and constrains all small In Progress notes to the left wall.

## Changes Made

### src/isoKanbanRenderer.ts

- Removed `rightSmallTiles` variable declaration (was `rightEdge` filtered to exclude mid tile)
- Changed `smallCapacity` from `(leftSmallTiles.length + rightSmallTiles.length) * 2` to `leftSmallTiles.length * 2`
- Removed the entire `for (const { tx, ty } of rightSmallTiles)` loop that drew In Progress notes on the right wall
- Retained `hasRightLarge` (still used by the Done note drawing logic above the small-notes section); suppressed unused-variable lint warning with `void hasRightLarge`

### tests/isoKanbanRenderer.test.ts

- Updated `respects capacity limit for In Progress notes on tiny grid`: changed expected count from 8 to 4 (2x2 grid: 2 left tiles × 2 slots = 4, right wall no longer used)
- Added new test `never places In Progress notes on the right wall`: provides 20 In Progress cards on a 5x5 grid and asserts all small hit areas have `wallSide: 'left'`, with zero right-wall small notes

## Verification

- `npx vitest run tests/isoKanbanRenderer.test.ts` — 16 tests pass (including updated + new test)
- `npx vitest run` — 277 tests pass, no regressions across all 19 test files
- Grep confirms `rightSmallTiles` has zero matches in `src/isoKanbanRenderer.ts`
- Grep confirms `leftSmallTiles.length * 2` is the sole capacity formula

## Deviations from Plan

None — plan executed exactly as written. The `void hasRightLarge` suppression was a minor implementation detail not explicitly in the plan but required to keep the variable (which the Done note logic relies on) without a lint warning.

## Self-Check: PASSED

- `src/isoKanbanRenderer.ts` — modified and verified
- `tests/isoKanbanRenderer.test.ts` — modified with updated + new test
- Commit `f30346e` — fix(17-01): constrain In Progress notes to left wall only
- All 277 tests pass
