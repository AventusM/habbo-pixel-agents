# Architecture Research
## Isometric 2.5D Rendering Layer — Habbo Pixel Agents
_Research date: 2026-02-28_

---

## Isometric Rendering Pipeline (from open-source Habbo renderers)

### Overview

Four open-source Habbo HTML5 renderers were studied for architectural patterns: **scuti-renderer** (mathishouis/scuti-renderer), **shroom** (jankuss/shroom), **bobba_client** (Josedn/bobba_client), and **nitro-renderer** (billsonnn/nitro-renderer). All share a common layered pipeline even though they differ in rendering back-end (PixiJS vs. Canvas 2D).

### Canonical Pipeline Components

```
Input: heightmap string + furniture manifest + avatar state
        |
        v
[1] Asset Loader
    - Load PNG sprite atlases (drawImage source)
    - Parse JSON frame manifests (sprite name -> {x,y,w,h})
    - Cache HTMLImageElement references keyed by atlas name

        |
        v
[2] Coordinate Module (pure math, no render deps)
    - tileToScreen(tileX, tileY, tileZ) -> {screenX, screenY}
    - screenToTile(screenX, screenY) -> {tileX, tileY} (float)
    - Constants: TILE_W=64, TILE_H=32, TILE_W_HALF=32, TILE_H_HALF=16

        |
        v
[3] Room Model Builder
    - Parse heightmap string -> 2D tile grid: {walkable, height, color}
    - Derive wall strips from grid edges (left-wall = top-left edge along X; right-wall = top-right edge along Y)
    - Store furniture manifest: [{id, tileX, tileY, tileZ, rotation, spriteKey}]

        |
        v
[4] Scene Graph / Render List
    - Each renderable gets a sort key: sortKey = tileX + tileY + tileZ * 0.001
    - All renderables (tiles, walls, furni, avatars, bubbles) pushed into a flat list
    - List sorted ascending by sortKey (painter's algorithm: back-to-front)

        |
        v
[5] Render Pass (painter's algorithm, Canvas 2D)
    a. Clear canvas (ctx.clearRect)
    b. For each renderable in sorted order:
       - Floor tiles: ctx.beginPath, draw rhombus diamond, fill with HSB tile color
       - Wall strips: ctx.fillRect with shading (left wall = lighter, right wall = darker)
       - Furniture sprites: ctx.drawImage(atlas, sx,sy,sw,sh, dx,dy,dw,dh)
       - Avatars: composite body-part layers via drawImage in layer order
       - Speech bubbles: roundRect + text, always on top (appended after sort)
       - Name tags: text with pill background, always on top

        |
        v
Output: single <canvas> frame at ~30fps (requestAnimationFrame or setInterval)
```

### Key Insights from scuti-renderer

scuti-renderer (TypeScript + PixiJS) is the most actively maintained and fully featured of the four. Its modules map directly to the pipeline above:

- `Room` class: owns the heightmap grid, furniture list, and avatar list
- `RoomCamera`: handles pan/zoom offset applied to all screen projections
- `RoomTile` / `RoomWall` / `RoomStair`: individual renderable primitives
- `Furni` / `WallFurni`: furniture drawables that read atlas frame data from the JSON manifest
- `Avatar` / `AvatarFigure`: composites multi-layer avatar sprites by direction and action code
- `RoomVisualization`: the render pass orchestrator — builds the sort list and executes the draw loop

### Key Insights from shroom

shroom is PixiJS-based and uses PixiJS containers for depth ordering (container z-index drives draw order). The contribution to study here is its handling of **stair tiles** and **wall geometry**: stair tiles are treated as regular floor tiles with a height offset applied per step, and walls are generated programmatically from the heightmap edges rather than being authored as sprites.

### Key Insights from bobba_client

bobba_client explicitly states: "the farther elements are drawn first, so there's a 3D illusion." This confirms the painters-algorithm approach. The client keeps avatar and furniture assets as server-hosted sprite sheets and uses PixiJS `Sprite` objects with manual z-order values.

### Key Insights from nitro-renderer

nitro-renderer is the most complex and uses a full ECS-like component system. For the pixel-agents use case, the relevant part is the **asset loading subsystem** (see Nitro Asset Loading section below), not the full rendering stack. The renderer loads `.nitro` bundles, inflates them, and maps frame names to PixiJS textures.

---

## Coordinate System Adaptation

### What Changes vs What Stays the Same

| Concern | Flat top-down | Isometric 2.5D | Change required? |
|---------|---------------|----------------|-----------------|
| Tile grid data model (2D array) | `grid[y][x]` | `grid[y][x]` | **No change** |
| BFS walkability check | `grid[y][x].walkable` | `grid[y][x].walkable` | **No change** |
| Path output (list of [x,y] steps) | Grid coords | Grid coords | **No change** |
| Screen render position of tile | `screen = {x: tileX*32, y: tileY*32}` | See formula below | Replace only in renderer |
| Mouse -> tile mapping | `tileX = floor(mouseX/32)` | Two-step inverse (see formula) | Replace only in input handler |
| Depth/draw order | Row-major top-down | Sort by `tileX + tileY + tileZ*epsilon` | New sort pass in renderer |
| Avatar direction | 4 cardinal | 8 diagonal-biased | Extend direction enum |

### Projection Formulas (verified across clintbellanger.net, FEATURES.md, multiple renderers)

**Grid to Screen** (render any tile/object at grid position x, y, z):

```typescript
const TILE_W      = 64;   // full tile width
const TILE_H      = 32;   // full tile height (2:1 ratio)
const TILE_W_HALF = 32;
const TILE_H_HALF = 16;

function tileToScreen(tileX: number, tileY: number, tileZ: number = 0): {x: number, y: number} {
  return {
    x: (tileX - tileY) * TILE_W_HALF,
    y: (tileX + tileY) * TILE_H_HALF - tileZ * TILE_H_HALF,
  };
}
```

The `tileZ * TILE_H_HALF` term raises tiles upward for each height level (Habbo stair steps). At `tileZ = 0` this collapses to the flat formula.

**Screen to Grid** (mouse picking, floating-point output; floor/round for tile index):

```typescript
function screenToTile(screenX: number, screenY: number): {x: number, y: number} {
  // Adjust for camera offset before calling this function
  return {
    x: screenX / TILE_W + screenY / TILE_H,   // equivalent to (screenX/32 + screenY/16) / 2
    y: screenY / TILE_H - screenX / TILE_W,
  };
}
```

Sources: [clintbellanger.net isometric_math](https://clintbellanger.net/articles/isometric_math/), [nick-aschenbach.github.io isometric-tile-engine](http://nick-aschenbach.github.io/blog/2015/02/25/isometric-tile-engine/), FEATURES.md (existing project research)

### Camera / Origin Offset

All screen coordinates must be adjusted for a camera origin before using the screen-to-tile formula:

```typescript
// Before picking:
const adjustedX = mouseX - cameraOffsetX;
const adjustedY = mouseY - cameraOffsetY;
const tile = screenToTile(adjustedX, adjustedY);

// Camera offset is typically set so tile (0,0) appears near the top-centre of the canvas:
const cameraOffsetX = canvas.width / 2;
const cameraOffsetY = TILE_H_HALF * 2; // a few tile heights from top edge
```

---

## BFS Pathfinding in Isometric Space

### Core Finding: Algorithm is Unchanged

**The BFS algorithm itself does not change.** The algorithm operates entirely on the logical grid (2D array of walkable/blocked cells) and never touches screen coordinates. The existing `tileMap.ts` BFS implementation survives unchanged.

This is confirmed by:
- FEATURES.md explicit statement: "BFS is purely logical on the tile grid; isometric view has no impact on the algorithm itself"
- Multiple gamedev forum sources noting pathfinding works in grid space independent of visual projection
- The shroom, bobba_client, and scuti-renderer all use logical grid pathfinding with isometric projection applied only at render time

### What Changes at the Pathfinding Boundary

The **avatar movement** code (in `characters.ts`) currently converts a path step to a screen position for animation. That conversion changes:

```typescript
// Before (flat top-down):
const renderPos = { x: step.tileX * FLAT_TILE_SIZE, y: step.tileY * FLAT_TILE_SIZE };

// After (isometric):
const renderPos = tileToScreen(step.tileX, step.tileY, tileMap[step.tileY][step.tileX].height);
```

That is the entire pathfinding-layer change.

### Direction Calculation for Avatar Facing

When an avatar moves from tile A to tile B, the direction (0-7) must be computed:

```typescript
function getDirection(fromX: number, fromY: number, toX: number, toY: number): number {
  const dx = toX - fromX;  // -1, 0, or 1
  const dy = toY - fromY;  // -1, 0, or 1
  // Habbo direction mapping (diagonal-first as used during walking):
  // dx=1,  dy=0  -> dir 2 (South-East, toward-right)
  // dx=-1, dy=0  -> dir 6 (North-West, away-left)
  // dx=0,  dy=1  -> dir 4 (South-West, toward-left)
  // dx=0,  dy=-1 -> dir 0 (North-East, away-right)
  // dx=1,  dy=1  -> dir 3 (South, toward camera)
  // dx=-1, dy=-1 -> dir 7 (North, away from camera)
  // dx=1,  dy=-1 -> dir 1 (East, right)
  // dx=-1, dy=1  -> dir 5 (West, left)
  const dirMap: Record<string, number> = {
    '1,0': 2, '-1,0': 6, '0,1': 4, '0,-1': 0,
    '1,1': 3, '-1,-1': 7, '1,-1': 1, '-1,1': 5,
  };
  return dirMap[`${dx},${dy}`] ?? 2;
}
```

---

## Nitro Asset Loading (Canvas 2D)

### .nitro Bundle Format

The `.nitro` file is a **custom binary container** — not a standard ZIP. The format uses per-file zlib compression with a BigEndian header structure:

```
[FileCount:UI16]
  [NameLen:UI16][Name][CompressedLen:UI32][ZlibData]
  [NameLen:UI16][Name][CompressedLen:UI32][ZlibData]
  ...
```

Each file entry is individually zlib-compressed. A typical furniture `.nitro` contains two entries:
- `furniture.json` — the sprite manifest (frame names, positions, visualizations, animations)
- `spritesheet.png` — the PNG atlas image

Source: Retrosprite project documentation (github.com/Bopified/Retrosprite)

### JSON Manifest Structure

The `furniture.json` manifest follows Texture Packer "hash" format with Habbo extensions:

```json
{
  "name": "chair_polyrattan",
  "spritesheet": {
    "meta": { "app": "nitro-converter", "image": "spritesheet.png" },
    "frames": {
      "chair_polyrattan_64_a_2_0": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "chair_polyrattan_64_a_4_0": { "x": 64, "y": 0, "w": 64, "h": 64 }
    }
  },
  "assets": {
    "chair_polyrattan_64_a_2_0": { "x": -32, "y": -48 }
  },
  "visualizations": [{
    "angle": 90,
    "size": 64,
    "layers": { "0": { "z": 0 } },
    "directions": { "2": {}, "4": {} },
    "animations": {}
  }]
}
```

**Frame name convention:** `{furni_name}_{size}_{layer}_{direction}_{frame}`
- `size`: `64` (full size) or `32` (small)
- `layer`: `a`, `b`, `c` (visual layer letters, back to front)
- `direction`: Habbo direction 0-7
- `frame`: 0-based animation frame index

**Asset offsets:** The `assets` object maps frame names to `{x, y}` pixel offsets. These are anchor offsets to apply when positioning the sprite relative to the tile's screen origin (typically negative, pulling the sprite up and left from the tile's bottom vertex).

### Extraction Without Full Nitro Stack

**Option A — Build-time extraction (recommended for pixel-agents):**

Parse the `.nitro` binary at build time (Node.js script), output static PNG + JSON files into `webview-ui/public/assets/`. The webview loads them as standard web resources.

```typescript
// Node build script (src/scripts/extractNitro.ts)
import * as fs from 'fs';
import * as zlib from 'zlib';
import { promisify } from 'util';

const inflate = promisify(zlib.inflate);

async function extractNitro(nitroPath: string, outDir: string) {
  const buf = fs.readFileSync(nitroPath);
  let offset = 0;

  const fileCount = buf.readUInt16BE(offset); offset += 2;
  for (let i = 0; i < fileCount; i++) {
    const nameLen = buf.readUInt16BE(offset); offset += 2;
    const name = buf.slice(offset, offset + nameLen).toString('utf8'); offset += nameLen;
    const compLen = buf.readUInt32BE(offset); offset += 4;
    const compressed = buf.slice(offset, offset + compLen); offset += compLen;
    const decompressed = await inflate(compressed);
    fs.writeFileSync(path.join(outDir, name), decompressed);
  }
}
```

**Option B — Runtime in webview (fallback):**

Serve the `.nitro` file as a binary asset, fetch it in the webview, parse it with a small inline parser (same logic as above but using `DecompressionStream` or the `pako` library for browser-side zlib inflate).

```typescript
// webview: runtime parser using pako (3.6 KB gzipped)
import { inflate } from 'pako';

async function loadNitroBundle(url: string): Promise<{ name: string; data: Uint8Array }[]> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buf = new DataView(arrayBuffer);
  const raw = new Uint8Array(arrayBuffer);
  let offset = 0;

  const fileCount = buf.getUint16(offset, false); offset += 2;
  const files: { name: string; data: Uint8Array }[] = [];

  for (let i = 0; i < fileCount; i++) {
    const nameLen = buf.getUint16(offset, false); offset += 2;
    const name = new TextDecoder().decode(raw.slice(offset, offset + nameLen)); offset += nameLen;
    const compLen = buf.getUint32(offset, false); offset += 4;
    const compressed = raw.slice(offset, offset + compLen); offset += compLen;
    files.push({ name, data: inflate(compressed) });
  }
  return files;
}
```

### Canvas 2D drawImage Integration

Once the PNG atlas is extracted to an `HTMLImageElement` and the JSON manifest is parsed into a frame map, usage in Canvas 2D is straightforward:

```typescript
// Atlas lookup table (built once at load time)
type FrameMap = Record<string, { x: number; y: number; w: number; h: number }>;
type OffsetMap = Record<string, { x: number; y: number }>;

function drawFurniFrame(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement,
  frames: FrameMap,
  offsets: OffsetMap,
  frameKey: string,   // e.g. "chair_polyrattan_64_a_2_0"
  tileScreenX: number,
  tileScreenY: number,
): void {
  const frame = frames[frameKey];
  const offset = offsets[frameKey] ?? { x: 0, y: 0 };
  if (!frame) return;
  ctx.drawImage(
    atlas,
    frame.x, frame.y, frame.w, frame.h,         // source region in atlas
    tileScreenX + offset.x, tileScreenY + offset.y, frame.w, frame.h, // dest on canvas
  );
}
```

**PNG with double base64 encoding:** Some SWF-converted assets encode the PNG data as base64 inside the JSON rather than as a separate binary file. Retrosprite detects this via the `"YVZa"` prefix on the base64 string (the Habbo SWF bitmap signature). If building a custom extraction path, decode the base64 and write the PNG file after stripping this prefix.

### Pre-Extracted Asset Repositories (Fastest Path)

Instead of running the extraction pipeline yourself:

- **sphynxkitten/nitro-assets** — community-maintained collection of pre-extracted `.nitro` bundles. The static files (PNG + JSON pairs) are immediately usable with the `drawImage` approach above.
- **Retrosprite** — GUI editor (Electron, 2026) for viewing and editing Nitro bundles; useful for inspecting and validating frame data.

---

## Build Order

### Recommended Phase Sequence

The dependency graph for the rendering change has a strict order because each phase's output is an input to the next:

```
Phase 1 — Coordinate Module (isometricMath.ts)
  No dependencies. Pure functions: tileToScreen, screenToTile, getDirection.
  Produces: the math layer that every other module uses.
  Test: unit-test each formula against known values.

Phase 2 — Tile + Wall Renderer (isoTileRenderer.ts)
  Depends on: Phase 1 (tileToScreen).
  Replaces: flat drawTile() calls in renderer.ts.
  Implements: draw floor rhombus (Canvas 2D path), draw left/right wall strips,
              draw stair risers, depth-sort pass.
  Test: render a static heightmap string and compare pixel output.

Phase 3 — Asset Loader + Sprite Cache (isoAssetLoader.ts, isoSpriteCache.ts)
  Depends on: .nitro extraction scripts (offline) OR pre-extracted PNG/JSON files.
  Replaces: existing assetLoader.ts and spriteCache.ts.
  Implements: parse JSON frame manifest -> FrameMap, load PNG atlas -> HTMLImageElement,
              cache by atlas name + frame key.
  Test: load a known .nitro bundle, verify frame lookup returns correct {x,y,w,h}.

Phase 4 — Furniture Renderer (isoFurnitureRenderer.ts)
  Depends on: Phase 1 (tileToScreen), Phase 3 (frame lookup).
  Replaces: flat furniture draw calls in renderer.ts.
  Implements: furni drawImage with offset, rotation direction selection,
              multi-tile furni footprint, insert into depth-sort list.
  Test: place a chair at (2,3) direction 2, verify correct frame drawn at correct screen pos.

Phase 5 — Avatar Renderer (isoAvatarRenderer.ts)
  Depends on: Phase 1 (tileToScreen, getDirection), Phase 3 (sprite cache).
  Replaces: flat character draw calls in characters.ts.
  Implements: 8-direction body-part layer composition, 4-frame walk cycle,
              idle blink overlay, direction updates on BFS path steps.
  Test: step avatar through 4 BFS path nodes, verify direction and frame advance.

Phase 6 — UI Layer (isoBubbleRenderer.ts, isoNameTagRenderer.ts)
  Depends on: Phase 1 (tileToScreen for anchor point).
  Replaces: flat speech bubble and name tag draws.
  Implements: rounded-rect bubble with tail, animated "..." dots, pill name tag,
              status dot colour. Drawn after all depth-sorted items (always on top).
  Test: toggle avatar state to "waiting", verify "..." bubble appears above avatar head.

Phase 7 — Layout Editor Hit Detection (isoLayoutEditor.ts)
  Depends on: Phase 1 (screenToTile), Phase 2 (tile rendering).
  Replaces: flat mouse->tile mapping in layout editor.
  Implements: two-step mouse->tile conversion (see Hit Detection section below),
              tile highlight rhombus draw, wall tile selection disambiguation.
  Test: click at known screen pixel, verify correct tile [x,y] highlighted.
```

### Why This Order

- Phases 1-2 unblock visual validation: you can see the room grid before any sprites load.
- Phase 3 is parallelizable with Phase 2 but must complete before Phases 4-5.
- Phases 4-5 can be built in parallel once Phases 1 and 3 are done.
- Phase 6 has no sprite dependency (drawn with Canvas 2D primitives) but logically comes after avatars.
- Phase 7 (editor) is last because it depends on the tile render size being finalized.

This order matches the guidance from the isometric game development primer (tutsplus.com) which recommends: coordinate math -> static rendering -> entity placement -> depth sorting -> interaction.

---

## Isometric Layout Editor Hit Detection

### The Core Problem

In the flat renderer, mouse->tile is trivial:
```typescript
// Flat (old):
const tileX = Math.floor(mouseX / FLAT_TILE_SIZE);
const tileY = Math.floor(mouseY / FLAT_TILE_SIZE);
```

In isometric, tiles are diamond-shaped rhombuses. Each tile's bounding rectangle overlaps four adjacent tiles. A click inside the bounding rectangle may actually target any of those four tiles.

### Step 1: Coarse Tile Estimate (Direct Inverse Transform)

Apply the `screenToTile` inverse formula to get a floating-point grid coordinate, then floor to integer:

```typescript
function mouseToTile(
  mouseX: number, mouseY: number,
  cameraOffsetX: number, cameraOffsetY: number
): { tileX: number; tileY: number } {
  const adjX = mouseX - cameraOffsetX;
  const adjY = mouseY - cameraOffsetY;

  // Inverse of tileToScreen (at z=0):
  const rawX = adjX / TILE_W + adjY / TILE_H;
  const rawY = adjY / TILE_H - adjX / TILE_W;

  return {
    tileX: Math.floor(rawX),
    tileY: Math.floor(rawY),
  };
}
```

For flat-floor rooms (all tiles at `tileZ = 0`), this formula is exact and requires no further correction. The formula is verified by clintbellanger.net and confirmed correct by the nick-aschenbach isometric tile engine implementation.

### Step 2: Elevation Correction

When tiles have non-zero height (Habbo stair steps), the tile rendered on screen is shifted upward by `tileZ * TILE_H_HALF` pixels. Without correction, a click on an elevated tile will report the wrong tile because the inverse formula assumes z=0.

Two strategies:

**Strategy A — Height-aware iteration (robust):**

After the coarse estimate gives candidate `(cx, cy)`, also check `(cx, cy+1)`, `(cx+1, cy)`, and `(cx-1, cy-1)` (the tiles whose screen projection could overlap the click point due to height). For each candidate, project it to screen using its actual height, then test whether the mouse falls within the rhombus shape.

**Strategy B — Ignore height during editing (acceptable for pixel-agents scope):**

The Habbo layout editor itself operates at the tile grid level — users paint tiles and set height values. During editing, render with heights for visual feedback, but compute mouse picking assuming z=0. When the user clicks on a visually elevated stair, the click lands slightly "below" the elevated tile's visual position, which maps to the correct grid cell at z=0. This gives correct behavior for all walkable tiles and only misfires for clicks on the visual face of a riser (the vertical wall face of a stair step), which is rarely a meaningful interaction in an editor.

**Recommendation:** Strategy B for the pixel-agents layout editor scope. Implement Strategy A only if elevated tile selection feels unreliable during testing.

### Step 3: Sub-Tile Rhombus Test (Pixel-Perfect Refinement)

For pixel-perfect picking (no pixel mask required), test whether the mouse is inside the diamond shape using the fractional part of the raw coordinate:

```typescript
function isInsideRhombus(rawX: number, rawY: number): boolean {
  // fracX and fracY are 0..1 within the tile's grid cell
  const fracX = rawX - Math.floor(rawX);
  const fracY = rawY - Math.floor(rawY);
  // The rhombus condition: the point must be inside the diamond
  // For a 2:1 isometric diamond, the rhombus bounds test is:
  return Math.abs(fracX - 0.5) + Math.abs(fracY - 0.5) < 0.5;
}
```

If `isInsideRhombus` returns false, the click is in the "gap" between four tiles. Determine which of the four surrounding tiles the click is closest to and use that as the selected tile.

### Wall Tile Hit Detection

Wall strips in the Habbo layout editor are typically not independently selectable — the user selects a floor tile and the editor infers wall placement from the room boundary. If wall selection is needed (e.g., for placing wall furniture), the wall strip is a screen-space rectangle at a fixed position relative to the floor tile. Hit-test the wall rectangle directly in screen space before running the floor tile test.

### Tile Highlight Rendering

To highlight the hovered tile, draw the rhombus outline on top of the sorted render list:

```typescript
function drawTileHighlight(
  ctx: CanvasRenderingContext2D,
  tileX: number, tileY: number, tileZ: number,
  cameraOffsetX: number, cameraOffsetY: number
): void {
  const { x, y } = tileToScreen(tileX, tileY, tileZ);
  const sx = x + cameraOffsetX;
  const sy = y + cameraOffsetY;

  ctx.beginPath();
  ctx.moveTo(sx,                  sy - TILE_H_HALF);  // top vertex
  ctx.lineTo(sx + TILE_W_HALF,    sy);                // right vertex
  ctx.lineTo(sx,                  sy + TILE_H_HALF);  // bottom vertex
  ctx.lineTo(sx - TILE_W_HALF,    sy);                // left vertex
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255, 255, 100, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
}
```

---

## Sources

### Primary (HIGH confidence — official sources and verified implementations)
- clintbellanger.net/articles/isometric_math/ — Isometric coordinate transform formulas (grid↔screen)
- nick-aschenbach.github.io/blog/2015/02/25/isometric-tile-engine/ — Tile-to-screen and mouse-to-tile formula with Canvas 2D
- shaunlebron.github.io/IsometricBlocks/ — Depth sorting algorithm (painter's algorithm + topological sort)
- github.com/Bopified/Retrosprite — .nitro binary format specification (BigEndian, per-file zlib)
- github.com/mathishouis/scuti-renderer — Habbo rendering pipeline reference (TypeScript + PixiJS)
- github.com/jankuss/shroom — Room rendering engine architecture (PixiJS, wall generation from heightmap)
- github.com/Josedn/bobba_client — Depth sorting pattern ("farther elements first")
- FEATURES.md (this project) — Confirmed: BFS unchanged, tile constants, direction system, depth sort key formula

### Secondary (MEDIUM confidence — community-verified)
- code.tutsplus.com — Build order recommendation (coordinate math → tiles → entities → depth sort → interaction)
- gamedevelopment.tutsplus.com — Cartesian↔isometric conversion (2-step: Cartesian-to-isometric, isometric-to-tile)
- devbest.com/threads/retrosprite — .nitro extraction workflow (contains PNG + JSON, extractable)
- gamedev.net/forums/topic/635921 — Staggered isometric tile picking, height correction strategies

### Tertiary (LOW confidence — supplementary context)
- github.com/sphynxkitten/nitro-assets — Pre-extracted asset repository existence (community-maintained)
- html5gamedevs.com — EasyStar.js pathfinding on isometric grids (BFS/A* in grid space only)
