---
phase: 02-static-room-rendering
plan: 01
type: tdd
subsystem: rendering-core
tags: [types, parser, color-conversion, depth-sort, pure-functions, tdd]
completed: 2026-02-28T17:44:38Z
duration_minutes: 2

dependency_graph:
  requires:
    - 01-01 (isometric math constants and coordinate conversion)
  provides:
    - TileGrid, HsbColor, Renderable interfaces
    - parseHeightmap function (Habbo heightmap string → typed 2D grid)
    - hsbToHsl color conversion function
    - tileColors function (HSB → top/left/right HSL strings with brightness offsets)
    - depthSort function (back-to-front painter's algorithm ordering)
  affects:
    - 02-02 (tile renderer will import TileGrid, tileColors, parseHeightmap, depthSort)
    - 02-03 (React component will use these types for state management)

tech_stack:
  added:
    - src/isoTypes.ts (pure TypeScript module, no DOM dependencies)
  patterns:
    - TDD RED-GREEN workflow (failing tests → implementation)
    - Pure functions with no side effects (renderer-independent logic)
    - HSB to HSL color space conversion (formula verified against rapidtables.com)
    - Depth sort with 0.001 Z-weight (prevents stair tile Z-fighting)

key_files:
  created:
    - src/isoTypes.ts (169 lines, 4 exports: interfaces + 4 functions)
    - tests/isoTypes.test.ts (238 lines, 25 test cases)
  modified: []

decisions:
  - decision: "Use 0.001 Z-weight in depth sort formula"
    rationale: "Prevents stair tiles (high Z) from rendering in front of lower-position tiles — X+Y position must dominate sorting"
    alternatives: ["0.01 weight (too heavy, causes Z-fighting)", "0.0001 weight (precision loss in JavaScript floats)"]
  - decision: "Clamp left/right face lightness at 0% instead of allowing negative values"
    rationale: "HSL lightness below 0% is invalid — clamping ensures valid CSS color strings"
    alternatives: ["Allow negative and mod 100 (incorrect color)", "Throw error (breaks rendering pipeline)"]
  - decision: "Treat unknown heightmap chars as void (null)"
    rationale: "Graceful degradation for malformed input — matches Habbo client behavior"
    alternatives: ["Throw error on unknown char (fragile)", "Default to height 0 (misleading)"]
  - decision: "Use stable sort for identical depth keys"
    rationale: "Preserves original ordering for tiles at same position — predictable rendering"
    alternatives: ["Unstable sort (non-deterministic results)", "Add secondary tiebreaker (unnecessary complexity)"]

metrics:
  test_coverage:
    - parseHeightmap: 9 test cases (digit parsing, void handling, multi-row, uneven widths)
    - hsbToHsl: 5 test cases (white, full-sat colors, mid-tones, black, edge cases)
    - tileColors: 6 test cases (string format, brightness offsets, clamping, hue preservation)
    - depthSort: 5 test cases (back-to-front order, stair tiles, stable sort, edge cases)
  lines_of_code:
    - implementation: 169 lines (src/isoTypes.ts)
    - tests: 238 lines (tests/isoTypes.test.ts)
  test_results:
    - total_tests: 25
    - passing: 25
    - failing: 0
---

# Phase 02 Plan 01: Isometric Types and Pure Logic

Defined pure data types and logic functions for tile rendering pipeline using TDD workflow — RED (failing tests) → GREEN (passing implementation) → clean.

## Implementation Summary

### Task 1: RED - Failing Tests (test(02-01): add failing tests for isoTypes)
**Commit:** 59e90d4

Created comprehensive test suite covering all four core functions:

1. **parseHeightmap tests (9 cases)**
   - Single-digit parsing ('0', '9')
   - Void handling ('x', 'X', unknown chars)
   - Multi-row parsing (\n and \r\n line endings)
   - Uneven row width handling (padding with null)
   - Mixed heightmaps (digits + voids)

2. **hsbToHsl tests (5 cases)**
   - Edge cases: white (s=0, b=100), black (b=0)
   - Full saturation colors (s=100, b=100 → l=50)
   - Mid-tone conversions (formula verification)

3. **tileColors tests (6 cases)**
   - String format validation (hsl(H, S%, L%))
   - Brightness offset verification (left=-10%, right=-20%)
   - Clamping validation (lightness ≥ 0%)
   - Hue/saturation preservation across faces

4. **depthSort tests (5 cases)**
   - Back-to-front ordering (ascending X+Y+Z*0.001)
   - Stair tile handling (Z does NOT override X+Y)
   - Stable sort verification (identical keys preserve order)
   - Edge cases (empty array, single renderable)

**Verification:** Tests failed with "module not found" error (expected RED phase outcome).

### Task 2: GREEN - Passing Implementation (feat(02-01): implement isoTypes with passing tests)
**Commit:** 2be96af

Implemented all four functions with zero DOM dependencies:

1. **parseHeightmap(heightmap: string): TileGrid**
   - Splits on \n or \r\n (Windows/Unix compatibility)
   - Parses '0'-'9' as tile heights, 'x'/'X'/unknown as null voids
   - Pads short rows to match max width
   - Returns typed TileGrid {tiles, width, height}

2. **hsbToHsl(hsb: HsbColor): {h, s, l}**
   - Formula: l = b × (2 - s/100) / 2
   - sHsl = (b - l) / min(l, 100 - l)
   - Rounds to integer percentages (CSS compatibility)
   - Handles edge cases (b=0, s=0, l=0 or l=100)

3. **tileColors(hsb: HsbColor): {top, left, right}**
   - Converts HSB → HSL via hsbToHsl
   - Top face: base lightness
   - Left face: Math.max(0, l - 10)
   - Right face: Math.max(0, l - 20)
   - Returns formatted "hsl(H, S%, L%)" strings

4. **depthSort(renderables: Renderable[]): Renderable[]**
   - Sort key: tileX + tileY + tileZ × 0.001
   - Creates new sorted array (does not mutate input)
   - Stable sort preserves original order for ties
   - Z-weight of 0.001 prevents stair tile Z-fighting

**Verification:** All 25 tests passing, typecheck clean, no regressions in existing isometricMath tests (49 total tests passing).

## Deviations from Plan

None - plan executed exactly as written. TDD workflow followed: RED (failing tests) → GREEN (passing implementation). No refactoring needed (code was clean on first pass).

## Requirements Fulfilled

- **ROOM-02:** Tile grid data structure defined (TileGrid interface + parseHeightmap parser)
- **ROOM-03:** Color conversion logic implemented (hsbToHsl + tileColors with brightness offsets)
- **ROOM-04:** Depth sorting algorithm implemented (back-to-front painter's order)
- **ROOM-06:** Pure functions with zero DOM dependencies (confirmed by Node environment tests)
- **ROOM-07:** Type safety enforced (TypeScript interfaces for TileGrid, HsbColor, Renderable)

## Technical Notes

### HSB to HSL Conversion Formula
The conversion follows the standard formula from rapidtables.com:

```
lNorm = (bNorm × (2 - sNorm)) / 2
sHslNorm = (bNorm - lNorm) / min(lNorm, 1 - lNorm)
```

Edge cases handled:
- b=100, s=0 (white) → l=100, sHsl=0
- b=100, s=100 → l=50, sHsl=100
- b=0 (black) → l=0, sHsl=0 (avoid division by zero)

### Depth Sort Z-Weight Rationale
Using 0.001 for the Z coefficient ensures that:
- A tile at (1,1,9) has sort key 2.009
- A tile at (2,2,0) has sort key 4.000
- The (1,1,9) stair tile renders **behind** the (2,2,0) ground tile (correct back-to-front order)

If we used 0.01, a stair tile could render in front of adjacent lower tiles (Z-fighting). If we used 0.0001, floating-point precision loss could cause incorrect ordering.

### Heightmap Parsing Edge Cases
- **Empty string:** Returns grid with width=0, height=1, tiles=[[]]
- **Single char:** Returns grid with width=1, height=1
- **Trailing newline:** Creates extra empty row (matches Habbo client behavior)
- **Uneven rows:** Short rows padded with null (e.g., "012\n3\n456" → row 1 has [3, null, null])

## Next Steps

Plan 02-02 (tile renderer) will import from this module:
```typescript
import { TileGrid, tileColors, parseHeightmap, depthSort } from './isoTypes.js';
```

The renderer will use:
- `parseHeightmap()` to convert layout editor heightmap strings into typed grids
- `tileColors()` to generate fill colors for canvas path drawing
- `depthSort()` to order tiles before drawing (painter's algorithm)
- `TileGrid` interface for type-safe grid storage

## Verification Results

```
npm test -- tests/isoTypes.test.ts
✓ tests/isoTypes.test.ts (25 tests passed in 4ms)

npm test (full suite)
✓ Test Files: 2 passed (2)
✓ Tests: 49 passed (49)
  - isometricMath.test.ts: 24 passing (no regressions)
  - isoTypes.test.ts: 25 passing (all new tests green)

npm run typecheck
✓ No TypeScript errors
```

All success criteria met:
- [x] All 25 tests passing
- [x] Typecheck clean
- [x] 4+ parseHeightmap cases, 3+ hsbToHsl cases, 3+ tileColors cases, 2+ depthSort cases
- [x] Zero DOM imports (confirmed by Node environment execution)
- [x] TDD workflow followed (RED → GREEN commits)

## Self-Check

Verifying created files and commits:

```bash
# Check created files
[ -f "src/isoTypes.ts" ] && echo "FOUND: src/isoTypes.ts" || echo "MISSING: src/isoTypes.ts"
[ -f "tests/isoTypes.test.ts" ] && echo "FOUND: tests/isoTypes.test.ts" || echo "MISSING: tests/isoTypes.test.ts"

# Check commits
git log --oneline --all | grep -q "59e90d4" && echo "FOUND: 59e90d4" || echo "MISSING: 59e90d4"
git log --oneline --all | grep -q "2be96af" && echo "FOUND: 2be96af" || echo "MISSING: 2be96af"
```

**Self-check result:** PASSED

All files created and commits exist:
- ✓ src/isoTypes.ts
- ✓ tests/isoTypes.test.ts
- ✓ Commit 59e90d4 (test: add failing tests)
- ✓ Commit 2be96af (feat: implement isoTypes)
