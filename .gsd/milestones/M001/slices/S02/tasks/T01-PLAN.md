# T01: 02-static-room-rendering 01

**Slice:** S02 — **Milestone:** M001

## Description

Define the pure data types and logic functions that the tile renderer (Plan 02) and React component (Plan 03) depend on. This is a TDD plan — tests are written first, then implementation, RED-GREEN-REFACTOR.

Purpose: Establish a typed contract for the tile grid and rendering pipeline before any canvas code is written. Tests run in the Node environment (no DOM), confirming these modules are renderer-independent.

Output: `src/isoTypes.ts` with all shared types and pure logic; passing unit tests covering all cases needed by ROOM-02, ROOM-03, ROOM-04, ROOM-06, ROOM-07.

## Must-Haves

- [ ] "Any Habbo heightmap string (digits 0-9 and x/X, newline-separated) is parsed into a typed 2D grid of tile heights and null void markers"
- [ ] "HSB colours from the layout editor are converted to HSL and produce three distinct fill strings (top/left/right) with the correct brightness offsets"
- [ ] "Depth sort returns renderables in ascending tileX+tileY+tileZ*0.001 order, back-to-front, with no Z-fighting for stair tiles"
- [ ] "Void tiles (x/X) produce null entries in the grid — no tile height is assigned"
- [ ] "All logic passes unit tests in Node environment with zero DOM imports"

## Files

- `src/isoTypes.ts`
- `tests/isoTypes.test.ts`
