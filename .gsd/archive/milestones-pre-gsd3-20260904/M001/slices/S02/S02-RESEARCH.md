# Phase 2: Static Room Rendering - Research

**Researched:** 2026-02-28
**Domain:** Canvas 2D isometric tile + wall rendering, React rAF loop, OffscreenCanvas pre-render, HiDPI scaling
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROOM-01 | Each walkable tile rendered as a filled 64×32 px rhombus using Canvas 2D path fills. | Canvas 2D `beginPath`/`moveTo`/`lineTo`/`closePath`/`fill` pattern verified from MDN + bswen.com. Four corner vertices derived from `tileToScreen()`. |
| ROOM-02 | Tiles at height levels 1-9 rendered with correct vertical offset (`tileZ * 16 px` upward shift). | Already encoded in `tileToScreen(x, y, z)` from Phase 1 — `screenY = (x+y)*16 - z*16`. No additional work beyond passing `tileZ` to the function. |
| ROOM-03 | Floor tiles use three-tone shading: top face lightest, left face medium, right face darkest. | HSL-based face shading pattern established: adjust CSS `hsl(H, S%, L%)` by ±brightness offset per face. Verified from isometric lighting tutorial (screamingbrainstudios.com). |
| ROOM-04 | Per-tile HSB colour from layout editor data model preserved and applied as fill colour. | Canvas 2D `ctx.fillStyle` accepts `hsl()` directly. HSB→HSL conversion formula (L = B*(1 - S/2)) is required since Canvas has no native HSB. Pattern established in Code Examples. |
| ROOM-05 | Left wall strips along top-left edge, right wall strips along top-right edge; left lighter than right (~20% brightness). | Wall geometry: detect edge tiles (x=0 or y=0), draw parallelogram strips at left/right faces. Brightness delta via HSL lightness offset. |
| ROOM-06 | Void tiles marked `x` in heightmap not drawn; panel background shows through. | Heightmap parsing: iterate string rows, split by char. `x`/`X` → skip. Digits `0-9` → tile height. Verified against Habbo v14 format (Kepler server / DevBest community). |
| ROOM-07 | All renderables depth-sorted using `tileX + tileY + tileZ * 0.001`; correct back-to-front paint order. | Sort key formula is from requirements spec. Painter's algorithm for isometric rendering is universally established. Sort is stable for integer X+Y because the 0.001 Z multiplier breaks ties. |
| ROOM-08 | Static room geometry pre-rendered to `OffscreenCanvas` once at layout load; composited via single `drawImage` per frame. | `new OffscreenCanvas(w, h)` on main thread (no worker) → draw → store reference. Per-frame: `mainCtx.drawImage(offscreen, 0, 0)`. Verified from MDN OffscreenCanvas docs. |
| ROOM-09 | Canvas init: `canvas.width = offsetWidth * dpr`, `ctx.scale(dpr, dpr)`, `ctx.imageSmoothingEnabled = false`. | Full HiDPI pattern verified from MDN `devicePixelRatio` official docs. `imageSmoothingEnabled = false` for pixel-crisp tiles confirmed from MDN Canvas tutorial. |
| ROOM-10 | `requestAnimationFrame` loop uses `running` boolean guard; self-terminates on cleanup under React StrictMode. | `running` ref pattern verified: set `running.current = true` before first rAF, set `false` in useEffect cleanup, rAF callback checks before scheduling next frame. Established in Code Examples. |
| ROOM-11 | All mutable render state in `useRef`; rAF loop reads current values without stale-closure bugs. | Decision already logged in STATE.md (2026-02-28). `useRef` for rAF state is a documented React pattern. Do not use `useState` for any value read inside the animation loop. |
</phase_requirements>

---

## Summary

Phase 2 produces a visible, correct isometric room from a Habbo heightmap string using only Canvas 2D path fills — no sprites, no external assets. The technical foundation (isometric math module, `tileToScreen`/`screenToTile` functions, TILE_W/H constants) is already in place from Phase 1. Phase 2 builds on it by adding: heightmap parsing, rhombus tile drawing, wall strip geometry, three-tone face shading, OffscreenCanvas pre-rendering, HiDPI canvas initialisation, and a React-safe requestAnimationFrame loop.

The two critical design decisions that must be locked in Phase 2 and inherited by all later phases are: (1) the **camera origin policy** — how tile (0,0) maps to the viewport, and (2) the **React StrictMode double-mount guard** — how the rAF loop survives development's double-invocation of `useEffect`. Both are addressed in the Architecture Patterns section with concrete code. The camera origin policy should centre the room in the viewport by computing a pixel offset based on room bounds at load time; this offset is the `cameraOrigin` stored in a ref and applied as a translation before every `tileToScreen` call that produces screen coordinates.

The OffscreenCanvas pre-render strategy for static geometry is a well-established Canvas 2D pattern: draw the full floor + walls to a `new OffscreenCanvas(w, h)` once on layout load, then blit it to the visible canvas each frame with a single `drawImage`. This eliminates all per-frame path re-drawing costs for static geometry. The rAF loop itself only needs to composite the static layer plus the dynamic layer (agents, speech bubbles) each frame.

**Primary recommendation:** Build `src/isoTileRenderer.ts` as the single source of truth for all canvas drawing operations; keep it a pure TypeScript module with no React imports; wire it into the React component via `useRef`-only state. Lock camera origin as "centre of the minimum bounding box of all non-void tiles" before completing Phase 2.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D API | Browser built-in | Rhombus path fills, wall strips, drawImage compositing | Decision locked in STATE.md: no PixiJS/WebGL for v1 |
| OffscreenCanvas | Browser built-in (baseline since 2023-03) | Pre-render static geometry once; blit per frame | Zero overhead, GPU-accelerated texture copy |
| React (existing) | Project dependency | Component lifecycle for canvas ref, useEffect, useRef | Already in the extension webview codebase |
| TypeScript | ^5.7.0 (existing) | Type-safe renderer module | Already established in Phase 1 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest-canvas-mock | ^0.3.x | Mock `HTMLCanvasElement` + `OffscreenCanvas` in Vitest | Required for unit-testing depth sort and heightmap logic in jsdom environment |
| @types/offscreencanvas | latest | TypeScript types for OffscreenCanvas | `OffscreenCanvas` is not in standard browser lib types without this or `"lib": ["DOM", "DOM.Iterable"]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `new OffscreenCanvas(w, h)` on main thread | `document.createElement('canvas')` as hidden canvas | Both work on main thread; OffscreenCanvas is the modern API with GPU-backed bitmaps; hidden canvas works everywhere but is slightly heavier. Use OffscreenCanvas. |
| HSL for face shading | RGB arithmetic | HSL lets you adjust lightness with a single number offset; RGB requires per-channel calculation. Use HSL. |
| Single `useRef` for all render state | Multiple `useRef`s | Single render-state object ref reduces re-initialisation risk; either works. Prefer one `renderState` ref object. |

**Installation (additions to Phase 1 setup):**

No new npm packages are required for core Phase 2 functionality. OffscreenCanvas and Canvas 2D are browser built-ins available in the VS Code webview. TypeScript types already include `HTMLCanvasElement`; add OffscreenCanvas types if not in `lib`:

```bash
# Only if OffscreenCanvas TypeScript errors appear:
npm install --save-dev @types/offscreencanvas

# Only if adding unit tests for canvas rendering logic:
npm install --save-dev vitest-canvas-mock
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── isometricMath.ts       # Phase 1: pure math (TILE_W, tileToScreen, etc.) — DO NOT MODIFY
├── isoTileRenderer.ts     # Phase 2: all canvas drawing — pure TS, no React imports
└── RoomCanvas.tsx         # Phase 2: React component — canvas ref, useEffect, useRef, rAF loop

tests/
├── isometricMath.test.ts  # Phase 1 tests — unchanged
└── isoTileRenderer.test.ts # Phase 2: unit tests for depth sort, heightmap parse, color compute
```

### Pattern 1: Heightmap String Parsing

**What:** Parse the Habbo heightmap string into a 2D grid of tile heights. Each row is a newline-separated string. Characters: `0-9` = walkable tile at that height. `x`/`X` = void (do not draw). Other characters = treat as `x`.

**When to use:** Called once at layout load, before pre-rendering the OffscreenCanvas.

**Habbo v14 heightmap format (MEDIUM confidence — verified from Kepler server DB schema and DevBest community):**
- String rows separated by `\n` (or `\r\n`)
- Each character is one tile
- `'0'` = floor at height 0 (ground level)
- `'1'`-`'9'` = floor at height 1-9 (stair steps)
- `'x'` or `'X'` = void tile — no floor, no wall, background shows through
- Tiles at row 0 (`y=0`) that are non-void get a left wall strip on their left face if no tile exists at `(x, y-1)`, and a right wall strip on their right face if no tile exists at `(x-1, y)`

**Example:**
```typescript
// Source: derived from Habbo v14 room model conventions
// Verified format: Kepler server (github.com/Quackster/Kepler), DevBest community
export interface TileGrid {
  tiles: Array<Array<{ height: number } | null>>; // null = void
  width: number;
  height: number;
}

export function parseHeightmap(heightmap: string): TileGrid {
  const rows = heightmap.trim().split(/\r?\n/);
  const height = rows.length;
  const width = Math.max(...rows.map(r => r.length));
  const tiles = rows.map(row =>
    row.split('').map(char => {
      if (char === 'x' || char === 'X') return null;
      const h = parseInt(char, 10);
      return isNaN(h) ? null : { height: h };
    })
  );
  return { tiles, width, height };
}
```

### Pattern 2: Rhombus Floor Tile Path

**What:** Draw a filled 64×32 px diamond (rhombus) at the correct isometric screen position for a given tile.

**When to use:** For every non-void tile in the grid, called during OffscreenCanvas pre-render.

**The four vertices of a floor tile rhombus** (using `tileToScreen` top-vertex as origin):
- Top vertex: `{ x: sx,          y: sy          }` (top of diamond)
- Right vertex: `{ x: sx + TILE_W_HALF, y: sy + TILE_H_HALF }` (right corner)
- Bottom vertex: `{ x: sx,          y: sy + TILE_H  }` (bottom of diamond)
- Left vertex: `{ x: sx - TILE_W_HALF, y: sy + TILE_H_HALF }` (left corner)

Where `{ sx, sy }` = `tileToScreen(tileX, tileY, tileZ)` plus camera origin offset.

```typescript
// Source: verified against bswen.com isometric Canvas 2D tutorial + clintbellanger.net
function drawFloorTile(
  ctx: OffscreenCanvasRenderingContext2D,
  sx: number,   // screen x of top vertex (after camera offset)
  sy: number,   // screen y of top vertex (after camera offset)
  fillColor: string, // CSS color string for top face
): void {
  const hw = TILE_W_HALF; // 32
  const hh = TILE_H_HALF; // 16

  ctx.beginPath();
  ctx.moveTo(sx,      sy);       // top vertex
  ctx.lineTo(sx + hw, sy + hh);  // right vertex
  ctx.lineTo(sx,      sy + TILE_H); // bottom vertex
  ctx.lineTo(sx - hw, sy + hh);  // left vertex
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
}
```

### Pattern 3: Three-Tone HSL Face Shading

**What:** Compute three fill colours (top face, left face, right face) from a single base HSB colour. Canvas 2D uses HSL natively; HSB must be converted.

**HSB to HSL conversion:**
```
L = B * (1 - S/2)          (when S and B are in 0..1 range)
S_hsl = (B - L) / min(L, 1 - L)
```
Or equivalently using percentage values: `hsl(H, S_hsl%, L%)`.

**Three-tone brightness deltas (verified from Habbo visual reference + screamingbrainstudios.com isometric lighting article):**
- Top face: base lightness (lightest — simulates overhead light)
- Left face: base lightness − 10% (medium shadow)
- Right face: base lightness − 20% (darkest shadow)

```typescript
// Source: verified from screamingbrainstudios.com/isometric-lighting/ + Habbo visual reference
// HSB input matches the existing layout editor data model

interface HsbColor { h: number; s: number; b: number } // h: 0-360, s: 0-100, b: 0-100

function hsbToHsl(hsb: HsbColor): { h: number; s: number; l: number } {
  const b = hsb.b / 100;
  const s = hsb.s / 100;
  const l = b * (1 - s / 2);
  const sHsl = l === 0 || l === 1 ? 0 : (b - l) / Math.min(l, 1 - l);
  return { h: hsb.h, s: Math.round(sHsl * 100), l: Math.round(l * 100) };
}

function tileColors(hsb: HsbColor): { top: string; left: string; right: string } {
  const { h, s, l } = hsbToHsl(hsb);
  return {
    top:   `hsl(${h}, ${s}%, ${l}%)`,
    left:  `hsl(${h}, ${s}%, ${Math.max(0, l - 10)}%)`,
    right: `hsl(${h}, ${s}%, ${Math.max(0, l - 20)}%)`,
  };
}
```

### Pattern 4: Wall Strip Geometry

**What:** Draw left wall strips and right wall strips at room edges. Left wall = parallelogram on the left face of edge tiles at x=0 (or where no tile exists to the left). Right wall = parallelogram on the right face of edge tiles at y=0 (or where no tile exists above).

**Wall detection rule:**
- **Left wall strip** at tile (tx, ty): tile is non-void AND `tiles[ty][tx-1]` is void or out of bounds (nothing to the left in the room)
- **Right wall strip** at tile (tx, ty): tile is non-void AND `tiles[ty-1][tx]` is void or out of bounds (nothing above in the room)

**Wall height in screen pixels:** `TILE_H_HALF` (16 px) per the Habbo aesthetic — walls are one tile unit tall.

```typescript
// Left wall strip: parallelogram on the left face of the tile
function drawLeftWall(
  ctx: OffscreenCanvasRenderingContext2D,
  sx: number, sy: number,  // top vertex of tile (after camera)
  wallColor: string,
): void {
  const hw = TILE_W_HALF;
  const hh = TILE_H_HALF;
  const wallH = TILE_H; // wall height in screen pixels (can be tuned)

  ctx.beginPath();
  ctx.moveTo(sx - hw, sy + hh);          // left vertex of top face
  ctx.lineTo(sx,      sy + TILE_H);      // bottom vertex of top face
  ctx.lineTo(sx,      sy + TILE_H + wallH); // bottom-left of wall
  ctx.lineTo(sx - hw, sy + hh  + wallH); // top-left of wall
  ctx.closePath();
  ctx.fillStyle = wallColor;
  ctx.fill();
}

// Right wall strip: parallelogram on the right face of the tile
function drawRightWall(
  ctx: OffscreenCanvasRenderingContext2D,
  sx: number, sy: number,
  wallColor: string,
): void {
  const hw = TILE_W_HALF;
  const hh = TILE_H_HALF;
  const wallH = TILE_H;

  ctx.beginPath();
  ctx.moveTo(sx + hw, sy + hh);          // right vertex of top face
  ctx.lineTo(sx,      sy + TILE_H);      // bottom vertex of top face
  ctx.lineTo(sx,      sy + TILE_H + wallH); // bottom-right of wall
  ctx.lineTo(sx + hw, sy + hh  + wallH); // top-right of wall
  ctx.closePath();
  ctx.fillStyle = wallColor;
  ctx.fill();
}
```

### Pattern 5: Depth Sort (Painter's Algorithm)

**What:** Sort all renderable objects back-to-front before drawing, so near tiles paint over far tiles.

**Sort key from requirements (ROOM-07):** `tileX + tileY + tileZ * 0.001`

The `0.001` Z multiplier ensures that for the same (x+y) sum, higher tiles paint on top of lower tiles but do not override the (x+y) ordering — critical for stair-step geometry. This is consistent with the painter's algorithm approach documented in bswen.com and mazebert.com.

```typescript
// Source: requirement ROOM-07, consistent with documented painter's algorithm for isometric
interface Renderable {
  tileX: number;
  tileY: number;
  tileZ: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

function depthSort(renderables: Renderable[]): Renderable[] {
  return [...renderables].sort(
    (a, b) =>
      (a.tileX + a.tileY + a.tileZ * 0.001) -
      (b.tileX + b.tileY + b.tileZ * 0.001)
  );
}
```

### Pattern 6: HiDPI Canvas Initialisation

**What:** Set up the main canvas for crisp pixel rendering at 2× DPR (Retina displays).

**When to use:** Once in `useEffect` on component mount, before any drawing. Must be re-applied if the canvas is resized.

```typescript
// Source: MDN Web Docs — Window: devicePixelRatio property
// https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
function initCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;

  // CSS display size (determined by layout)
  const displayW = canvas.offsetWidth;
  const displayH = canvas.offsetHeight;

  // Physical pixel dimensions
  canvas.width  = Math.floor(displayW * dpr);
  canvas.height = Math.floor(displayH * dpr);

  // Keep CSS size unchanged (element still occupies same layout space)
  canvas.style.width  = `${displayW}px`;
  canvas.style.height = `${displayH}px`;

  // Scale all drawing to CSS pixel coordinates
  ctx.scale(dpr, dpr);

  // Pixel-crisp — required before any sprite draw
  ctx.imageSmoothingEnabled = false;

  return ctx;
}
```

### Pattern 7: React RAF Loop with StrictMode Guard

**What:** A `requestAnimationFrame` loop that survives React StrictMode double-mount without creating ghost loops.

**The React StrictMode problem (development only):** React 18 StrictMode calls each `useEffect` twice: mount → unmount → mount. Without a guard, the rAF loop from the first mount continues running after cleanup because `cancelAnimationFrame` was called, but the loop already scheduled the next frame before cleanup ran.

**The `running` boolean guard pattern:**

```typescript
// Source: CSS-Tricks "Using requestAnimationFrame with React Hooks"
// + React official docs on StrictMode cleanup requirements
// https://css-tricks.com/using-requestanimationframe-with-react-hooks/
// https://react.dev/reference/react/StrictMode

import { useEffect, useRef } from 'react';

function RoomCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(false);
  const rafIdRef   = useRef<number>(0);

  // All mutable render state lives here — NEVER in useState (ROOM-11)
  const renderState = useRef({
    offscreenCanvas: null as OffscreenCanvas | null,
    cameraOrigin:    { x: 0, y: 0 },
    // ... agent positions, animation frames, speech bubble text go here in later phases
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = initCanvas(canvas);
    runningRef.current = true;

    // Pre-render static geometry once
    renderState.current.offscreenCanvas = preRenderRoom(/* grid, cameraOrigin */);
    renderState.current.cameraOrigin    = computeCameraOrigin(/* grid, canvas */);

    // rAF loop
    function frame() {
      if (!runningRef.current) return; // guard: stop if cleanup already ran

      // Composite static layer
      const offscreen = renderState.current.offscreenCanvas;
      if (offscreen) ctx.drawImage(offscreen, 0, 0);

      // Dynamic layer (agents, overlays) — drawn in later phases

      rafIdRef.current = requestAnimationFrame(frame);
    }

    rafIdRef.current = requestAnimationFrame(frame);

    // Cleanup: this runs on StrictMode unmount AND on real unmount
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafIdRef.current);
    };
  }, []); // empty deps: run once on mount

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
}
```

**Why this works under StrictMode:**
1. First mount: `runningRef.current = true`, rAF loop starts.
2. StrictMode cleanup: `runningRef.current = false`, `cancelAnimationFrame` called.
3. In-flight frame callback checks `if (!runningRef.current) return` — loop stops.
4. Second mount: `runningRef.current = true` again, fresh rAF loop starts.

No ghost loop survives cleanup because the boolean guard is checked at the top of every frame callback.

### Pattern 8: Camera Origin Policy

**What:** Define how tile (0,0) maps to the viewport so the room appears centred.

**Decision for Phase 2 (MUST be locked before completion):** Compute camera origin as the pixel offset that centres the room's minimum bounding box in the canvas element's CSS display size.

```typescript
// Compute cameraOrigin so the room's full extent is centred in the viewport
function computeCameraOrigin(
  grid: TileGrid,
  canvasCssWidth: number,
  canvasCssHeight: number,
): { x: number; y: number } {
  // Find min and max screen positions across all non-void tiles at z=0
  let minSx = Infinity, maxSx = -Infinity;
  let minSy = Infinity, maxSy = -Infinity;

  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      if (!grid.tiles[ty][tx]) continue;
      const { x: sx, y: sy } = tileToScreen(tx, ty, 0);
      // Include all four rhombus vertices in bounds
      minSx = Math.min(minSx, sx - TILE_W_HALF);
      maxSx = Math.max(maxSx, sx + TILE_W_HALF);
      minSy = Math.min(minSy, sy);
      maxSy = Math.max(maxSy, sy + TILE_H);
    }
  }

  const roomW = maxSx - minSx;
  const roomH = maxSy - minSy;

  return {
    x: Math.floor((canvasCssWidth  - roomW) / 2) - minSx,
    y: Math.floor((canvasCssHeight - roomH) / 2) - minSy,
  };
}

// Usage: add cameraOrigin to every tileToScreen result before drawing
// sx_draw = sx_tile + cameraOrigin.x
// sy_draw = sy_tile + cameraOrigin.y
```

### Anti-Patterns to Avoid

- **Re-drawing static geometry every frame:** Floor tiles and walls never move. Drawing them inside the rAF loop instead of once to OffscreenCanvas burns CPU on path operations for every frame. Use the OffscreenCanvas pre-render pattern (ROOM-08).
- **`useState` for rAF state:** `useState` triggers re-renders. Any value read inside the animation loop (positions, frames, bubble text) must be in `useRef`. Re-renders will not reflect in the stale rAF closure anyway. (Decision locked in STATE.md.)
- **Sub-pixel canvas drawing coordinates:** `drawImage(offscreen, x, y)` should use integer `x,y`. Fractional coords trigger sub-pixel anti-aliasing even with `imageSmoothingEnabled = false`. Use `Math.floor` on camera offset.
- **Not calling `cancelAnimationFrame` in cleanup:** The rAF loop is infinite. Without cancellation, the loop runs after the component unmounts, causing memory leaks and ghost updates.
- **Drawing walls before floor in z-sort:** Walls must be sorted together with floors in the depth sort, or walls will incorrectly overlay floors they should sit behind. Include wall renderables in the same sort array as floor tiles.
- **HSB direct use in `ctx.fillStyle`:** Canvas does not natively accept HSB. Convert HSB → HSL before setting `fillStyle`. The conversion formula is in Pattern 3 above.
- **Missing `imageSmoothingEnabled = false` on OffscreenCanvas context:** Both the main canvas context AND the OffscreenCanvas context need `imageSmoothingEnabled = false`. A crisp OffscreenCanvas blitted to a smoothing-enabled main ctx will still be blurred.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HSB→HSL colour conversion | Custom bitwise RGB math | Simple formula: `L = B*(1-S/2)`, then canvas `hsl()` string | Canvas natively accepts `hsl()` — no RGB needed. Custom RGB math is error-prone |
| Depth sorting | Manual insertion sort, z-buffer | `Array.sort()` with `tileX + tileY + tileZ * 0.001` key | Native sort is O(n log n) and stable; tile counts are small (10×10 = 100 tiles) |
| OffscreenCanvas polyfill | Hidden `<canvas>` element | `new OffscreenCanvas(w, h)` | Available since March 2023 (Baseline Widely Available). VS Code Electron ships Chromium 114+; no polyfill needed |
| StrictMode detection | Reading `__REACT_STRICT_MODE__` or similar | `running` boolean ref pattern | The boolean guard works correctly in both strict and production mode — no mode detection needed |
| DPR scaling utility | Custom resize observer loop | One-time `initCanvas()` call in `useEffect` | DPR rarely changes at runtime for desktop VS Code; resize observer is future Phase 7 work |

**Key insight:** Phase 2 drawing primitives are simple: a handful of `lineTo` calls per tile plus HSL string construction. The complexity is not in any individual draw call — it is in the rendering lifecycle (OffscreenCanvas timing, StrictMode survival, DPR initialisation order). Don't invest in custom draw utilities; focus on getting the lifecycle right.

---

## Common Pitfalls

### Pitfall 1: Ghost rAF Loop Under React StrictMode

**What goes wrong:** Two rAF loops run concurrently in development. The room appears to flicker, or frame rate is doubled. Console shows no errors.

**Why it happens:** StrictMode calls `useEffect` twice (mount → cleanup → mount). The first loop's rAF fires after cleanup ran `cancelAnimationFrame`, but a frame was already scheduled before cleanup. Without the `running` guard, the first loop continues.

**How to avoid:** Always check `if (!runningRef.current) return` at the top of every frame callback. Set `runningRef.current = false` in the cleanup function before `cancelAnimationFrame`. The check must run before the next `requestAnimationFrame` call.

**Warning signs:** In development, `console.log('frame')` inside the rAF fires twice as often as expected. In production (no StrictMode), everything is fine.

### Pitfall 2: OffscreenCanvas Not Updated After Layout Change

**What goes wrong:** User loads a different room layout; the old room continues to display because the OffscreenCanvas was pre-rendered once and never regenerated.

**Why it happens:** The pre-render is intentionally done once. If the layout prop changes, `useEffect` needs a dependency on the layout to re-trigger pre-rendering.

**How to avoid:** Add the heightmap string (or a stable layout ID) to the `useEffect` dependency array. On change: re-parse the heightmap, re-compute camera origin, re-draw the OffscreenCanvas, and invalidate the stored reference. The rAF loop will pick up the new OffscreenCanvas on the next frame.

**Warning signs:** Changing the room layout prop in React has no visual effect.

### Pitfall 3: OffscreenCanvas Dimensions Wrong for DPR

**What goes wrong:** The OffscreenCanvas is created at CSS pixel dimensions (e.g., 800×600) but the main canvas is scaled to physical pixels (e.g., 1600×1200 at 2× DPR). `drawImage` stretches the OffscreenCanvas, producing blurry geometry.

**Why it happens:** `new OffscreenCanvas(w, h)` uses raw pixel dimensions. The room geometry coordinates must be drawn at the DPR-scaled size.

**How to avoid:** Create the OffscreenCanvas at the same physical pixel dimensions as the main canvas: `new OffscreenCanvas(canvas.width, canvas.height)`. Apply the same `ctx.scale(dpr, dpr)` to the OffscreenCanvas context. Then add the camera origin offset in CSS pixel space before drawing tiles.

**Warning signs:** Room tiles are visible but blurry on Retina screens. Everything is crisp at 1× DPR.

### Pitfall 4: Wall Edge Detection Off-by-One

**What goes wrong:** Left walls appear on interior tiles, or edge tiles have no walls. Room edges appear open.

**Why it happens:** The wall detection condition (`tiles[ty][tx-1] === null`) must check bounds: `tx === 0 || tiles[ty][tx-1] === null`. Accessing `tiles[ty][-1]` returns `undefined`, which is not `null`, so the wall is not drawn for the leftmost column.

**How to avoid:** Write the wall condition as: `tx === 0 || grid.tiles[ty][tx - 1] == null` (loose equality to catch both `null` and `undefined`).

**Warning signs:** The leftmost column of tiles has no left wall, but interior void gaps do get walls.

### Pitfall 5: Camera Origin Applied Inconsistently

**What goes wrong:** The static room geometry (on OffscreenCanvas) is centred correctly, but dynamic elements (agents added in Phase 5) are offset from tiles.

**Why it happens:** The camera origin is applied inside `preRenderRoom()` but not exported in a way that later renderers can use it. Each phase re-computes or ignores it.

**How to avoid:** Store `cameraOrigin` in `renderState.current` from the very first frame. All future phases that draw screen-space elements MUST import and apply the same `cameraOrigin` offset from `renderState.current`. Establish this contract in Phase 2.

**Warning signs:** In Phase 5, avatar feet are offset from their tile positions by a fixed pixel amount.

### Pitfall 6: Depth Sort Applied Only to Dynamic Elements

**What goes wrong:** Furniture (Phase 4) placed on elevated tiles appears behind the floor. The floor is pre-rendered to OffscreenCanvas and drawn first, then furniture is drawn on top, but depth sorting between floor and furniture is broken.

**Why it happens:** The OffscreenCanvas pre-render draws all floor tiles first without furniture in the sort. When furniture is composited on the main canvas, it is always above all floor geometry regardless of depth.

**How to avoid:** The OffscreenCanvas pre-render is correct only for static geometry (floor + walls) that has no depth overlap with dynamic elements. Furniture and avatars are drawn on the main canvas after `drawImage(offscreen, ...)` in painter's algorithm order. For Phase 2 (static only), this is fine. From Phase 4 onward, the planner must ensure furniture is depth-sorted against avatars and drawn in the correct order on the main canvas layer.

**Warning signs (future phases):** An avatar standing behind a desk is incorrectly rendered on top of it.

---

## Code Examples

Verified patterns from official sources:

### HiDPI Canvas Setup (MDN-verified)

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
function initCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const displayW = canvas.offsetWidth;
  const displayH = canvas.offsetHeight;

  canvas.width  = Math.floor(displayW * dpr);
  canvas.height = Math.floor(displayH * dpr);
  canvas.style.width  = `${displayW}px`;
  canvas.style.height = `${displayH}px`;

  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
```

### OffscreenCanvas Pre-Render + Blit (MDN-verified)

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
// Main thread only (no worker) — synchronous rendering

function createOffscreen(
  physicalWidth: number,
  physicalHeight: number,
  dpr: number,
): { offscreen: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } {
  const offscreen = new OffscreenCanvas(physicalWidth, physicalHeight);
  const ctx = offscreen.getContext('2d')!;
  ctx.scale(dpr, dpr); // match main canvas scaling
  ctx.imageSmoothingEnabled = false;
  return { offscreen, ctx };
}

// Per-frame blit:
function compositeToMain(
  mainCtx: CanvasRenderingContext2D,
  offscreen: OffscreenCanvas,
): void {
  mainCtx.drawImage(offscreen, 0, 0);
}
```

### Depth Sort Key

```typescript
// Sort key: tileX + tileY + tileZ * 0.001 (from ROOM-07)
// Verified consistent with painter's algorithm documented at:
// https://mazebert.com/forum/news/isometric-depth-sorting--id775/
const sorted = renderables.sort(
  (a, b) => (a.tileX + a.tileY + a.tileZ * 0.001)
           - (b.tileX + b.tileY + b.tileZ * 0.001)
);
```

### Canvas `ctx.fillStyle` with HSL

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillStyle
// Canvas accepts CSS color strings including hsl() natively
ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`;  // all percentage values
ctx.fill();
```

### React StrictMode-Safe rAF Cleanup

```typescript
// Source: https://css-tricks.com/using-requestanimationframe-with-react-hooks/
// + React StrictMode docs: https://react.dev/reference/react/StrictMode
useEffect(() => {
  const running = { current: true };
  const rafId   = { current: 0 };

  function frame() {
    if (!running.current) return; // StrictMode guard
    // ... draw ...
    rafId.current = requestAnimationFrame(frame);
  }

  rafId.current = requestAnimationFrame(frame);

  return () => {
    running.current = false;
    cancelAnimationFrame(rafId.current);
  };
}, [layoutId]); // re-run when room layout changes
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `document.createElement('canvas')` as offscreen buffer | `new OffscreenCanvas(w, h)` | 2023 (Baseline Widely Available) | Cleaner API, same main-thread semantics, future-compatible with Worker transfer |
| `setInterval` for animation loop | `requestAnimationFrame` | ~2012 | Sync to display refresh, pauses when tab hidden, no jank from timer drift |
| React `useState` for animation values | `useRef` for all mutable render state | React 18 | `useState` triggers re-renders; stale closure in rAF captures initial state value |
| Manual RGB arithmetic for shading | CSS `hsl()` string in `fillStyle` | Canvas API v1 | HSL is natively supported; adjusting `l` value by ±10% is simpler than R/G/B math |
| `ctx.imageSmoothingEnabled` vendor prefixes | Standard `ctx.imageSmoothingEnabled` | ~2018 | All Electron/Chromium versions used by VS Code support the unprefixed property |

**Deprecated/outdated:**
- `ctx.webkitImageSmoothingEnabled` / `ctx.mozImageSmoothingEnabled`: Vendor-prefixed versions are no longer needed for Chromium-based VS Code webviews. Set `ctx.imageSmoothingEnabled = false` only.
- `requestIdleCallback` for pre-rendering: OffscreenCanvas pre-render on layout load is a one-time synchronous operation — it completes in <1ms for a 10×10 room. `requestIdleCallback` scheduling adds unnecessary complexity.

---

## Open Questions

1. **Camera origin: centre-of-room vs top-tile-at-top-of-viewport**
   - What we know: The requirement says to decide camera origin policy in Phase 2. Two approaches exist: (A) centre the room's bounding box in the viewport (Pattern 8 above), or (B) place tile (0,0) at a fixed offset from top-left.
   - What's unclear: Whether the existing layout editor uses a specific camera convention that Phase 2 must match to avoid a Phase 7 breaking change.
   - Recommendation: Use **approach A** (centred bounding box). It produces the most visually balanced result for any room size and is trivially recomputed when the room changes. Lock this decision as a constant in `isoTileRenderer.ts` and document it before marking Phase 2 complete.

2. **Wall height: fixed vs tile-height-aware**
   - What we know: ROOM-05 specifies wall strips along room edges. The requirement does not specify wall height. Classic Habbo v14 walls are 110-128 px tall (approximately `TILE_H * 4` to `TILE_H * 5`).
   - What's unclear: The exact wall height to use in the Canvas 2D path. Too short looks wrong; too tall obscures the room.
   - Recommendation: Use `TILE_H * 4 = 128` px wall height as the default. Export it as a named constant `WALL_HEIGHT = 128` in `isoTileRenderer.ts`. The planner should encode this as a literal constant in the task, not defer it.

3. **OffscreenCanvas in VS Code Webview: confirmed available?**
   - What we know: `OffscreenCanvas` is Baseline Widely Available since March 2023. VS Code 1.80+ ships Electron with Chromium 114+, which includes OffscreenCanvas.
   - What's unclear: The minimum VS Code version this extension targets is not specified in the planning documents. If targeting VS Code < 1.70 (Chromium < 102), `OffscreenCanvas` may not be available.
   - Recommendation: Assume VS Code 1.80+ (Chromium 114+). If a compatibility fallback is needed, use `document.createElement('canvas')` as a hidden canvas instead — the API surface is identical. Flag this as a LOW-priority risk.

---

## Sources

### Primary (HIGH confidence)
- MDN Web Docs — CanvasRenderingContext2D, OffscreenCanvas, devicePixelRatio, Canvas Optimization: https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
- MDN Web Docs — devicePixelRatio HiDPI canvas pattern: https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
- MDN Web Docs — Canvas API Optimization: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- MDN Web Docs — fillStyle HSL: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillStyle
- React Official Docs — StrictMode effect double-run behaviour: https://react.dev/reference/react/StrictMode
- Phase 1 RESEARCH.md — `tileToScreen` formula, constants, direction map confirmed

### Secondary (MEDIUM confidence)
- CSS-Tricks — "Using requestAnimationFrame with React Hooks": https://css-tricks.com/using-requestanimationframe-with-react-hooks/ — running boolean pattern
- bswen.com — "How to Create Isometric 2.5D Games Using HTML5 Canvas" (2026-02-21): https://docs.bswen.com/blog/2026-02-21-isometric-25d-canvas-games/ — tile path drawing, depth sort, wall shading
- clintbellanger.net — "Isometric Tiles Math": https://clintbellanger.net/articles/isometric_math/ — camera offset formula
- screamingbrainstudios.com — "Isometric Lighting Tutorial": https://screamingbrainstudios.com/isometric-lighting/ — three-tone face shading approach
- mazebert.com — "Isometric depth sorting": https://mazebert.com/forum/news/isometric-depth-sorting--id775/ — painter's algorithm for isometric
- ag-grid.com — "Optimising HTML5 Canvas Rendering": https://blog.ag-grid.com/optimising-html5-canvas-rendering-best-practices-and-techniques/ — OffscreenCanvas pre-render pattern
- STATE.md decisions log — Canvas 2D decision, useRef decision, tileToScreen formula confirmed

### Tertiary (LOW confidence)
- Habbo v14 heightmap format (character-per-tile, `x` = void, `0-9` = height): Inferred from Kepler server (github.com/Quackster/Kepler) DB schema references and DevBest community posts. Not directly verified from official Sulake documentation (which is proprietary). Confidence is HIGH for the character encoding pattern (widely replicated in retro server code), LOW for any edge cases in the format.
- Wall height = `TILE_H * 4 = 128 px`: Inferred from Habbo visual reference screenshots. Not formally documented. Should be verified visually after implementation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Canvas 2D and OffscreenCanvas verified from MDN; decision to use Canvas 2D (not PixiJS) locked in STATE.md
- Architecture patterns: HIGH — HiDPI setup, rAF loop, OffscreenCanvas pre-render all verified from MDN and CSS-Tricks. Three-tone shading verified from isometric lighting tutorial. Camera origin formula derived from first principles using established tileToScreen function.
- Pitfalls: HIGH — StrictMode ghost loop, DPR scaling, sub-pixel drawing, wall edge detection all directly derived from the established patterns and known Canvas 2D behaviour
- Heightmap format: MEDIUM — Character encoding (`x`=void, `0-9`=height) is universally adopted in open-source Habbo retro servers; edge cases LOW

**Research date:** 2026-02-28
**Valid until:** 2026-05-28 (Canvas 2D API is stable; React StrictMode behaviour is stable in React 18/19)