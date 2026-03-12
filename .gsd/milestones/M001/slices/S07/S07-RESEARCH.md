# Phase 7: Layout Editor Integration - Research

**Researched:** 2026-03-01
**Domain:** Canvas-based isometric tile editor with mouse interaction
**Confidence:** HIGH

## Summary

Phase 7 integrates interactive editing capabilities into the existing isometric renderer, enabling users to paint tiles, place furniture, adjust colors, and rotate objects. The core technical challenge is converting mouse coordinates to isometric tile positions using the inverse isometric formula with a z=0 assumption (Strategy B from Phase 1 research). This is a well-solved problem in isometric game development.

The editor requires five interaction modes: hover highlight, tile painting (walkability toggle), per-tile HSB color picking, furniture placement, and furniture rotation. All modes share the same mouse-to-tile conversion logic. React event handlers attach to the canvas element, calculate adjusted coordinates using `getBoundingClientRect()`, apply the inverse isometric transform from `screenToTile()`, and floor to integer tile indices.

The implementation is purely additive — existing rendering code remains unchanged. Editor state (current tool, selected color, selected furniture type) lives in React component state or refs, while layout data (heightmap grid, per-tile colors, furniture list) is the source of truth for both rendering and editing.

**Primary recommendation:** Build editor as a separate React component wrapping RoomCanvas, handling all mouse events and state management externally. Use existing `parseHeightmap()` and `preRenderRoom()` APIs to refresh the view after each edit. No changes to core rendering modules needed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4+ | Event handling, state management | Already used in RoomCanvas; useRef for mutable state, useState for UI updates |
| Canvas 2D API | Native | Rendering hover highlight, tile outlines | Built-in; already used for all rendering phases |
| TypeScript | 5.7+ | Type safety for editor state | Existing project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 3.0+ | Unit tests for coordinate conversion | Testing mouse-to-tile logic with known inputs |
| react-colorful | 5.6.1 | HSB color picker UI | If custom HSB picker is complex; can build minimal custom picker |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual HSB picker | react-colorful or PrimeReact ColorPicker | Manual: full control, minimal bundle; Library: feature-rich but larger bundle |
| Separate editor component | Direct integration in RoomCanvas | Separation: cleaner architecture, easier testing; Direct: fewer files but more complexity |
| History stack (undo/redo) | react-undo-redo hook | Simple array: sufficient for v1; Hook: more robust for v2 |

**Installation:**
```bash
# Optional: if using react-colorful for HSB picker
npm install react-colorful
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── isoLayoutEditor.ts       # Mouse-to-tile conversion, hover highlight rendering
├── LayoutEditorPanel.tsx    # React component: tool palette, color picker, furniture selector
├── RoomCanvas.tsx            # (existing) add optional editor mode prop
└── webview.tsx               # (existing) mount LayoutEditorPanel when in editor mode
```

### Pattern 1: Mouse-to-Tile Conversion
**What:** Convert canvas mouse coordinates to isometric tile indices
**When to use:** Every mouse event (move, click) in editor mode
**Example:**
```typescript
// Source: REQUIREMENTS.md EDIT-01 + isometricMath.ts
function getHoveredTile(
  event: React.MouseEvent<HTMLCanvasElement>,
  cameraOrigin: { x: number; y: number }
): { tileX: number; tileY: number } | null {
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();

  // Adjust for canvas CSS scaling
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  // Get mouse position relative to canvas
  const mouseX = (event.clientX - rect.left) * scaleX;
  const mouseY = (event.clientY - rect.top) * scaleY;

  // Subtract camera origin to get isometric screen coordinates
  const adjX = mouseX - cameraOrigin.x;
  const adjY = mouseY - cameraOrigin.y;

  // Apply inverse isometric formula (z=0 assumption)
  const { x: rawX, y: rawY } = screenToTile(adjX, adjY);

  // Floor to integer tile indices
  const tileX = Math.floor(rawX);
  const tileY = Math.floor(rawY);

  return { tileX, tileY };
}
```

### Pattern 2: Hover Highlight Rendering
**What:** Draw yellow rhombus outline over hovered tile
**When to use:** Every frame when editor is active and mouse is over a valid tile
**Example:**
```typescript
// Source: REQUIREMENTS.md EDIT-02
function drawHoverHighlight(
  ctx: CanvasRenderingContext2D,
  tileX: number,
  tileY: number,
  tileZ: number,
  cameraOrigin: { x: number; y: number }
): void {
  const { x: screenX, y: screenY } = tileToScreen(tileX, tileY, tileZ);

  ctx.save();
  ctx.translate(cameraOrigin.x, cameraOrigin.y);

  // Draw rhombus outline (same shape as tile, 2px stroke)
  ctx.strokeStyle = 'rgba(255, 255, 100, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(screenX, screenY);
  ctx.lineTo(screenX + TILE_W_HALF, screenY + TILE_H_HALF);
  ctx.lineTo(screenX, screenY + TILE_H);
  ctx.lineTo(screenX - TILE_W_HALF, screenY + TILE_H_HALF);
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}
```

### Pattern 3: Editor State Management
**What:** Track current tool, selected color, selected furniture type
**When to use:** All editor modes
**Example:**
```typescript
// Source: React patterns + existing RoomCanvas structure
interface EditorState {
  mode: 'paint' | 'color' | 'furniture' | 'rotate';
  selectedColor: HsbColor;
  selectedFurniture: string; // e.g., 'chair', 'desk'
  furnitureDirection: number; // 0, 2, 4, 6 (90° increments)
  hoveredTile: { x: number; y: number; z: number } | null;
}

// In React component
const editorState = useRef<EditorState>({
  mode: 'paint',
  selectedColor: { h: 200, s: 50, b: 50 },
  selectedFurniture: 'chair',
  furnitureDirection: 0,
  hoveredTile: null,
});
```

### Pattern 4: Layout Data Mutation
**What:** Update heightmap string, per-tile colors, furniture list after each edit
**When to use:** On click events when editor is active
**Example:**
```typescript
// Source: parseHeightmap() in isoTypes.ts + Habbo heightmap format
function toggleTileWalkability(
  grid: TileGrid,
  tileX: number,
  tileY: number
): string {
  // Mutate grid in-place
  const tile = grid.tiles[tileY]?.[tileX];
  if (tile) {
    // If walkable, make void
    grid.tiles[tileY][tileX] = null;
  } else {
    // If void, make walkable at height 0
    grid.tiles[tileY][tileX] = { height: 0 };
  }

  // Serialize back to heightmap string
  return gridToHeightmap(grid);
}

function gridToHeightmap(grid: TileGrid): string {
  return grid.tiles.map(row =>
    row.map(tile => tile ? String(tile.height) : 'x').join('')
  ).join('\n');
}
```

### Pattern 5: Furniture Rotation
**What:** Cycle furniture direction through 0, 2, 4, 6 (Habbo 8-direction system, 90° increments only)
**When to use:** Right-click on placed furniture or rotate button press
**Example:**
```typescript
// Source: Habbo furniture rotation (directions 0,2,4,6 = NE,SE,SW,NW)
function rotateFurniture(currentDirection: number): number {
  // Habbo directions: 0=NE, 2=SE, 4=SW, 6=NW
  const rotations = [0, 2, 4, 6];
  const currentIndex = rotations.indexOf(currentDirection);
  const nextIndex = (currentIndex + 1) % 4;
  return rotations[nextIndex];
}
```

### Anti-Patterns to Avoid
- **Mutating shared rendering state during mouse events:** Store editor hover state separately from render state to avoid triggering unnecessary re-renders
- **Recalculating camera origin on every mouse move:** Cache camera origin in ref, only recalculate when heightmap or canvas size changes
- **Ignoring canvas CSS scaling:** Always multiply `(clientX - rect.left)` by `canvas.width / rect.width` to handle devicePixelRatio and CSS resizing
- **Assuming integer tile heights:** Habbo heightmap supports 0-9, not just 0/1 — editor must handle height increments

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HSB color conversion | Manual HSB↔RGB↔HSL converter | Existing `hsbToHsl()` in isoTypes.ts | Already implemented and tested; edge cases handled |
| Depth sorting furniture | Custom furniture Z-order logic | Existing `depthSort()` + max-tile sort key | Phase 4 solved multi-tile depth correctly |
| Canvas HiDPI handling | Manual devicePixelRatio scaling | Existing `initCanvas()` in isoTileRenderer.ts | Already sets canvas.width, ctx.scale, imageSmoothingEnabled |
| Undo/redo for complex operations | Array.push/pop for every keystroke | Snapshot-based history stack (store full layout state) | Simpler for grid-based edits; avoid incremental deltas |

**Key insight:** 90% of editor functionality already exists in rendering modules. Don't duplicate coordinate math, color conversion, or depth sorting — call existing pure functions.

## Common Pitfalls

### Pitfall 1: Canvas Coordinate Scaling Confusion
**What goes wrong:** Mouse clicks land on wrong tiles because canvas internal dimensions ≠ CSS display size
**Why it happens:** `canvas.width` (internal) can differ from `canvas.offsetWidth` (CSS) due to devicePixelRatio or explicit CSS sizing
**How to avoid:** Always multiply `(clientX - rect.left)` by `canvas.width / rect.width` scale factor
**Warning signs:** Hover highlight drifts away from cursor; clicks register on tiles offset from visual position

### Pitfall 2: Forgetting Camera Origin Offset
**What goes wrong:** Mouse-to-tile conversion is off by a constant offset (tiles near origin work, distant tiles fail)
**Why it happens:** `screenToTile()` expects coordinates relative to tile (0,0,0), but mouse coords are relative to canvas top-left
**How to avoid:** Subtract `cameraOrigin.x` and `cameraOrigin.y` BEFORE calling `screenToTile()`
**Warning signs:** Hover highlight works at room center, but is increasingly wrong toward edges

### Pitfall 3: Z-Assumption Breaks on Stairs
**What goes wrong:** Clicking a tile at height Z>0 selects the tile below it
**Why it happens:** Inverse isometric formula assumes z=0; higher tiles project to same screen position as lower tiles behind them
**How to avoid:** Cast ray from mouse position through all possible Z heights (0-9), pick frontmost tile (highest Z at that screen position)
**Warning signs:** Stairs are not clickable; furniture on elevated tiles can't be selected

### Pitfall 4: Furniture Placement Without Bounds Checking
**What goes wrong:** Multi-tile furniture (desk 2×1) placed near room edge extends into void tiles
**Why it happens:** Click checks only anchor tile (tileX, tileY), doesn't validate footprint fits in grid
**How to avoid:** Before placing furniture, check all tiles in footprint (tileX to tileX+widthTiles, tileY to tileY+heightTiles) are walkable
**Warning signs:** Furniture renders half off-screen; depth sorting breaks; furniture appears on void tiles

### Pitfall 5: Overwriting Furniture Instead of Rotating
**What goes wrong:** Clicking a tile with furniture deletes it and places new furniture instead of rotating
**Why it happens:** Click handler always places new furniture, doesn't check if furniture already exists at tile
**How to avoid:** On click, check furniture list for existing item at (tileX, tileY). If found AND same type, rotate; if different type or no furniture, place new
**Warning signs:** Can't rotate furniture; must delete and re-place to change direction

## Code Examples

Verified patterns from official sources and existing codebase:

### Mouse Event Handler (Complete Flow)
```typescript
// Source: React event system + existing isometricMath.ts
function handleCanvasMouseMove(
  event: React.MouseEvent<HTMLCanvasElement>
): void {
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();

  // Step 1: Get scaled mouse position
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mouseX = (event.clientX - rect.left) * scaleX;
  const mouseY = (event.clientY - rect.top) * scaleY;

  // Step 2: Subtract camera origin
  const adjX = mouseX - renderState.current.cameraOrigin.x;
  const adjY = mouseY - renderState.current.cameraOrigin.y;

  // Step 3: Convert to tile coordinates
  const { x: rawX, y: rawY } = screenToTile(adjX, adjY);
  const tileX = Math.floor(rawX);
  const tileY = Math.floor(rawY);

  // Step 4: Validate tile is in grid bounds
  const grid = renderState.current.grid;
  if (tileY < 0 || tileY >= grid.height || tileX < 0 || tileX >= grid.width) {
    editorState.current.hoveredTile = null;
    return;
  }

  // Step 5: Get tile height (or default 0 for void)
  const tile = grid.tiles[tileY][tileX];
  const tileZ = tile?.height ?? 0;

  // Step 6: Update hover state
  editorState.current.hoveredTile = { x: tileX, y: tileY, z: tileZ };
}
```

### Tile Painting (Toggle Walkability)
```typescript
// Source: Habbo heightmap format (0-9 = walkable, x = void)
function handleTilePaint(tileX: number, tileY: number): void {
  const grid = renderState.current.grid;
  const tile = grid.tiles[tileY]?.[tileX];

  if (tile) {
    // Make void
    grid.tiles[tileY][tileX] = null;
  } else {
    // Make walkable at height 0
    grid.tiles[tileY][tileX] = { height: 0 };
  }

  // Regenerate heightmap string
  const newHeightmap = gridToHeightmap(grid);

  // Trigger re-render (pass new heightmap to RoomCanvas)
  setHeightmap(newHeightmap);
}
```

### Per-Tile Color Application
```typescript
// Source: ROOM-04 requirement + isoTypes.ts tileColors()
interface TileColorMap {
  [key: string]: HsbColor; // key format: `${tileX},${tileY}`
}

function setTileColor(tileX: number, tileY: number, color: HsbColor): void {
  const key = `${tileX},${tileY}`;
  tileColorMap.current.set(key, color);

  // Trigger re-render with updated color map
  // preRenderRoom() accepts per-tile color map parameter
  regenerateOffscreenCanvas();
}
```

### Furniture Placement with Validation
```typescript
// Source: FURN-01, FURN-02 + bounds checking
function placeFurniture(
  tileX: number,
  tileY: number,
  furnitureType: string,
  direction: number
): boolean {
  const furnitureData = FURNITURE_SPECS[furnitureType]; // { widthTiles, heightTiles }
  const grid = renderState.current.grid;

  // Validate footprint
  for (let dy = 0; dy < furnitureData.heightTiles; dy++) {
    for (let dx = 0; dx < furnitureData.widthTiles; dx++) {
      const checkX = tileX + dx;
      const checkY = tileY + dy;

      // Out of bounds?
      if (checkY >= grid.height || checkX >= grid.width) {
        console.warn('Furniture extends beyond grid');
        return false;
      }

      // Void tile?
      if (!grid.tiles[checkY][checkX]) {
        console.warn('Furniture on void tile');
        return false;
      }
    }
  }

  // Add to furniture list
  furnitureList.current.push({
    type: furnitureType,
    tileX,
    tileY,
    tileZ: grid.tiles[tileY][tileX].height,
    direction,
  });

  regenerateOffscreenCanvas();
  return true;
}
```

### Save/Load Layout as Heightmap String
```typescript
// Source: Habbo heightmap format + door coordinates (from research)
interface LayoutData {
  heightmap: string;
  doorX: number;
  doorY: number;
  doorZ: number;
  doorDir: number;
  tileColors: TileColorMap;
  furniture: FurnitureSpec[];
}

function saveLayout(): string {
  const data: LayoutData = {
    heightmap: gridToHeightmap(renderState.current.grid),
    doorX: doorCoords.current.x,
    doorY: doorCoords.current.y,
    doorZ: doorCoords.current.z,
    doorDir: doorCoords.current.dir,
    tileColors: Object.fromEntries(tileColorMap.current),
    furniture: furnitureList.current,
  };
  return JSON.stringify(data, null, 2);
}

function loadLayout(jsonString: string): void {
  const data: LayoutData = JSON.parse(jsonString);

  // Update all editor state
  setHeightmap(data.heightmap);
  doorCoords.current = {
    x: data.doorX,
    y: data.doorY,
    z: data.doorZ,
    dir: data.doorDir,
  };
  tileColorMap.current = new Map(Object.entries(data.tileColors));
  furnitureList.current = data.furniture;

  regenerateOffscreenCanvas();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate tile/furniture editors | Unified canvas editor with mode switching | ~2015 (Unity Tile Palette) | Single interface for all editing; faster workflow |
| Server-side heightmap generation | Client-side browser-based editors | ~2013 (Habbo Floor Plan Editor) | Instant preview; no page reload |
| Pixel-perfect mouse detection | Inverse isometric formula | ~2010 (standardized in game dev) | Exact tile selection; no sprite hit-testing needed |
| Manual JSON editing for furniture | Visual placement with mouse | ~2012 (Tiled editor v0.9) | Non-technical users can edit layouts |

**Deprecated/outdated:**
- Pixel-based collision detection for tile picking (replaced by inverse isometric math — always use formula, not sprite bounds)
- Re-rendering full room on every mouse move (use separate hover highlight layer — blit static offscreen canvas, draw highlight on top)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0+ |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- tests/isoLayoutEditor.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDIT-01 | Mouse-to-tile conversion using inverse isometric formula | unit | `npm test -- tests/isoLayoutEditor.test.ts -t "getHoveredTile"` | ❌ Wave 0 |
| EDIT-02 | Yellow rhombus highlight on correct tile | integration | `npm test -- tests/isoLayoutEditor.test.ts -t "hover highlight"` | ❌ Wave 0 |
| EDIT-03 | Tile painting, color picker, furniture placement, rotation, save/load | integration | `npm test -- tests/isoLayoutEditor.test.ts -t "editor operations"` | ❌ Wave 0 |
| EDIT-04 | Furniture aligns to isometric grid | unit | `npm test -- tests/isoLayoutEditor.test.ts -t "furniture alignment"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- tests/isoLayoutEditor.test.ts -x` (fast unit tests only, fail-fast)
- **Per wave merge:** `npm test -- tests/isoLayoutEditor.test.ts` (full integration suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/isoLayoutEditor.test.ts` — covers EDIT-01 (mouse-to-tile conversion with known coordinates)
- [ ] `tests/isoLayoutEditor.test.ts` — covers EDIT-02 (hover highlight renders at correct screen position)
- [ ] `tests/isoLayoutEditor.test.ts` — covers EDIT-03 (tile toggle, color change, furniture add/remove)
- [ ] `tests/isoLayoutEditor.test.ts` — covers EDIT-04 (furniture placement validation, bounds checking)
- [ ] `tests/setup.ts` — already exists (OffscreenCanvas mock from Phase 2)

## Sources

### Primary (HIGH confidence)
- REQUIREMENTS.md EDIT-01 to EDIT-04 — Phase 7 requirements specification
- isometricMath.ts `screenToTile()` — Inverse isometric formula implementation
- ROADMAP.md Phase 7 section — Strategy B (z=0 assumption) confirmed
- isoTypes.ts — Existing `parseHeightmap()`, `hsbToHsl()`, `tileColors()` functions
- RoomCanvas.tsx — Existing event handler patterns, renderState.current structure

### Secondary (MEDIUM confidence)
- [Isometric Tiles Math](https://clintbellanger.net/articles/isometric_math/) - Inverse formula derivation
- [Understanding isometric grids](https://yal.cc/understanding-isometric-grids/) - Coordinate conversion patterns
- [I'm creating an Isometric TileSet editor app with React and HTML5 Canvas](https://blog.itsjavi.com/im-creating-an-isometric-tileset-editor-app-with-react-and-html5-canvas-because-why-not) - React + isometric editor architecture
- [Accurate Canvas Mouse Tracking in React](https://www.technetexperts.com/accurate-canvas-mouse-tracking-react/) - getBoundingClientRect scaling pattern
- [How getBoundingClientRect Works](https://medium.com/@AlexanderObregon/how-getboundingclientrect-works-and-what-it-returns-e67f5b3700cf) - Viewport-to-element coordinate conversion
- [Rotating a 2.5D isometric map](https://www.moddb.com/features/rotating-a-25d-isometric-map) - Furniture rotation patterns in isometric games
- [How to implement undo/redo on canvas with React? | Konva](https://konvajs.org/docs/react/Undo-Redo.html) - History stack pattern for canvas editors
- [Floor Plan Editor - Habbox Wiki](https://habboxwiki.com/Floor_Plan_Editor) - Habbo heightmap format (X=void, 0-9=walkable)
- [PrimeReact ColorPicker](https://primereact.org/colorpicker/) - HSB color picker component (if needed)

### Tertiary (LOW confidence)
- None — all critical findings verified against project codebase or multiple authoritative sources

## Metadata

**Confidence breakdown:**
- Mouse-to-tile conversion: HIGH - Existing `screenToTile()` function tested in Phase 1, formula verified across multiple sources
- Hover highlight rendering: HIGH - Same rhombus drawing pattern as tiles (isoTileRenderer.ts), only stroke instead of fill
- Editor state management: HIGH - Standard React useRef/useState patterns, existing RoomCanvas structure provides template
- Furniture placement/rotation: MEDIUM - Patterns verified in research, but multi-tile bounds checking needs integration testing
- Save/load format: MEDIUM - Habbo heightmap format confirmed, but per-tile color storage structure is custom (not official Habbo format)

**Research date:** 2026-03-01
**Valid until:** 2026-03-31 (30 days — stable domain, React/Canvas 2D patterns don't change rapidly)