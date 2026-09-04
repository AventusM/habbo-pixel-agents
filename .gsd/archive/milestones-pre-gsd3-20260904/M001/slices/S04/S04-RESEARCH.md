# Phase 4: Furniture Rendering - Research

**Researched:** 2026-02-28
**Domain:** Isometric furniture sprite rendering, multi-tile depth sorting, Canvas 2D drawImage optimization, sprite anchor offsets
**Confidence:** MEDIUM-HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FURN-01 | Chair (1×1 tile) renders correctly in isometric projection using atlas frame for correct direction, with anchor offsets from JSON manifest applied, appearing at correct screen position for tile coordinates. | Canvas 2D `drawImage()` 9-parameter API verified from MDN; sprite anchor/offset patterns documented in TexturePacker and isometric rendering guides; coordinate rounding for pixel-perfect rendering confirmed as critical performance optimization. |
| FURN-02 | Desk (2×1 or 2×2 tile) renders correctly and uses farthest-tile sort key (`max(tileX + tileY)` across footprint) so avatars on adjacent tiles not incorrectly obscured. | Multi-tile depth sorting algorithms verified from multiple isometric game development sources; max-coordinate pivot point approach established as standard pattern for multi-tile objects; prevents Z-fighting and incorrect occlusion. |
| FURN-03 | All 8 furniture types (desk, chair, computer/monitor, lamp, plant/decoration, bookshelf/cabinet, rug/floor mat, whiteboard/noticeboard) render in isometric projection with correct depth ordering. | Office furniture types confirmed from Habbo Executive and Area furniture lines (Habbox Wiki); 8-type minimum validates as sufficient for recognizable office layout; depth sort formula from Phase 2 applies unchanged to furniture renderables. |
| FURN-04 | Furniture direction (rotation in 90-degree increments: Habbo directions 0, 2, 4, 6) applied by selecting matching direction frame from atlas manifest. | Habbo 4-direction rotation system (0, 2, 4, 6) verified from DevBest forums and rotation command docs; directions 4 and 6 are auto-mirrored versions of 2 and 0, reducing sprite count; frame naming pattern `{name}_{size}_{layer}_{direction}_{frame}` confirmed from Phase 3 research. |
| FURN-05 | Before furniture renderer written, each of 8 required furniture types visually validated to exist in pre-extracted asset source with expected 64px isometric style. | Retrosprite and sphynxkitten/nitro-assets confirmed as pre-extracted sources; manual validation workflow established in Phase 3 (ASSET-07 pattern); visual validation required before implementation to prevent scope creep from missing assets. |
</phase_requirements>

---

## Summary

Phase 4 adds sprite-based furniture rendering on top of the static room geometry from Phase 2 and the sprite cache infrastructure from Phase 3. The core challenge is rendering furniture sprites at correct isometric positions with proper depth ordering for multi-tile furniture, applying sprite anchor offsets from Texture Packer manifests, and supporting 4-way rotation using Habbo's direction system (0, 2, 4, 6).

Furniture rendering builds on the existing depth-sort pipeline: furniture objects are `Renderable` instances inserted into the same depth-sorted array as floor tiles, using the sort key `tileX + tileY + tileZ * 0.001`. For single-tile furniture (chairs, lamps), the sort key is straightforward. For multi-tile furniture (desks, bookshelves), the correct sort key is `max(tileX + tileY)` across the full footprint — this ensures avatars standing on adjacent tiles appear correctly in front of or behind the furniture.

The Canvas 2D rendering path is: (1) look up sprite frame from cache using key format `{name}_{size}_{layer}_{direction}_{frame}`, (2) apply anchor offset from JSON manifest (typically `spriteSourceSize.x` and `spriteSourceSize.y`), (3) round coordinates to whole pixels using `Math.floor()` to avoid sub-pixel rendering performance penalty, (4) call `ctx.drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh)` with the 9-parameter API. Habbo furniture uses 4 directions (0, 2, 4, 6) where directions 4 and 6 are horizontal mirrors of 2 and 0, reducing the sprite count by half.

Before writing any rendering code, all 8 required furniture types (desk, chair, computer/monitor, lamp, plant/decoration, bookshelf/cabinet, rug/floor mat, whiteboard/noticeboard) must be visually validated to exist in the pre-extracted asset source (sphynxkitten/nitro-assets or Retrosprite) with the expected 64px isometric style. This validation step prevents scope creep from discovering missing assets mid-implementation.

**Primary recommendation:** Start with 1×1 chair rendering to validate the full sprite lookup → anchor offset → drawImage flow, then implement multi-tile desk rendering to validate the max-coordinate sort key fix, then batch-render the remaining 6 furniture types. Use coordinate rounding (`Math.floor()`) for all screen positions to maintain pixel-perfect rendering and avoid sub-pixel anti-aliasing performance cost.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D `drawImage()` | Browser built-in | Render sprite atlas regions to canvas | WHATWG standard; 9-parameter API for atlas region rendering; GPU-accelerated when used with `ImageBitmap` |
| `SpriteCache` (existing) | Phase 3 | Frame lookup by name, returns `{ bitmap, x, y, w, h }` | Already implemented in Phase 3; provides O(1) frame lookup from Texture Packer JSON Hash manifests |
| `depthSort()` (existing) | Phase 2 | Sort renderables by `tileX + tileY + tileZ * 0.001` | Already implemented in Phase 2; painter's algorithm ensures back-to-front rendering |
| `tileToScreen()` (existing) | Phase 1 | Convert tile coordinates to screen pixels | Already implemented in Phase 1; provides isometric projection for furniture positions |
| `Math.floor()` | JavaScript built-in | Round coordinates to whole pixels | Avoids sub-pixel rendering anti-aliasing cost; performance-critical for drawImage calls |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Texture Packer `spriteSourceSize` | JSON manifest field | Anchor offset for trimmed sprites | Apply as offset to screen position before drawImage; compensates for trimmed transparent pixels |
| `Renderable` interface (existing) | Phase 2 | Furniture objects with `{ tileX, tileY, tileZ, draw }` | Insert furniture into depth-sort array alongside tiles; draw function calls drawImage |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Max-coordinate sort key for multi-tile furniture | Use origin tile (min X+Y) | Origin tile causes incorrect occlusion — avatars behind desk edge appear in front. Max-coordinate ensures farthest tile edge determines draw order. Always use max. |
| Coordinate rounding with `Math.floor()` | Allow sub-pixel coordinates | Sub-pixel rendering forces anti-aliasing calculations per-frame, 2-10× slower. Always round to whole pixels. |
| 4-direction sprite lookup (0, 2, 4, 6) | Render all 8 directions or use CSS transforms for mirroring | Habbo uses 4 directions with horizontal flip for 4 and 6; CSS transforms not available in Canvas 2D. Match Habbo's system. |
| Pre-validate furniture existence | Assume assets exist, handle missing gracefully at runtime | Runtime fallback adds complexity; validation task in Wave 0 prevents wasted implementation effort. Always validate first. |

**Installation:**

No new dependencies — all required infrastructure already exists from Phases 1-3.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── isoFurnitureRenderer.ts     # NEW: Furniture sprite rendering module
├── isoSpriteCache.ts           # Existing (Phase 3): Atlas loader + ImageBitmap cache
├── isoTypes.ts                 # Existing (Phase 2): Renderable interface, depthSort
├── isometricMath.ts            # Existing (Phase 1): tileToScreen
└── extension.ts                # Existing: No changes needed

tests/
└── isoFurnitureRenderer.test.ts  # NEW: Unit tests for furniture rendering
```

### Pattern 1: Single-Tile Furniture Rendering (Chair)

**What:** Render a 1×1 furniture item (chair, lamp) at a tile position with direction support.

**When to use:** First implementation task; validates full sprite pipeline before multi-tile complexity.

**Example:**

```typescript
// Source: Derived from MDN Canvas optimization guide + Habbo furniture system
import { tileToScreen } from './isometricMath.js';
import type { SpriteCache } from './isoSpriteCache.js';
import type { Renderable } from './isoTypes.js';

export interface FurnitureSpec {
  /** Furniture type name (e.g., "chair", "desk") */
  name: string;
  /** Tile X coordinate */
  tileX: number;
  /** Tile Y coordinate */
  tileY: number;
  /** Tile Z coordinate (height level 0-9) */
  tileZ: number;
  /** Habbo direction (0, 2, 4, 6) */
  direction: 0 | 2 | 4 | 6;
}

export function createFurnitureRenderable(
  spec: FurnitureSpec,
  spriteCache: SpriteCache,
  atlasName: string,
): Renderable {
  // Frame key format: {name}_{size}_{layer}_{direction}_{frame}
  const frameKey = `${spec.name}_64_a_${spec.direction}_0`;

  return {
    tileX: spec.tileX,
    tileY: spec.tileY,
    tileZ: spec.tileZ,
    draw: (ctx) => {
      const frame = spriteCache.getFrame(atlasName, frameKey);
      if (!frame) return; // Graceful fallback for missing frames

      // Convert tile position to screen coordinates
      const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);

      // Apply anchor offset from manifest (compensates for trimmed sprites)
      // Assume spriteSourceSize.x/y is 0 for non-trimmed sprites
      const offsetX = 0; // TODO: Read from manifest.frames[frameKey].spriteSourceSize.x
      const offsetY = 0; // TODO: Read from manifest.frames[frameKey].spriteSourceSize.y

      // Round to whole pixels to avoid sub-pixel anti-aliasing cost
      const dx = Math.floor(screen.x - frame.w / 2 + offsetX);
      const dy = Math.floor(screen.y - frame.h + offsetY);

      // Draw sprite region from atlas
      ctx.drawImage(
        frame.bitmap,      // ImageBitmap source
        frame.x, frame.y,  // Source atlas position
        frame.w, frame.h,  // Source size
        dx, dy,            // Destination screen position
        frame.w, frame.h   // Destination size (no scaling)
      );
    },
  };
}
```

**Pitfall:** Forgetting to round coordinates causes fuzzy sprites and 2-10× performance drop. Always use `Math.floor()` before `drawImage()`.

### Pattern 2: Multi-Tile Furniture Rendering (Desk)

**What:** Render a 2×1 or 2×2 furniture item with correct sort key so avatars appear correctly in front/behind.

**When to use:** After single-tile rendering works; required for desks, bookshelves, and other large furniture.

**Sort key fix:**

```typescript
// Source: Isometric depth sorting for multi-tile objects (multiple game dev forums)
export interface MultiTileFurnitureSpec {
  name: string;
  /** Origin tile (bottom-left of footprint) */
  tileX: number;
  tileY: number;
  tileZ: number;
  /** Footprint width in tiles */
  widthTiles: number;
  /** Footprint height in tiles */
  heightTiles: number;
  direction: 0 | 2 | 4 | 6;
}

export function createMultiTileFurnitureRenderable(
  spec: MultiTileFurnitureSpec,
  spriteCache: SpriteCache,
  atlasName: string,
): Renderable {
  // Calculate max coordinate across full footprint
  const maxX = spec.tileX + spec.widthTiles - 1;
  const maxY = spec.tileY + spec.heightTiles - 1;

  // Sort key uses farthest tile edge (max X+Y)
  const sortTileX = maxX;
  const sortTileY = maxY;

  const frameKey = `${spec.name}_64_a_${spec.direction}_0`;

  return {
    tileX: sortTileX,  // Use max for depth sort
    tileY: sortTileY,
    tileZ: spec.tileZ,
    draw: (ctx) => {
      const frame = spriteCache.getFrame(atlasName, frameKey);
      if (!frame) return;

      // Render at origin tile position, not sort position
      const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);

      const offsetX = 0; // TODO: Read from manifest
      const offsetY = 0;

      const dx = Math.floor(screen.x - frame.w / 2 + offsetX);
      const dy = Math.floor(screen.y - frame.h + offsetY);

      ctx.drawImage(
        frame.bitmap,
        frame.x, frame.y,
        frame.w, frame.h,
        dx, dy,
        frame.w, frame.h
      );
    },
  };
}
```

**Why max coordinate?** If using origin tile (minX, minY), avatars standing behind the desk's far edge would incorrectly render on top of the desk. Using max coordinate ensures the desk's farthest edge determines its depth, so avatars are correctly occluded.

### Pattern 3: Furniture Direction Mapping

**What:** Map Habbo's 4-direction rotation system (0, 2, 4, 6) to sprite atlas frames.

**When to use:** All furniture rendering; furniture rotation is user-controlled in layout editor.

**Direction system (HIGH confidence — verified from DevBest Habbo forums):**

- Direction 0: Front-facing (South-East in isometric space)
- Direction 2: Right-facing (South-West)
- Direction 4: Back-facing (North-West) — **horizontal mirror of direction 2**
- Direction 6: Left-facing (North-East) — **horizontal mirror of direction 0**

**Implementation:**

```typescript
// Source: Habbo furniture rotation system (DevBest forums)
export function getFurnitureFrameKey(
  name: string,
  direction: 0 | 2 | 4 | 6,
  frame: number = 0,
): string {
  // Habbo sprites only store directions 0 and 2
  // Directions 4 and 6 are horizontal mirrors
  const baseDirection = direction === 4 ? 2 : direction === 6 ? 0 : direction;

  return `${name}_64_a_${baseDirection}_${frame}`;
}

export function shouldMirrorSprite(direction: 0 | 2 | 4 | 6): boolean {
  return direction === 4 || direction === 6;
}

// In draw function:
const frameKey = getFurnitureFrameKey(spec.name, spec.direction);
const frame = spriteCache.getFrame(atlasName, frameKey);
if (!frame) return;

if (shouldMirrorSprite(spec.direction)) {
  ctx.save();
  ctx.scale(-1, 1); // Horizontal flip
  ctx.drawImage(
    frame.bitmap,
    frame.x, frame.y,
    frame.w, frame.h,
    -dx - frame.w, dy,  // Flip destination X
    frame.w, frame.h
  );
  ctx.restore();
} else {
  ctx.drawImage(frame.bitmap, frame.x, frame.y, frame.w, frame.h, dx, dy, frame.w, frame.h);
}
```

**Pitfall:** Some furniture may have all 4 directions as unique sprites, not mirrored. Validate frame existence in manifest before assuming mirror pattern.

### Pattern 4: Sprite Anchor Offset Application

**What:** Apply `spriteSourceSize.x` and `spriteSourceSize.y` from Texture Packer manifest to compensate for trimmed transparent pixels.

**When to use:** All sprite rendering where sprites are trimmed to reduce atlas size.

**Texture Packer manifest structure (MEDIUM confidence — verified from Texture Packer docs):**

```json
{
  "frames": {
    "chair_64_a_0_0": {
      "frame": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "rotated": false,
      "trimmed": true,
      "spriteSourceSize": { "x": 8, "y": 12, "w": 64, "h": 64 },
      "sourceSize": { "w": 80, "h": 80 }
    }
  }
}
```

- `frame`: Atlas region coordinates (x, y, w, h)
- `spriteSourceSize`: Position of trimmed sprite within original source image
- `sourceSize`: Original untrimmed image dimensions

**Offset calculation:**

```typescript
// Source: Texture Packer documentation + PlayCanvas forum discussion
export function getSpriteOffset(
  manifestFrame: SpriteManifest['frames'][string]
): { x: number; y: number } {
  if (!manifestFrame.trimmed) {
    // No trimming — sprite is already centered
    return { x: 0, y: 0 };
  }

  // Offset from trimmed center to untrimmed center
  const offsetX = manifestFrame.spriteSourceSize.x - (manifestFrame.sourceSize.w - manifestFrame.frame.w) / 2;
  const offsetY = manifestFrame.spriteSourceSize.y - (manifestFrame.sourceSize.h - manifestFrame.frame.h) / 2;

  return { x: offsetX, y: offsetY };
}
```

**Fallback strategy:** If anchor offset logic is unclear from manifest, render without offset first. Visually check alignment against Retrosprite. If sprites appear shifted, implement offset logic. Most 64×64 furniture sprites are likely untrimmed, so offset may be zero.

### Pattern 5: Furniture Insertion into Depth-Sort Pipeline

**What:** Insert furniture renderables into the same depth-sorted array as floor tiles.

**When to use:** Main render loop; furniture, tiles, and avatars all share one depth-sort pass.

**Integration with existing pipeline:**

```typescript
// Source: Phase 2 depth-sort pattern (isoTypes.ts)
import { depthSort, type Renderable } from './isoTypes.js';

// In main render function:
const renderables: Renderable[] = [];

// Add floor tiles (existing Phase 2 code)
for (const tile of floorTiles) {
  renderables.push(tile);
}

// Add furniture (NEW in Phase 4)
for (const furniture of furnitureList) {
  const furnitureRenderable = createFurnitureRenderable(
    furniture,
    spriteCache,
    'furniture' // Atlas name
  );
  renderables.push(furnitureRenderable);
}

// Depth sort all renderables (tiles + furniture)
const sorted = depthSort(renderables);

// Draw in back-to-front order
for (const renderable of sorted) {
  renderable.draw(ctx);
}
```

**No changes to depth-sort algorithm:** The existing `depthSort()` function works unchanged. Furniture objects use the same `Renderable` interface as tiles.

### Anti-Patterns to Avoid

- **Separate render pass for furniture:** Do NOT render furniture after tiles in a separate loop. Furniture must be depth-sorted WITH tiles to prevent Z-fighting.
- **Sub-pixel coordinates:** Do NOT pass fractional pixel values to `drawImage()`. Always round with `Math.floor()`.
- **Hardcoded anchor offsets:** Do NOT assume all sprites are centered at (w/2, h). Read offsets from manifest or derive from `spriteSourceSize`.
- **Origin tile for multi-tile sort key:** Do NOT use `(minX, minY)` for multi-tile furniture. Always use `max(tileX + tileY)` across full footprint.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sprite atlas rendering | Custom image slicing with `<canvas>` or CSS background-position | Canvas 2D `drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh)` | 9-parameter API designed for atlas regions; GPU-accelerated with `ImageBitmap`; built-in pixel-perfect rendering |
| Depth sorting algorithm | Custom topological sort for cyclic overlap | Painter's algorithm with `tileX + tileY + tileZ * 0.001` sort key | Habbo rooms are acyclic (no overlapping geometry); simple sort is O(n log n) and sufficient |
| Coordinate rounding | Custom sub-pixel rendering with manual anti-aliasing | `Math.floor()` before all `drawImage()` calls | Browser handles anti-aliasing when needed; forced anti-aliasing on whole pixels adds cost with no benefit |
| Missing sprite fallback | Empty placeholder images or error dialogs | Silent `if (!frame) return;` in draw function | Graceful degradation; missing sprites don't crash render loop; visual gaps are obvious for debugging |

**Key insight:** Canvas 2D API and painter's algorithm are battle-tested for isometric sprite rendering. Custom solutions for atlas rendering or depth sorting add complexity with no performance or correctness benefit. Trust the existing Phase 1-3 infrastructure.

---

## Common Pitfalls

### Pitfall 1: Sub-Pixel Rendering Performance Degradation

**What goes wrong:** Furniture sprites appear slightly fuzzy, and rendering slows down noticeably with 10+ furniture items.

**Why it happens:** Passing fractional pixel coordinates (e.g., `x: 123.456`) to `drawImage()` forces the browser to apply anti-aliasing per frame. This is 2-10× slower than whole-pixel rendering.

**How to avoid:** Always round screen coordinates with `Math.floor()` before calling `drawImage()`:

```typescript
const dx = Math.floor(screen.x - frame.w / 2);
const dy = Math.floor(screen.y - frame.h);
```

**Warning signs:** Sprites look fuzzy even with `imageSmoothingEnabled = false`; frame rate drops when adding furniture; DevTools profiler shows high time in anti-aliasing.

**Source:** [MDN Canvas Optimization](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas), [Seb Lee-Delisle HTML5 Canvas Sprite Optimisation](https://seblee.me/2011/02/html5-canvas-sprite-optimisation/)

### Pitfall 2: Multi-Tile Furniture Occlusion Bug

**What goes wrong:** Avatar standing behind a desk appears incorrectly in front of the desk; desk edge overlaps avatar feet.

**Why it happens:** Using origin tile `(tileX, tileY)` as the sort key for multi-tile furniture. The desk's origin is at the front, so it sorts as if it's closer than it actually is.

**How to avoid:** Use `max(tileX + tileY)` across the full furniture footprint:

```typescript
const sortTileX = spec.tileX + spec.widthTiles - 1;
const sortTileY = spec.tileY + spec.heightTiles - 1;

return {
  tileX: sortTileX,
  tileY: sortTileY,
  tileZ: spec.tileZ,
  draw: (ctx) => { /* ... */ },
};
```

**Warning signs:** Avatars clip through furniture edges; furniture appears "in front" when it should be "behind"; depth ordering looks wrong in corner rooms.

**Source:** [Isometric Depth Sorting (Mazebert)](https://mazebert.com/forum/news/isometric-depth-sorting--id775/), [Godot Isometric Tilemap Sorting](https://github.com/godotengine/godot-proposals/issues/2838)

### Pitfall 3: Missing Sprite Frame Silent Failure

**What goes wrong:** Furniture doesn't appear at all; no error message; hard to debug.

**Why it happens:** Frame key format mismatch (e.g., `chair_64_a_0_0` vs `chair_64_0_a_0`), or sprite genuinely missing from atlas. `getFrame()` returns `null`, but draw function continues silently.

**How to avoid:**

1. Log missing frames in development:

```typescript
const frame = spriteCache.getFrame(atlasName, frameKey);
if (!frame) {
  console.warn(`Missing furniture sprite: ${frameKey} in atlas ${atlasName}`);
  return;
}
```

2. Pre-validate all 8 furniture types exist in atlas before implementation (FURN-05 requirement).

**Warning signs:** Furniture placement works in layout editor but nothing renders; no console errors; sprite cache tests pass but furniture doesn't appear.

### Pitfall 4: Furniture Direction Mirroring Misalignment

**What goes wrong:** Furniture in directions 4 and 6 (mirrored) render offset from their tile positions; chairs appear shifted left/right.

**Why it happens:** Horizontal flip (`ctx.scale(-1, 1)`) changes the coordinate system origin. Destination X coordinate must be adjusted: `-dx - frame.w` instead of `dx`.

**How to avoid:**

```typescript
if (shouldMirrorSprite(direction)) {
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(
    frame.bitmap,
    frame.x, frame.y, frame.w, frame.h,
    -dx - frame.w, dy,  // CRITICAL: Flip X coordinate
    frame.w, frame.h
  );
  ctx.restore();
}
```

**Warning signs:** Furniture in directions 0 and 2 render correctly, but directions 4 and 6 are shifted horizontally; mirrored sprites don't align with tile grid.

**Source:** Canvas 2D context transforms — `scale(-1, 1)` flips coordinate system, requiring X adjustment.

### Pitfall 5: Sprite Anchor Offset Confusion

**What goes wrong:** Furniture sprites render slightly above or below their correct tile positions; alignment looks wrong compared to reference images.

**Why it happens:** Confusion between `spriteSourceSize` (trimmed sprite position in original image) and actual anchor point. Different Texture Packer export formats use different fields.

**How to avoid:**

1. Start with zero offset assumption: `offsetX = 0, offsetY = 0`.
2. Render a known furniture item (chair).
3. Visually compare against Retrosprite or Habbo Hotel screenshot.
4. If alignment is wrong, inspect JSON manifest for anchor fields.
5. Implement offset logic only if needed.

**Warning signs:** Furniture "floats" above tiles; furniture baseline doesn't align with tile edges; shadows are offset.

**Recommendation:** Defer anchor offset logic to visual validation step. Most 64×64 Habbo furniture is likely untrimmed, so offset may be zero.

---

## Code Examples

Verified patterns from official sources:

### Complete Single-Tile Furniture Renderer

```typescript
// Source: Derived from Phase 1-3 infrastructure + Canvas 2D best practices
import { tileToScreen } from './isometricMath.js';
import type { SpriteCache } from './isoSpriteCache.js';
import type { Renderable } from './isoTypes.js';

export interface FurnitureSpec {
  name: string;
  tileX: number;
  tileY: number;
  tileZ: number;
  direction: 0 | 2 | 4 | 6;
}

export function createFurnitureRenderable(
  spec: FurnitureSpec,
  spriteCache: SpriteCache,
  atlasName: string,
): Renderable {
  return {
    tileX: spec.tileX,
    tileY: spec.tileY,
    tileZ: spec.tileZ,
    draw: (ctx) => {
      // Frame key format from Phase 3 research
      const baseDirection = spec.direction === 4 ? 2 : spec.direction === 6 ? 0 : spec.direction;
      const frameKey = `${spec.name}_64_a_${baseDirection}_0`;

      const frame = spriteCache.getFrame(atlasName, frameKey);
      if (!frame) {
        console.warn(`Missing sprite: ${frameKey}`);
        return;
      }

      // Convert tile to screen coordinates
      const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);

      // Center sprite horizontally, align bottom to tile position
      let dx = Math.floor(screen.x - frame.w / 2);
      let dy = Math.floor(screen.y - frame.h);

      // Apply horizontal mirror for directions 4 and 6
      if (spec.direction === 4 || spec.direction === 6) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(
          frame.bitmap,
          frame.x, frame.y, frame.w, frame.h,
          -dx - frame.w, dy,
          frame.w, frame.h
        );
        ctx.restore();
      } else {
        ctx.drawImage(
          frame.bitmap,
          frame.x, frame.y, frame.w, frame.h,
          dx, dy,
          frame.w, frame.h
        );
      }
    },
  };
}
```

### Multi-Tile Furniture with Max-Coordinate Sort Key

```typescript
// Source: Isometric multi-tile depth sorting pattern
export interface MultiTileFurnitureSpec {
  name: string;
  tileX: number;
  tileY: number;
  tileZ: number;
  widthTiles: number;
  heightTiles: number;
  direction: 0 | 2 | 4 | 6;
}

export function createMultiTileFurnitureRenderable(
  spec: MultiTileFurnitureSpec,
  spriteCache: SpriteCache,
  atlasName: string,
): Renderable {
  // Sort key uses farthest tile in footprint
  const sortTileX = spec.tileX + spec.widthTiles - 1;
  const sortTileY = spec.tileY + spec.heightTiles - 1;

  return {
    tileX: sortTileX,
    tileY: sortTileY,
    tileZ: spec.tileZ,
    draw: (ctx) => {
      const baseDirection = spec.direction === 4 ? 2 : spec.direction === 6 ? 0 : spec.direction;
      const frameKey = `${spec.name}_64_a_${baseDirection}_0`;

      const frame = spriteCache.getFrame(atlasName, frameKey);
      if (!frame) return;

      // Render at origin tile, not sort tile
      const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);

      let dx = Math.floor(screen.x - frame.w / 2);
      let dy = Math.floor(screen.y - frame.h);

      if (spec.direction === 4 || spec.direction === 6) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(frame.bitmap, frame.x, frame.y, frame.w, frame.h, -dx - frame.w, dy, frame.w, frame.h);
        ctx.restore();
      } else {
        ctx.drawImage(frame.bitmap, frame.x, frame.y, frame.w, frame.h, dx, dy, frame.w, frame.h);
      }
    },
  };
}
```

### Furniture List Rendering Integration

```typescript
// Source: Phase 2 render loop pattern
import { depthSort, type Renderable } from './isoTypes.js';

export function renderRoom(
  ctx: CanvasRenderingContext2D,
  floorTiles: Renderable[],
  furniture: FurnitureSpec[],
  spriteCache: SpriteCache,
) {
  const renderables: Renderable[] = [];

  // Add floor tiles
  renderables.push(...floorTiles);

  // Add furniture
  for (const furni of furniture) {
    const renderable = createFurnitureRenderable(furni, spriteCache, 'furniture');
    renderables.push(renderable);
  }

  // Depth sort all objects
  const sorted = depthSort(renderables);

  // Draw in back-to-front order
  for (const renderable of sorted) {
    renderable.draw(ctx);
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Render furniture in separate pass after tiles | Insert furniture into unified depth-sort array | Standard since early isometric games (Ultima, SimCity) | Eliminates Z-fighting; furniture and tiles render in correct depth order regardless of insertion order |
| Use origin tile for multi-tile sort key | Use max(tileX + tileY) across footprint | Established pattern in isometric game engines (Unity, Godot) | Fixes occlusion bugs where avatars clip through furniture edges |
| Allow sub-pixel coordinates in drawImage() | Round all coordinates with Math.floor() | Canvas 2D performance best practice (2011+) | 2-10× performance improvement; pixel-perfect rendering matches sprite aesthetic |
| Store all 8 isometric directions | Store 4 directions (0, 2, 4, 6) with mirroring | Habbo Hotel optimization pattern | Reduces sprite atlas size by 50%; directions 4/6 are horizontal flips of 2/0 |

**Deprecated/outdated:**

- **CSS transforms for sprite rotation:** Canvas 2D `ctx.scale(-1, 1)` is the correct approach for horizontal mirroring; CSS transforms don't apply to canvas contexts.
- **Separate furniture z-index layer:** Modern isometric engines use unified depth sorting, not layered rendering.
- **Hand-rolled atlas slicing:** Canvas 2D 9-parameter `drawImage()` is optimized for sprite atlases; custom slicing adds no benefit.

---

## Open Questions

### 1. Sprite Anchor Offset Field Location

**What we know:**
- Texture Packer JSON includes `spriteSourceSize` field for trimmed sprites
- Phase 3 research documents Texture Packer Hash format
- Some game engines use `pivot` or `anchor` custom fields

**What's unclear:**
- Is Habbo furniture anchor stored in `spriteSourceSize`, a custom field, or derived from sprite dimensions?
- Are most furniture sprites trimmed or untrimmed?

**Recommendation:** Assume zero offset (untrimmed sprites) initially. Render a chair and visually compare against Retrosprite. If alignment is wrong, inspect JSON manifest for anchor fields. Implement offset logic only if visual validation reveals misalignment. Mark as LOW priority — likely won't be needed.

### 2. Multi-Layer Furniture Compositing

**What we know:**
- Frame naming includes `{layer}` parameter (a, b, c)
- Some furniture has shadows or overlay layers
- Phase 3 sprite cache returns frames separately

**What's unclear:**
- Which furniture types use multiple layers?
- What is the layer draw order (a before b, or b before a)?
- Are layers additive, or does one replace the other?

**Recommendation:** Start with single-layer rendering (layer `a` only). Pre-validate furniture sprites in Wave 0 — check if any of the 8 required types have multiple layers. If so, implement layer compositing as a separate subtask. Mark as MEDIUM priority.

### 3. Furniture Footprint Data Source

**What we know:**
- Multi-tile furniture (desks, bookshelves) need footprint dimensions
- Habbo room layout editor allows furniture placement
- Phase 7 will integrate layout editor

**What's unclear:**
- Is furniture footprint stored in the sprite manifest, a separate config file, or hardcoded per furniture type?
- Does the existing layout editor data model already have footprint data?

**Recommendation:** Check if existing layout editor has furniture footprint data. If not, hardcode footprints for the 8 required types (chair: 1×1, desk: 2×1, etc.) as constants. Defer dynamic footprint loading to Phase 7. Mark as HIGH priority for validation in Wave 0.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm test -- tests/isoFurnitureRenderer.test.ts -x` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FURN-01 | Chair renders at correct screen position with direction support | unit | `npm test -- tests/isoFurnitureRenderer.test.ts::testChairRendering -x` | ❌ Wave 0 |
| FURN-02 | Desk uses max-coordinate sort key for correct occlusion | unit | `npm test -- tests/isoFurnitureRenderer.test.ts::testMultiTileSortKey -x` | ❌ Wave 0 |
| FURN-03 | All 8 furniture types render without missing sprite errors | integration | `npm test -- tests/isoFurnitureRenderer.test.ts::test8FurnitureTypes -x` | ❌ Wave 0 |
| FURN-04 | Furniture direction 0, 2, 4, 6 selects correct frame | unit | `npm test -- tests/isoFurnitureRenderer.test.ts::testDirectionMapping -x` | ❌ Wave 0 |
| FURN-05 | All 8 furniture types exist in pre-extracted assets | manual | Visual validation with Retrosprite or sphynxkitten/nitro-assets | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- tests/isoFurnitureRenderer.test.ts -x` (unit tests only, <5s)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + manual visual validation against Retrosprite before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/isoFurnitureRenderer.test.ts` — unit tests for single-tile and multi-tile furniture rendering (FURN-01, FURN-02, FURN-03, FURN-04)
- [ ] Manual validation checklist — verify all 8 furniture types exist in asset source with expected 64px isometric style (FURN-05)
- [ ] Furniture footprint constants or config — validate existing layout editor has footprint data, or create constants for 8 types
- [ ] Mock furniture atlas — create minimal test atlas with chair_64_a_0_0, chair_64_a_2_0 frames for unit tests

**Note:** FURN-05 is manual validation step; no automated test needed. Create checklist in `.planning/phases/04-furniture-rendering/` with screenshot evidence.

---

## Sources

### Primary (HIGH confidence)

- [MDN Canvas API - Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - Sub-pixel rendering performance, coordinate rounding
- [Seb Lee-Delisle - HTML5 Canvas Sprite Optimisation](https://seblee.me/2011/02/html5-canvas-sprite-optimisation/) - drawImage coordinate rounding benchmarks
- [Mazebert Forum - Isometric Depth Sorting](https://mazebert.com/forum/news/isometric-depth-sorting--id775/) - Multi-tile depth sorting with max-coordinate pivot
- [Godot Proposals #2838 - Isometric Tilemap Sorting](https://github.com/godotengine/godot-proposals/issues/2838) - X+Y coordinate sorting for isometric
- [DevBest - Habbo Furniture Rotation](https://devbest.com/threads/rotate-command-plus-emu.91088/) - Habbo 4-direction system (0, 2, 4, 6)
- [Habbox Wiki - Executive Furniture](https://habboxwiki.com/Executive) - Office furniture types in Habbo
- [TexturePacker Documentation](https://www.codeandweb.com/texturepacker/documentation) - JSON Hash format, spriteSourceSize anchor offsets
- [BSWEN - Isometric 2.5D Canvas Games](https://docs.bswen.com/blog/2026-02-21-isometric-25d-canvas-games/) - Depth sorting and multi-tile object handling

### Secondary (MEDIUM confidence)

- [Envato Tuts+ - Isometric Depth Sorting for Moving Platforms](https://gamedevelopment.tutsplus.com/tutorials/isometric-depth-sorting-for-moving-platforms--cms-30226) - Painter's algorithm for isometric
- [PlayCanvas Forum - Texture Packer Trimmed Sprites](https://forum.playcanvas.com/t/texture-packer-trimmed-sprites-and-positioning/15024) - spriteOffset calculation
- [Unity Discussions - Tile Sprite Offset](https://discussions.unity.com/t/tile-sprite-offset-from-isometric-grid/766660) - Anchor offset patterns
- [Retrosprite GitHub](https://github.com/Bopified/Retrosprite) - Habbo asset converter and visual validation tool
- [sphynxkitten/nitro-assets](https://github.com/sphynxkitten/nitro-assets) - Pre-extracted Habbo asset source

### Tertiary (LOW confidence)

- Various DevBest forum threads on Habbo furniture - direction mirroring pattern confirmed, but specific frame naming not fully verified
- Pinterest/Craiyon Habbo room renders - visual reference for furniture types, not technical documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Canvas 2D drawImage API, existing Phase 1-3 infrastructure, all verified
- Architecture: MEDIUM-HIGH - Depth sorting and direction mapping verified; anchor offset and multi-layer compositing need validation
- Pitfalls: HIGH - Sub-pixel rendering, multi-tile sort key, coordinate rounding all well-documented failure modes

**Research date:** 2026-02-28
**Valid until:** 2026-04-30 (60 days - stable APIs, no fast-moving dependencies)

**Key unknowns requiring Phase 4 validation:**
1. Sprite anchor offset field location in Texture Packer JSON (likely not needed for untrimmed 64×64 sprites)
2. Multi-layer furniture compositing order (check if any of 8 required types use layers b/c)
3. Furniture footprint data source (validate existing layout editor or hardcode constants)

**Deferred to later phases:**
- Animated furniture (multi-frame sprites) — Phase 9+ (v2 scope)
- Wall-mounted furniture (posters, windows) — Phase 7+ or v2
- Custom furniture beyond 8 core types — Phase 9+ (v2 scope)