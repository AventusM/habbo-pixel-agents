---
id: S02
parent: M001
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
completed_at: 2026-02-28T21:16:00Z
blocker_discovered: false
---
# S02: Static Room Rendering

**# Phase 02 Plan 01: Isometric Types and Pure Logic**

## What Happened

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

# Phase 02 Plan 03: React Component + VS Code Extension

React component with StrictMode-safe rAF loop, VS Code extension host entry point, webview browser entry, and esbuild bundling — producing a demo-able isometric room renderer.

## Implementation Summary

### Task 1: Implement RoomCanvas.tsx with StrictMode-safe rAF loop
**Commit:** cf88cad

Created React component with canvas rendering and requestAnimationFrame loop that survives React StrictMode double-mount.

**Component structure:**

1. **Props interface:**
   - `heightmap: string` - Habbo heightmap string triggering re-render on change

2. **Refs (all useRef — NO useState):**
   - `canvasRef` - HTMLCanvasElement reference
   - `runningRef` - boolean guard for rAF loop (prevents ghost loops)
   - `rafIdRef` - requestAnimationFrame ID for cleanup
   - `renderState` - object containing offscreenCanvas, cameraOrigin, mainCtx

3. **useEffect with [heightmap] dependency:**
   - Gets canvas element from ref
   - Calls `initCanvas()` to set up HiDPI scaling
   - Parses heightmap via `parseHeightmap()`
   - Computes camera origin for room centering
   - Pre-renders room to OffscreenCanvas
   - Starts rAF loop with `runningRef.current = true`
   - Cleanup sets `runningRef.current = false` BEFORE `cancelAnimationFrame()`

4. **frame() function:**
   - **FIRST LINE:** `if (!runningRef.current) return` - StrictMode guard
   - Clears canvas
   - Blits OffscreenCanvas via single `drawImage()` call
   - Schedules next frame

**StrictMode safety verified:** No ghost loops observed in development (React 19 StrictMode double-mount).

**Verification:** npm run typecheck exits 0, RoomCanvas exports named export, no useState in file.

### Task 2: Bootstrap extension.ts and webview.tsx with esbuild build scripts
**Commit:** f895b46

Created VS Code extension host entry point and React webview browser entry.

**extension.ts (Node.js context):**
- Declares DEMO_HEIGHTMAP constant (10×10 office room with stair-step)
- Registers command `habbo-pixel-agents.openRoom`
- Creates WebviewPanel with:
  - `enableScripts: true`
  - `localResourceRoots: [context.extensionUri/dist]`
  - CSP: `script-src ${webview.cspSource}; style-src 'unsafe-inline'`
- Builds scriptUri via `webview.asWebviewUri()`
- Sets HTML shell with root div and script tag

**webview.tsx (browser context):**
- Imports React, createRoot, RoomCanvas
- Declares same DEMO_HEIGHTMAP
- Calls `createRoot(document.getElementById('root')!).render(<RoomCanvas heightmap={DEMO_HEIGHTMAP} />)`

**Build scripts:**
- `build:ext` - esbuild with `--platform=node --external:vscode --format=cjs --outfile=dist/extension.cjs`
- `build:webview` - esbuild with `--platform=browser --format=iife --jsx=automatic --outfile=dist/webview.js`
- `build` - runs both in sequence

**package.json updates:**
- `main: "./dist/extension.cjs"` (changed from .js to .cjs for ESM compatibility)
- `engines.vscode: "^1.80.0"`
- `contributes.commands` with `habbo-pixel-agents.openRoom`

**VS Code debug config:**
- Created `.vscode/launch.json` with `type: extensionHost`
- Created `.vscode/tasks.json` with `npm: build` task
- Added `preLaunchTask: "npm: build"` to auto-build before F5

**Verification:** npm run build exits 0, dist/extension.cjs and dist/webview.js exist and non-empty.

### Task 3: Visual verification — isometric room renders in VS Code webview
**Status:** APPROVED by user on 2026-02-28T21:16:00Z

**Testing procedure:**
1. Built extension via `npm run build` - ✓ SUCCESS
2. Launched Extension Development Host via F5 - ✓ SUCCESS
3. Ran "Open Habbo Room" command - ✓ SUCCESS
4. Visual inspection of webview panel - ✓ ALL CRITERIA MET

**Verification results:**

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Diamond-shaped isometric floor tiles (not rectangles) | ✓ VERIFIED | Screenshot shows correct rhombus-shaped tiles |
| Stair-step tiles visually elevated | ✓ VERIFIED | Four height-1 tiles in upper area render higher than ground level |
| Three-tone shading (top/left/right faces) | ✓ VERIFIED | Top face lightest, left face medium, right face darkest |
| Left and right wall strips along room edges | ✓ VERIFIED | Parallelogram wall faces visible on edges |
| Room centered in panel | ✓ VERIFIED | Room bounding box centered in viewport |
| Crisp pixels on HiDPI display | ✓ VERIFIED | Tile edges sharp, no blur artifacts |
| No console errors from extension code | ✓ VERIFIED | Only VS Code/Copilot internal errors present, no errors mentioning habbo/RoomCanvas/isoTileRenderer |

**Console errors found:**
- `punycode` module deprecation warning (VS Code internal)
- SQLite experimental feature warning (VS Code internal)
- GitHub Copilot 404 errors (unrelated service)
- TreeError [DebugRepl] (VS Code debugger internal)

None of these errors originate from the Habbo extension code. The extension functions correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] CommonJS vs ESM module format conflict**
- **Found during:** Task 2 F5 launch attempt
- **Issue:** Extension built as CommonJS (format=cjs) but output as .js; with package.json type=module, Node treats .js as ESM, causing "module is not defined in ES module scope" error
- **Fix:** Changed build:ext output to dist/extension.cjs and updated package.json main field to ./dist/extension.cjs
- **Files modified:** package.json (main field, build:ext script)
- **Commit:** Not committed separately (fixed during Task 2 debugging)

**2. [Rule 2 - Missing Configuration] VS Code launch.json misconfigured for Chrome debugging**
- **Found during:** Task 3 F5 launch attempt
- **Issue:** Default launch.json configured for Chrome/web debugging (type: chrome), not extension host; caused "Unable to find browser" error
- **Fix:** Replaced launch.json with extensionHost configuration, added preLaunchTask for auto-build
- **Files modified:** .vscode/launch.json (replaced), .vscode/tasks.json (created)
- **Commit:** Not committed separately (fixed during Task 3 debugging)

## Requirements Fulfilled

- **ROOM-10:** React StrictMode-safe rAF loop implemented (runningRef guard pattern prevents ghost loops)
- **ROOM-11:** VS Code extension entry points created (extension.ts for host, webview.tsx for browser)
- **BUILD-01:** esbuild bundling configured (extension.cjs for Node, webview.js for browser)
- **BUILD-02:** localResourceRoots and asWebviewUri() wired correctly (no 401/Access Denied errors)
- **BUILD-03:** Extension debuggable via F5 with auto-build preLaunchTask

## Technical Notes

### StrictMode Double-Mount Safety

React 19 StrictMode mounts components twice in development to catch side effects. The rAF loop survives this via:

```typescript
const runningRef = useRef(false);

useEffect(() => {
  runningRef.current = true;

  const frame = () => {
    if (!runningRef.current) return;  // Guard FIRST
    // ... render logic ...
    rafIdRef.current = requestAnimationFrame(frame);
  };

  rafIdRef.current = requestAnimationFrame(frame);

  return () => {
    runningRef.current = false;  // Set BEFORE cancel
    cancelAnimationFrame(rafIdRef.current);
  };
}, [heightmap]);
```

**Key details:**
- `runningRef.current = false` happens BEFORE `cancelAnimationFrame()` in cleanup
- `if (!runningRef.current) return` is the FIRST statement in `frame()`
- This ordering ensures no race conditions during StrictMode double-mount/unmount

### Extension vs Webview Context Separation

- **extension.ts** runs in Node.js (extension host process) - has access to `vscode` API, no DOM
- **webview.tsx** runs in browser (sandboxed iframe) - has DOM/React, no `vscode` API
- Communication between them happens via `webview.postMessage()` / `webview.onDidReceiveMessage()` (not used in this phase)

### CommonJS .cjs Extension Requirement

With `"type": "module"` in package.json:
- `.js` files are treated as ES modules
- `.cjs` files are treated as CommonJS
- VS Code extensions are CommonJS by convention (cannot use ESM yet)
- Solution: output extension bundle as `.cjs` to avoid module format errors

## Next Steps

Phase 2 (Static Room Rendering) is **COMPLETE**. All 3 plans (02-01, 02-02, 02-03) are done:
- ✓ Pure types, parser, colour utilities, depth sort (02-01)
- ✓ Canvas drawing module with HiDPI and OffscreenCanvas (02-02)
- ✓ React component and VS Code extension (02-03)

**Phase 2 deliverables achieved:**
- ✓ Isometric floor rhombuses drawn at correct positions
- ✓ Stair-step height offsets rendered visually
- ✓ Three-tone HSL shading (top/left/right faces)
- ✓ Left and right wall strips on room edges
- ✓ Depth-sorted back-to-front rendering
- ✓ OffscreenCanvas pre-rendering with single blit per frame
- ✓ HiDPI scaling with pixel-crisp rendering
- ✓ StrictMode-safe rAF loop (no ghost loops)
- ✓ Demo-able VS Code extension

**Next phase:** Phase 3 (Asset Pipeline) - `.nitro` extraction script, sprite cache, ImageBitmap loading, webview asset URI pipeline.

## Verification Results

```bash
npm run typecheck
✓ No TypeScript errors across all src/ files

npm run build
✓ dist/extension.cjs: 2.8kb
✓ dist/webview.js: 1.1mb

F5 → Open Habbo Room
✓ Isometric room renders correctly
✓ All 6 visual criteria met
✓ No extension-related console errors
```

All success criteria met:
- [x] npm run build exits 0 producing dist/extension.cjs and dist/webview.js
- [x] npm run typecheck exits 0 across all src/ files
- [x] VS Code webview opens on "Open Habbo Room" command
- [x] Isometric room visible with floor tiles, stair steps, wall strips, three-tone shading
- [x] rAF loop runs with no ghost loops under React StrictMode
- [x] All mutable state in RoomCanvas.tsx is in useRef (code review confirmed)
- [x] Camera origin policy locked (room centered via computeCameraOrigin)
- [x] WALL_HEIGHT=128 constant exists in isoTileRenderer.ts
- [x] All ROOM-01 through ROOM-11 requirements satisfied

## Commits

| Commit | Message | Files |
|--------|---------|-------|
| `cf88cad` | feat(02-03): implement RoomCanvas.tsx with StrictMode-safe rAF loop | src/RoomCanvas.tsx |
| `f895b46` | feat(02-03): bootstrap VS Code extension with esbuild build scripts | src/extension.ts, src/webview.tsx, package.json updates |

---

_Completed: 2026-02-28T21:16:00Z_
_Visual verification: APPROVED_
_Phase 2 Status: COMPLETE_
