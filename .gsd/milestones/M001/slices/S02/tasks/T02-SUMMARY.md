---
id: T02
parent: S02
milestone: M001
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
completed_at: 2026-02-28T17:51:06Z
blocker_discovered: false
---
# T02: 02-static-room-rendering 02

**# Phase 02 Plan 02: Tile Renderer**

## What Happened

# Phase 02 Plan 02: Tile Renderer

Canvas drawing module with HiDPI support, depth-sorted rendering, and wall strip edge detection — pure functions ready for React integration in Plan 03.

## Implementation Summary

### Task 1: Implement isoTileRenderer.ts (feat(02-02): implement canvas drawing module)
**Commit:** 4022ffb

Created pure TypeScript canvas drawing module with zero React/DOM imports.

**Exports:**

1. **WALL_HEIGHT constant (128px)**
   - 4 × TILE_H (4 × 32px)
   - Wall strips hang below tile edges by this amount

2. **initCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D**
   - Reads `window.devicePixelRatio || 1`
   - Sets `canvas.width/height` to `offsetWidth/offsetHeight * dpr` (physical pixels)
   - Sets `canvas.style.width/height` to preserve CSS size
   - Calls `ctx.scale(dpr, dpr)` for HiDPI scaling
   - Sets `ctx.imageSmoothingEnabled = false` for pixel-crisp rendering
   - Returns initialized context

3. **computeCameraOrigin(grid, canvasCssWidth, canvasCssHeight): {x, y}**
   - Iterates all non-void tiles
   - Computes bounding box via `tileToScreen(tx, ty, 0)` for each
   - Tracks `minSx` (sx - TILE_W_HALF), `maxSx` (sx + TILE_W_HALF), `minSy` (sy), `maxSy` (sy + TILE_H)
   - Adds WALL_HEIGHT to room height (for tallest wall)
   - Returns centered offset: `{x: floor((canvasW - roomW) / 2) - minSx, y: floor((canvasH - roomH) / 2) - minSy}`
   - Returns `{0, 0}` if grid has no non-void tiles

4. **preRenderRoom(grid, cameraOrigin, physicalW, physicalH, dpr, defaultHsb?): OffscreenCanvas**
   - Creates `new OffscreenCanvas(physicalW, physicalH)`
   - Gets 2D context, scales by dpr, disables image smoothing
   - Builds `Renderable[]` array (one per non-void tile)
   - Each renderable:
     - Has `tileX=tx, tileY=ty, tileZ=tile.height`
     - Draw function computes screen position via `tileToScreen(tx, ty, tileZ)`, adds camera origin
     - Draws floor tile (top face rhombus)
     - Draws left wall strip if `tx === 0 || grid.tiles[ty][tx - 1] == null`
     - Draws right wall strip if `ty === 0 || grid.tiles[ty - 1]?.[tx] == null`
   - Calls `depthSort(renderables)` for back-to-front order
   - Draws all renderables in sorted order
   - Returns OffscreenCanvas

**Internal helpers (module-private):**

- **drawFloorTile(ctx, sx, sy, hsb)**: Rhombus path with 4 vertices (top, right, bottom, left), fills with `tileColors(hsb).top`
- **drawLeftFace(ctx, sx, sy, hsb)**: Parallelogram hanging below left edge, fills with `tileColors(hsb).left`
- **drawRightFace(ctx, sx, sy, hsb)**: Parallelogram hanging below right edge, fills with `tileColors(hsb).right`

**Verification:** npm run typecheck exits 0, all 4 exports present, zero React/DOM imports.

### Task 2: Smoke-test isoTileRenderer (test(02-02): add smoke tests)
**Commit:** 4ff00f4

Created 9 smoke tests using happy-dom environment for canvas API mocking.

**Tests:**

1. **computeCameraOrigin:**
   - Returns numeric (not NaN) camera origin for 3×3 grid
   - Centers room in 800×600 viewport (positive origin for small room)
   - Returns {0,0} for grid with no non-void tiles

2. **preRenderRoom:**
   - Returns OffscreenCanvas instance with correct dimensions (800×600)
   - Does not throw with void tiles (checkerboard pattern "x0x\n0x0\nx0x")
   - Handles empty grid without crashing

3. **depthSort:**
   - Sorts renderables in back-to-front order (sort key: tileX + tileY + tileZ × 0.001)
   - Handles empty array
   - Handles single renderable

**Testing infrastructure:**

- Installed happy-dom (lighter, faster, better ESM support than jsdom)
- Created tests/setup.ts with minimal OffscreenCanvas mock (no-op canvas methods)
- Updated vitest.config.ts to include setupFiles
- Used `// @vitest-environment happy-dom` directive in test file

**Verification:** All 58 tests passing (24 isometricMath + 25 isoTypes + 9 isoTileRenderer), typecheck clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] jsdom ESM/CommonJS compatibility error**
- **Found during:** Task 2 test setup
- **Issue:** jsdom loads CSS parsing libraries (@csstools/css-calc) that have ESM/CommonJS incompatibilities with Vitest, causing "ERR_REQUIRE_ESM" errors
- **Fix:** Replaced jsdom with happy-dom (lighter, faster, better ESM support, actively maintained)
- **Files modified:** package.json, tests/isoTileRenderer.test.ts (environment directive)
- **Commit:** 4ff00f4 (included in Task 2 commit)

**2. [Rule 2 - Missing Critical Functionality] OffscreenCanvas not available in happy-dom**
- **Found during:** Task 2 test execution
- **Issue:** happy-dom does not provide OffscreenCanvas global (Node.js environment limitation)
- **Fix:** Created tests/setup.ts with minimal OffscreenCanvas mock (no-op canvas context methods)
- **Files modified:** tests/setup.ts (created), vitest.config.ts (added setupFiles)
- **Commit:** 4ff00f4 (included in Task 2 commit)

## Requirements Fulfilled

- **ROOM-01:** Isometric floor rhombuses drawn at correct screen positions (tileToScreen formula applied)
- **ROOM-02:** TileGrid data structure consumed (parseHeightmap → preRenderRoom pipeline)
- **ROOM-03:** Three-tone shading applied (tileColors → top/left/right face fills)
- **ROOM-04:** Depth sorting implemented (depthSort → back-to-front render order)
- **ROOM-05:** Wall strips drawn on correct edges (left: tx===0 or left neighbor void; right: ty===0 or above neighbor void)
- **ROOM-06:** Pure functions with zero DOM imports (confirmed by module inspection)
- **ROOM-08:** HiDPI scaling implemented (devicePixelRatio → physical pixel dimensions)
- **ROOM-09:** Pixel-crisp rendering (imageSmoothingEnabled=false on both main and OffscreenCanvas contexts)

## Technical Notes

### HiDPI Canvas Initialization

The `initCanvas` function ensures crisp pixels on high-DPI displays (e.g., retina MacBooks with DPR=2):

```typescript
const dpr = window.devicePixelRatio || 1;
canvas.width = Math.floor(canvas.offsetWidth * dpr);   // Physical pixels
canvas.height = Math.floor(canvas.offsetHeight * dpr);
canvas.style.width = canvas.offsetWidth + 'px';        // CSS pixels
canvas.style.height = canvas.offsetHeight + 'px';
ctx.scale(dpr, dpr);                                   // Scale context
ctx.imageSmoothingEnabled = false;                     // Pixel-crisp
```

This pattern is critical for isometric tile fidelity — without it, tiles blur at high DPR.

### Wall Strip Edge Detection

Wall strips are drawn on two edges:

- **Left wall:** `tx === 0 || grid.tiles[ty][tx - 1] == null`
  - Left edge of the room (tx=0) OR tile to the left is void
- **Right wall:** `ty === 0 || grid.tiles[ty - 1]?.[tx] == null`
  - Top edge of the room (ty=0) OR tile above is void

Using loose `== null` catches both `null` and `undefined` (from uneven row padding).

### OffscreenCanvas Pre-rendering

The `preRenderRoom` function renders the complete static room geometry to an OffscreenCanvas once at layout load. The React component (Plan 03) will:
1. Store the OffscreenCanvas in a useRef
2. Blit it to the main canvas via `ctx.drawImage(offscreen, 0, 0)` every frame
3. Only re-render the OffscreenCanvas when the layout changes

This avoids redrawing hundreds of canvas paths every frame (60 FPS) — a major performance win.

### Camera Origin Centering

The `computeCameraOrigin` function centers the room in the viewport by:
1. Finding the bounding box of all non-void tiles (min/max screen X/Y)
2. Adding WALL_HEIGHT to room height (tallest wall hangs below lowest tile)
3. Computing the offset to center this bounding box in the given viewport dimensions

This ensures rooms of any size (3×3, 10×10, 20×20) are always centered.

## Next Steps

Plan 02-03 (RoomCanvas.tsx) will import from this module:

```typescript
import { initCanvas, computeCameraOrigin, preRenderRoom, WALL_HEIGHT } from './isoTileRenderer.js';
```

The React component will:
1. Use `initCanvas` in a useEffect to initialize the canvas on mount
2. Call `computeCameraOrigin` to center the room
3. Call `preRenderRoom` to generate the OffscreenCanvas (store in useRef)
4. Blit the OffscreenCanvas to the main canvas in the rAF loop
5. Survive React StrictMode double-mount using the `running` boolean guard pattern

## Verification Results

```bash
npm run typecheck
✓ No TypeScript errors

npm test
✓ Test Files: 3 passed (3)
✓ Tests: 58 passed (58)
  - isometricMath.test.ts: 24 passing (no regressions)
  - isoTypes.test.ts: 25 passing (no regressions)
  - isoTileRenderer.test.ts: 9 passing (all new tests green)
```

All success criteria met:
- [x] src/isoTileRenderer.ts exists and exports initCanvas, computeCameraOrigin, preRenderRoom, WALL_HEIGHT
- [x] All four exports are TypeScript-typed (no `any` parameters)
- [x] 9 smoke tests in tests/isoTileRenderer.test.ts all passing
- [x] npm run typecheck exits 0 — no errors in any src/ or tests/ file
- [x] Module has zero React/DOM document-level imports — it is a pure canvas drawing module

## Self-Check

Verifying created files and commits:

```bash
# Check created files
[ -f "src/isoTileRenderer.ts" ] && echo "FOUND: src/isoTileRenderer.ts" || echo "MISSING: src/isoTileRenderer.ts"
[ -f "tests/isoTileRenderer.test.ts" ] && echo "FOUND: tests/isoTileRenderer.test.ts" || echo "MISSING: tests/isoTileRenderer.test.ts"
[ -f "tests/setup.ts" ] && echo "FOUND: tests/setup.ts" || echo "MISSING: tests/setup.ts"

# Check commits
git log --oneline --all | grep -q "4022ffb" && echo "FOUND: 4022ffb" || echo "MISSING: 4022ffb"
git log --oneline --all | grep -q "4ff00f4" && echo "FOUND: 4ff00f4" || echo "MISSING: 4ff00f4"
```


**Self-check result:** PASSED

All files created and commits exist:
- ✓ src/isoTileRenderer.ts
- ✓ tests/isoTileRenderer.test.ts
- ✓ tests/setup.ts
- ✓ Commit 4022ffb (feat: implement isoTileRenderer)
- ✓ Commit 4ff00f4 (test: add smoke tests)
