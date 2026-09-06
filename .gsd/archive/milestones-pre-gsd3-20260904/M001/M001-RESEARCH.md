# Research Summary

**Project:** habbo-pixel-agents
**Domain:** VS Code extension — isometric 2.5D rendering layer for AI agent visualisation
**Researched:** 2026-02-28
**Confidence:** HIGH

## Key Findings

### Stack Decisions (locked)

The rendering upgrade is a surgical replacement of `renderer.ts` and `spriteData.ts` only. The rest of the pixel-agents codebase — JSONL watcher, state machines, BFS pathfinder, layout editor data model, audio subsystem, React shell — is untouched. This is the single most important architectural fact from the research: the scope is deliberately narrow.

**Rendering engine:** Canvas 2D (browser native). WebGL is not blocked by VS Code's webview CSP and PixiJS v8 works in Electron, but Canvas 2D is sufficient for a ~20x20 tile non-game tool panel and avoids bundle weight and lifecycle complexity. PixiJS v8 is the confirmed upgrade path if 60 fps animation becomes a requirement; `mathishouis/scuti-renderer` provides a drop-in Habbo-specific reference implementation on PixiJS.

**Asset pipeline:** `billsonnn/nitro-converter` produces `.nitro` bundles (PNG atlas + JSON manifest) from Habbo SWF files. The `.nitro` format is a custom binary container (BigEndian header, per-file zlib compression) — not a standard ZIP. The fastest path is `sphynxkitten/nitro-assets`, a community repository of pre-extracted bundles covering the 8 furniture types needed for V1. Assets must be extracted at build time (Node.js pre-build script) and served as static files via `webview.asWebviewUri()`. They must never be imported through esbuild.

**Font:** Press Start 2P (OFL 1.1) as the default; Volter/Goldfish (Sulake-released, free for personal use) as an explicit opt-in with a licensing disclaimer. Both are bundled locally as TTF files — no external CDN dependency. Volter must not appear as the default in any publicly visible artifact because it cannot be sold as a standalone font product.

**Versions:** PixiJS v8+ if upgraded (no `unsafe-eval` required). Node 18+ for the nitro-converter pipeline. React 19 (existing). esbuild (existing, two separate configs required for extension host and webview).

### Architecture Approach (locked)

The pipeline has a strict seven-phase build order with hard dependencies. Phases 1-2 (coordinate math + tile renderer) unlock visual validation before any sprites load. Phases 3-5 (asset loader + furniture + avatar) can partially overlap once the math layer is done. Phase 6 (UI overlays) has no sprite dependency. Phase 7 (layout editor hit detection) is last because it depends on finalised tile sizes.

**Major components:**

1. **`isometricMath.ts`** — Pure functions: `tileToScreen(x,y,z)`, `screenToTile(sx,sy)`, `getDirection(dx,dy)`. No render dependencies. Constants: `TILE_W=64`, `TILE_H=32`. This module is the foundation every other module imports.

2. **`isoTileRenderer.ts`** — Canvas 2D path fills for floor rhombuses, left/right wall strips, stair risers. Depth-sort pass (painter's algorithm, sort key `tileX + tileY + tileZ * 0.001`). Pre-renders static room geometry to an `OffscreenCanvas` once at layout load; composites it every frame with a single `drawImage`.

3. **`isoAssetLoader.ts` + `isoSpriteCache.ts`** — Node pre-build script extracts PNG + JSON from `.nitro` binaries. Webview loads PNGs as `HTMLImageElement`, immediately calls `createImageBitmap()` to force GPU decode, stores `ImageBitmap` in cache. Frame lookup: `frameKey -> {x, y, w, h}` from the Texture Packer "hash" format manifest.

4. **`isoFurnitureRenderer.ts`** — `drawImage` with per-frame atlas offsets from the JSON manifest. Multi-tile furniture sort key uses farthest tile (`max(tileX + tileY)` across footprint), not origin tile.

5. **`isoAvatarRenderer.ts`** — 8-direction body-part layer composition. 4-frame walk cycle at 250 ms/frame. Idle blink overlay (3 frames, random 5-8 s interval). Direction computed from BFS path step delta via lookup table.

6. **`isoBubbleRenderer.ts` + `isoNameTagRenderer.ts`** — Canvas 2D rounded rects and text. Rendered after the depth-sorted list (always on top). Animated "..." dots for waiting state (500 ms per step).

7. **`isoLayoutEditor.ts`** — Mouse-to-tile via inverse isometric transform assuming z=0 (Strategy B: simple, correct for editor use). Tile highlight drawn as rhombus outline after the main pass.

**BFS pathfinding is completely unchanged.** The algorithm operates on the logical grid. Only the single line that converts a path step to a screen position changes (flat multiply replaced by `tileToScreen()`).

**Depth sort detail:** `sortKey = tileX + tileY + tileZ * 0.001`. Secondary order within a tile: floor tile < floor furni (by z) < avatar < speech bubble / name tag. Topological cycles are avoided by room design convention (follow Habbo's practice: furniture placement does not create crossing paths with avatar routes).

### Critical Gotchas

1. **esbuild `file` loader + VS Code asset URIs are incompatible.** Never import PNGs, audio, or `.nitro` files through esbuild. Assets must be copied to `dist/webview-assets/` by a separate build step and loaded in the webview via `webview.asWebviewUri()`. This is the single most likely cause of silent, hard-to-debug asset failures at first integration.

2. **React StrictMode double-mounts the canvas component in dev.** The rAF loop must use a `running` boolean guard (not just `cancelAnimationFrame`) so the loop self-terminates even if cleanup runs with a stale frame ID. Store all game state in `useRef`, not `useState` — the rAF closure captures state at mount time and will never see subsequent `setState` updates.

3. **VS Code does not ship ffmpeg; most audio codecs are broken in webviews.** MP3 and AAC fail. Convert all Habbo sound effects to OGG Vorbis or uncompressed WAV at build time. Gate `AudioContext` creation behind a user gesture. Accept silence as the fallback if codec support varies across VS Code versions.

4. **HiDPI canvas blurring destroys the pixel-art aesthetic.** At init: `canvas.width = canvas.offsetWidth * devicePixelRatio`, then `ctx.scale(dpr, dpr)`. Also set `ctx.imageSmoothingEnabled = false` for all sprite draws. Omitting this makes the isometric tiles look smeared — especially damaging for an art style where crisp pixels are the visual identity.

5. **`localResourceRoots` misconfiguration silently blocks all assets.** Always include `vscode.Uri.joinPath(context.extensionUri, 'dist')` in `localResourceRoots`. A missing or empty `localResourceRoots` returns 401/Access Denied in the webview with no visible error message.

6. **`.nitro` is not a ZIP; it is a custom BigEndian binary container.** Use the documented extraction logic (read `UI16` file count, then per-file: `UI16` name length, name bytes, `UI32` compressed length, zlib-inflate data). Do not attempt to unzip it with standard zip tools. Validate extraction output against Retrosprite.

7. **Multi-tile furniture depth sort requires farthest-tile sort key.** Using the origin tile for a 2x2 desk causes avatars on adjacent tiles to disappear behind it. Compute `max(tileX + tileY)` across all tiles in the furniture footprint.

### Asset Strategy

**Source priority:**
1. `sphynxkitten/nitro-assets` — pre-extracted, ready to use, covers all 8 V1 furniture types. Validate each item visually before committing to it; the v14-era visual style may differ from what is in the repo (which tracks the modern live CDN).
2. `scottstamp/FurniExtractor` (C#) — for any specific items missing from the pre-extracted set.
3. `billsonnn/nitro-converter` against Kepler server SWFs — full pipeline fallback for true v14-era assets.

**Licensing stance:** Keep all extracted Sulake assets out of any public repository. Reference `sphynxkitten/nitro-assets` in documentation; do not commit PNG/JSON files derived from Sulake SWFs to this repo. Document clearly that the tool is personal-only and requires the user to supply assets. Risk profile: personal non-commercial use is LOW risk per Sulake's enforcement history (primary targets have been monetised retro hotels, not personal tools).

**Avatar sprites:** The pre-extracted Nitro assets cover modern Habbo figure parts, not necessarily classic v14 looks. For V1, use the existing 6-variant palette system with simplified 3-4 layer composition (body, clothing, head, hair) rather than the full 13-layer Habbo figure compositor. This avoids the v14 avatar figure compatibility gap entirely and preserves the existing character identity system.

**Walls and floors:** Programmatically drawn via Canvas 2D path fills. No sprite assets needed. Left wall lighter, right wall darker (~20% brightness difference). Three-tone floor shading (top face lightest, left face medium, right face darkest). This closes the wallpaper/background texture gap in `nitro-assets` (those assets are not present in the repo).

### Open Questions

1. **Which specific v14-era furniture items from the 8 required types are present in `sphynxkitten/nitro-assets` at the correct visual style?** Must be validated by manually inspecting the repo before writing `isoFurnitureRenderer.ts`. If any item is missing or visually wrong, decide: use modern equivalent or run the Kepler extraction fallback.

2. **Audio codec availability on the target VS Code version.** OGG Vorbis should work but needs empirical testing on the actual VS Code install. This cannot be determined from documentation alone.

3. **Custom avatar sprites vs sourced Nitro avatar parts.** Research suggests Nitro's avatar system may not cover classic v14 clothing looks. The palette-variant approach (fixed sprites per character type) avoids this entirely but requires someone to create or source 6 sprite sets covering 8 directions x 4 walk frames + 1 idle + 3 blink frames. Who creates or sources these sprites is unresolved.

4. **Exact camera origin for the room viewport.** The formula places tile (0,0) at screen (0,0), but the room needs to appear centred in the webview panel. Camera offset calculation depends on room dimensions, which vary. This is a UX tuning question more than a technical one, but needs a defined policy (fixed offset, auto-centre at load, user-pannable).

---

## Phase Guidance

Research surfaces a clear dependency graph. The roadmapper should structure phases in this order:

**Phase 1 — Coordinate Foundation**
Build `isometricMath.ts` first. It is the only module with zero dependencies. Every subsequent phase imports it. Unit-test `tileToScreen`/`screenToTile`/`getDirection` against known values before touching any rendering code. This phase should be a single focused pull request that the rest of the work gates on.

**Phase 2 — Static Room Rendering**
Tile renderer + wall renderer + depth sort pass. No sprite assets required — walls and floors are Canvas 2D path fills. This phase produces a visible, correct isometric room from any heightmap string, which validates the coordinate math visually and gives a demo-able artifact early. Include the `OffscreenCanvas` pre-render optimisation here, not later. Also handle HiDPI scaling and `imageSmoothingEnabled = false` here — these are init-time settings that affect all subsequent rendering.

Gotcha to address in this phase: React StrictMode rAF loop guard pattern. Establish the `running` boolean + `useRef` state store pattern before any other render code is written, so all subsequent phases inherit the correct integration shape.

**Phase 3 — Asset Pipeline**
Node pre-build extraction script for `.nitro` binaries. `isoAssetLoader.ts` + `isoSpriteCache.ts`. `createImageBitmap` pre-decode. esbuild build config (two separate configs: extension host + webview; assets as file copy, not JS import). Validate asset URI pattern (`asWebviewUri`, `localResourceRoots`).

This phase has no visible end-user output until Phase 4 consumes it, but it is the riskiest infrastructure phase. The `.nitro` binary format, esbuild asset path pattern, and CSP `localResourceRoots` config are all failure-prone. Isolate and validate this phase completely before furniture rendering.

**Phase 4 — Furniture Rendering**
`isoFurnitureRenderer.ts`. Depends on Phases 1 and 3. Start with a single 1x1 chair to validate the atlas offset + draw flow. Then add the desk (2x1 or 2x2 — validate multi-tile sort key fix here). Add remaining 6 furniture types once the first two work. Static furniture only in V1 (no animation frames).

Pre-validate: confirm each of the 8 required furniture items exists in `sphynxkitten/nitro-assets` at the expected size and visual style. Do this before writing any rendering code.

**Phase 5 — Avatar System**
`isoAvatarRenderer.ts`. Depends on Phases 1 and 3. Decision point: sourced Nitro avatar parts vs custom simplified sprites. Research strongly suggests simplified 3-4 layer custom sprites per palette variant is lower risk than the full Nitro avatar composer for classic v14 looks. If this decision is made in favour of custom sprites, Phase 3 asset pipeline work for avatars is replaced by a sprite creation/sourcing task.

Walk cycle: 4 frames at 250 ms/frame. Direction update: `getDirection()` called on each BFS step. Idle blink: 3-frame overlay at random 5-8 s interval. All animation timing managed by the rAF loop reading from `useRef` state, not React state.

**Phase 6 — UI Overlays**
`isoBubbleRenderer.ts` + `isoNameTagRenderer.ts`. No sprite dependencies. Pure Canvas 2D. Render after the depth-sorted list. Animated "..." bubble for waiting state. Name tag with status dot (green/yellow/grey/red). Volter font as opt-in; Press Start 2P as default. Font loaded via `@font-face` from a local TTF file, declared in the webview HTML before first render.

**Phase 7 — Layout Editor Integration**
`isoLayoutEditor.ts`. Mouse-to-tile inverse transform (Strategy B: z=0 assumption). Tile highlight rhombus. Preserve all existing editor behaviours (tile painting, HSB colour, furniture placement, rotation, persistence in Habbo heightmap string format). This phase is last because it depends on finalised tile render dimensions.

**Phase 8 — Audio**
Convert Habbo sound effects to OGG Vorbis at build time. Load via `ArrayBuffer` + `AudioContext.decodeAudioData`. Gate on user gesture. Test on target VS Code version. Prepare for silence fallback — do not make audio a hard dependency of any other feature. This phase is decoupled from all rendering phases and can be done independently after Phase 2.

**Research flags:**
- Phase 3 (Asset Pipeline): needs careful validation against live `.nitro` binary format spec. Retrosprite is the primary source for format documentation but is a single community source. Recommend building and testing the extraction script before any other Phase 3 work.
- Phase 5 (Avatar System): the sourcing/creation decision for avatar sprites is unresolved. This phase may need a discovery spike before a firm plan.
- Phase 8 (Audio): empirical testing on the target VS Code version required; no documentation can confirm codec availability ahead of time.

**Standard patterns (no deep research needed):**
- Phase 1 (Coordinate Math): formulas verified across 4+ open-source renderers and 2 authoritative isometric math references.
- Phase 2 (Static Rendering): Canvas 2D path fills and depth sorting are well-documented; scuti-renderer and shroom provide reference implementations.
- Phase 6 (UI Overlays): Canvas 2D rounded rects and text are entirely standard; no Habbo-specific complexity.
- Phase 7 (Layout Editor): inverse isometric transform is a solved problem; Strategy B (z=0 assumption) is a documented accepted approach for editors.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Rendering choice, CSP behaviour, PixiJS v8 compatibility, and font licensing all verified against official VS Code docs, GitHub issues, and confirmed open-source implementations. The Canvas 2D recommendation is conservative and correct. |
| Features | HIGH | Isometric math constants verified across 4 open-source Habbo renderers. Avatar action/direction system reverse-engineered and cross-checked against multiple community implementations. Feature scope boundary is clear. |
| Architecture | HIGH | Build order and component boundaries derived from 4 reference renderers (scuti-renderer, shroom, bobba_client, nitro-renderer) plus authoritative isometric math references. BFS-unchanged finding is unambiguous. |
| Pitfalls | HIGH | CSP pitfalls sourced from official VS Code GitHub issues with VS Code team quotes. React StrictMode behaviour sourced from React official docs. esbuild asset loader issue sourced from esbuild docs and GitHub issues. Most pitfalls have HIGH-confidence primary sources. |

**Overall confidence: HIGH**

### Gaps to Address

- **Avatar sprite sourcing:** The palette-variant approach is recommended but the actual sprites (6 variants x 8 dirs x ~5 frames per direction) must come from somewhere. Either source from `nitro-assets` (checking v14 compatibility) or commission/create simplified custom pixel art. This decision affects Phase 5 scope and timeline significantly.

- **V14 furniture visual fidelity gap:** `sphynxkitten/nitro-assets` tracks the modern Habbo CDN, not the 2007-era v14 assets. Each of the 8 required furniture types needs manual visual inspection. Document which items require the Kepler-path fallback before Phase 4 begins.

- **OGG audio codec availability:** Cannot be confirmed from documentation. Requires testing on the exact VS Code version in the target environment before Phase 8 is scoped.

- **Camera origin policy:** Auto-centre vs fixed offset vs user-pannable is an unresolved UX decision. Needs a policy decision before Phase 2 is considered done.

---

## Sources

### Primary (HIGH confidence)
- github.com/mathishouis/scuti-renderer — Habbo rendering pipeline, component architecture, PixiJS integration
- github.com/jankuss/shroom — Wall generation from heightmap, stair tile pattern
- github.com/Josedn/bobba_client — Depth sort confirmation ("farther elements drawn first")
- github.com/Bopified/Retrosprite — `.nitro` binary format specification (BigEndian, per-file zlib)
- clintbellanger.net/articles/isometric_math/ — Isometric coordinate transform formulas (grid to screen and back)
- code.visualstudio.com/api/extension-guides/webview — CSP, localResourceRoots, asWebviewUri, audio codec status
- github.com/microsoft/vscode/issues/66050 — "Audio is not supported in webview" (VS Code team)
- github.com/microsoft/vscode/issues/54097 — "We don't ship ffmpeg" (VS Code team)
- github.com/microsoft/vscode/issues/87282 — Web Workers blocked in webviews
- esbuild.github.io/content-types/ — Loader behaviours; file/copy/dataurl/binary loader specifics
- react.dev/reference/react/StrictMode — Double-mount behaviour confirmed
- github.com/eonu/goldfish — Volter/Goldfish TTF files, licensing
- github.com/sphynxkitten/nitro-assets — Pre-extracted asset repository, category listing

### Secondary (MEDIUM confidence)
- github.com/billsonnn/nitro-converter — Asset pipeline architecture, `.nitro` bundle format
- github.com/Quackster/Kepler — v14 asset set reference, furnidata schema
- nick-aschenbach.github.io/blog/2015/02/25/isometric-tile-engine/ — Mouse-to-tile formula verification
- shaunlebron.github.io/IsometricBlocks/ — Depth sorting algorithm
- github.com/microsoft/vscode/issues/148494 — AudioContext.decodeAudioData MP3 failure
- MDN Canvas Optimization docs — createImageBitmap, offscreen canvas, save/restore cost

### Tertiary (LOW confidence)
- DevBest community threads — Sulake DMCA enforcement focus on monetised projects
- html5gamedevs.com — Pathfinding on isometric grids (BFS in grid space)
- github/dmca Sulake 2015 notices — Enforcement history

---
*Research completed: 2026-02-28*
*Ready for roadmap: yes*

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

# Stack Research
## Isometric 2.5D Rendering Layer — VS Code Webview (Habbo v14 Reskin)
_Research date: 2026-02-28_

---

## Rendering: Canvas 2D vs WebGL vs PixiJS in VS Code Webview

### How VS Code Webviews Run

VS Code webviews are sandboxed HTML panels backed by Electron's Chromium renderer. They run in an isolated context equivalent to a cross-origin iframe. The key constraint is that the extension author controls the Content Security Policy (CSP) via a `<meta>` tag in the HTML shell — VS Code does not hard-block WebGL.

The recommended VS Code CSP baseline is:
```
default-src 'none';
img-src ${webview.cspSource} https: data:;
script-src ${webview.cspSource};
style-src ${webview.cspSource};
```

This policy does **not** block WebGL — WebGL is a capability of the underlying Chromium `<canvas>` element, not a separately gated CSP directive. WebGL calls go through the GPU process in Electron and are hardware-accelerated on macOS and Windows by default (Linux may require `--enable-gpu-rasterization` flags). No extra CSP token is needed to enable WebGL; only `script-src` must allow the PixiJS bundle source.

The one gotcha: `'unsafe-eval'` is required by some legacy bundlers and older PixiJS v6 builds. PixiJS v8 (2024+) ships as ESM and avoids `eval`, so it does not require `unsafe-eval`. WebAssembly execution requires `'wasm-unsafe-eval'` if any WASM is used, but pure PixiJS/Canvas 2D does not use WASM.

### Canvas 2D

- **What works:** Full support. `drawImage()`, `ctx.save()/restore()`, compositing, and `@font-face` all work inside a webview without any CSP relaxation beyond the default.
- **Performance:** CPU-bound. For a tile map of ~20×20 isometric tiles with per-frame redraws, Canvas 2D is sufficient for a VS Code tool (not a live game). Habbo Hotel v14 itself ran isometric rooms on Flash Player's software renderer at 15–30 fps on 2007 hardware; Canvas 2D on a modern Mac CPU is more than capable.
- **Depth sorting:** Must be implemented manually (painter's algorithm, sort-by-row).
- **Sprite atlas support:** Standard `drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)` clips sprite regions from a packed PNG atlas — no library needed.
- **Isometric math:** Standard 2:1 diamond tile projection. Screen coordinates: `screenX = (col - row) * (tileW / 2)`, `screenY = (col + row) * (tileH / 2)`. Well-documented; no library dependency required.

### PixiJS (v8, WebGL + WebGPU)

- **What works in Electron/webview:** PixiJS is confirmed to work inside Electron. VS Code's Electron shell uses Chromium with hardware GPU acceleration enabled on macOS and Windows. WebGL is available in webview panels. PixiJS v8 introduces a WebGPU renderer alongside WebGL, with automatic fallback to WebGL, then Canvas 2D.
- **PixiJS v8 CSP compatibility:** ESM build does not need `unsafe-eval`. The bundle must be served from a URI reachable by the webview's `script-src ${webview.cspSource}` (i.e., bundled into the extension's `dist/` folder and served via `vscode-resource:` URI).
- **Advantages for isometric rendering:** Batched sprite rendering, built-in `@pixi/spritesheet` loader that reads Texture Packer JSON atlas format, automatic depth sorting via container z-ordering, filter pipeline for future effects.
- **Disadvantages:** Adds ~1 MB minified to the webview bundle. Overkill if the room is static or updated infrequently. Requires managing PixiJS app lifecycle inside a React component (ref-based `useEffect` mount/unmount).
- **scuti-renderer** (GitHub: `mathishouis/scuti-renderer`) is a confirmed working open-source Habbo room renderer built on PixiJS + TypeScript that renders rooms, furniture, and avatars. This is strong evidence that PixiJS works for exactly this use case.

### WebGL (raw / Three.js)

- **What works:** Raw WebGL works in Electron webviews. Three.js also works. However, for a 2.5D isometric pixel-art renderer, using raw WebGL or Three.js is significantly more engineering effort than PixiJS or Canvas 2D with no meaningful benefit.
- **Not recommended** for this use case.

### What Is Actually Blocked by Default CSP

| Directive | Blocks |
|-----------|--------|
| No `unsafe-eval` | Older PixiJS v6/v7, some Webpack runtime chunks |
| No `unsafe-inline` | Inline `<script>` and `<style>` tags |
| No `connect-src` | `fetch()` / XHR to external URLs |
| No `wasm-unsafe-eval` | WASM execution |
| WebGL itself | **Not blocked** — it's a canvas API, not a CSP-gated resource |

### Recommendation

**Canvas 2D for initial implementation; migrate to PixiJS v8 if animation/performance demands arise.**

- Canvas 2D: zero extra bundle weight, no `unsafe-eval`, simpler React integration, sufficient for a static/low-fps office map tool.
- PixiJS v8: drop-in upgrade path if animated furniture, hover effects, or 60 fps scrolling are needed. The scuti-renderer provides a reference implementation.

**Confidence: High.** WebGL/PixiJS is not blocked by VS Code's webview sandbox on macOS/Windows. Canvas 2D works unconditionally.

---

## Nitro Asset Pipeline

### What Nitro Is

The Nitro project (primary repo: `billsonnn/nitro-react`, renderer: `billsonnn/nitro-renderer`) is an open-source TypeScript/React reimplementation of the Habbo Hotel HTML5 client. The renderer (`@nitrots/nitro-renderer`) is built on top of **PixiJS v6** (`@pixi/spritesheet`) and handles asset loading, room rendering, avatar rendering, and UI.

### How Asset Extraction Works

Habbo Hotel's original assets are distributed as Adobe SWF files (Flash). The Nitro pipeline converts these SWFs into a proprietary `.nitro` bundle format via `billsonnn/nitro-converter`.

**nitro-converter pipeline:**

1. **Input:** SWF files (downloaded from Habbo's CDN or a retro server's asset server, typically at `gordon/{version}/` paths).
2. **Conversion:** The converter extracts ActionScript-embedded graphics from each SWF (furniture, avatars, effects, tiles) and packs them.
3. **Output — `.nitro` bundle:** A binary container that holds:
   - One or more **PNG texture atlases** (sprite sheets)
   - A **JSON manifest** describing sprite regions (frame name → x, y, w, h coordinates within the atlas), animation sequences, asset metadata, and furniture visualization data.
4. The `.nitro` format is read by `nitro-renderer`'s `NitroBundle` loader at runtime and parsed into PixiJS `Spritesheet` objects using `@pixi/spritesheet`'s standard JSON atlas format (compatible with Texture Packer "hash" format).

### Can Assets Be Extracted Standalone (Without Running Full Nitro)?

**Yes.** The `.nitro` bundle is a ZIP-like container. The community has confirmed that `.nitro` files can be unzipped to extract the raw PNG atlas and JSON manifest files directly. These can then be loaded into any Canvas 2D or PixiJS renderer without the full Nitro stack.

**Workflow for standalone use:**
1. Run `nitro-converter` against SWF files to produce `.nitro` bundles.
2. Unzip the `.nitro` bundles to get `spritesheet.png` + `spritesheet.json`.
3. Consume the JSON atlas in Canvas 2D (`drawImage` with region lookup) or PixiJS (`Spritesheet` loader).

**nitro-imager** (`billsonnn/nitro-imager`) is a separate server-side avatar renderer that downloads and caches `.nitro` assets and produces rendered PNG images — useful as a reference for headless asset consumption.

### Retrosprite

`Bopified/Retrosprite` is a newer (late 2025/early 2026) GUI tool specifically for viewing, editing, and converting SWF assets into Nitro-compatible JSON formats. It provides a visual interface for the conversion pipeline and targets the Nitro ecosystem. Useful for validating extracted sprite data.

### Key Limitation

The SWF source assets themselves are proprietary Sulake property. For a personal tool targeting Habbo v14, you must supply your own SWFs from a v14 retro server (e.g., Kepler, Odin, or a personal archive). The converter and the `.nitro` format are open-source; the SWFs are not.

---

## Alternative Asset Sources

### Pre-Extracted Habbo Nitro Asset Repositories

| Repository | Description | Status |
|------------|-------------|--------|
| `sphynxkitten/nitro-assets` | Community-maintained collection of pre-converted `.nitro` bundles including furniture, clothes, effects, and pets. Completely reconverted with updated `HabboAvatarActions.json`. | Active (2024–2025) |
| `TamedWolfy/Nitro` | Additional Nitro assets collection. | Active |
| `Holo5/nitro-docker` | Docker stack that self-hosts a full nitro-assets server; pulls from `nitro-swf` and pre-extracts all assets to `nitro-assets`. | Active |

**Note:** These repositories contain assets converted from Habbo's proprietary SWFs. They are usable for personal tools but are not licensed for redistribution or commercial use. Sulake's ToS applies.

**Sprite Database** (spritedatabase.net/game/2735) hosts catalogued Habbo sprites including v14-era furniture, but as individual PNG exports rather than production-ready atlases.

### Extraction Tools

| Tool | Language | Output | Notes |
|------|----------|--------|-------|
| `billsonnn/nitro-converter` | TypeScript/Node | `.nitro` bundles (PNG atlas + JSON) | Primary tool for modern Nitro pipeline |
| `scottstamp/FurniExtractor` | C# | PNG + JSON per furniture item | Simpler, outputs individual PNGs and Habbo-format JSON; good for selective extraction |
| `dank074/habbo-asset-extractor` | PHP | PNG images from SWF | Older, extracts raw images without atlas packing |
| `Quackster/Chroma` | .NET/C# | PNG renders per furniture | Server-side renderer; SWFs in `/swfs/hof_furni/`; outputs isometric renders via HTTP API |
| `Quackster/Elias` | Java/C# | CCT format (v14-era binary) | Converts modern SWF furniture back to v14 `.cct` format — useful for v14 server compatibility |
| `Bopified/Retrosprite` | Electron/TypeScript | JSON + PNG (Nitro-compatible) | GUI editor/converter; released early 2026 |
| `duckietm/All-in-1-converter` | Multi | Various | Community fork combining multiple converter tools |
| `higoka/habbo-downloader` | TypeScript/Node | Raw SWF download | Downloads SWFs from Habbo CDN before conversion |

### Habbo v14-Specific Resources

- **Quackster/Kepler** — Most complete open-source Habbo v14 (2007-era) server emulator in Java. The release packages include asset sets appropriate for v14, which can be fed into extraction tools.
- **Webbanditten/Odin** — Alternative Habbo Hotel v14 server in Java.
- The v14 client used `.dcr` (Shockwave) and `.swf` files. The SWF furniture assets from later Habbo versions are largely backward-compatible in visual style (isometric, 2:1 diamond tiles, same color palettes). True v14 originals exist in community archives but are not on public GitHub.

### CycloneIO

`itsezc/CycloneIO` is a full-stack open-source Habbo package (CMS + server + client + assets). Its assets sub-package may contain pre-bundled resources.

---

## Font Options

### Volter (Goldfish) — The Authentic Habbo Font

Volter (also called "Volter Goldfish") is the original Habbo Hotel interface font — a bitmap pixel font designed by Sulake (credited to "cocoFabien" on DaFont). Sulake released it under a permissive free license allowing personal and commercial use, modification, and redistribution, with one restriction: it may not be sold as a standalone font product.

- **License:** Free for personal and commercial use; not for resale as a font. Sulake explicitly released this for community use.
- **GitHub mirror:** `eonu/goldfish` — hosts Volter and Volter-Bold as web-ready TTF/WOFF files.
- **Canvas `@font-face` usage:** Fully supported. Load the TTF as a data URI or local resource in the webview, declare `@font-face`, and use `ctx.font = '8px Volter'` on the canvas.
- **Recommendation:** Use Volter for maximum visual authenticity. It is the safest choice for a personal non-commercial tool.

### Open-Source Alternatives (If Volter Is Avoided)

| Font | Size/Style | License | Notes |
|------|------------|---------|-------|
| **Press Start 2P** | 8px bitmap | OFL 1.1 (SIL Open Font License) | Based on 1980s Namco arcade fonts; designed by Codeman38; available on Google Fonts; works at 8px, 16px and multiples of 8 |
| **Dogica / Dogica Pixel** | 8x8 monospace | OFL | GB Studio-designed; 200+ characters; both monospace and kerned variants |
| **m5x7** by Daniel Linssen | 5×7px | CC0 / Free | Available on itch.io; very legible at small sizes; commonly used in indie pixel art games |
| **Pixeldroid fonts** (`pixeldroid/fonts` on GitHub) | Various | OFL | Collection of open-source pixel fonts for game development |
| **Minimalist Pixel Fonts** (OpenGameArt) | Various | CC0/OFL | Community-contributed, suitable for canvas use |

### Canvas `@font-face` Integration Pattern

```html
<style>
  @font-face {
    font-family: 'Volter';
    src: url('${webview.assetUri('fonts/volter.ttf')}') format('truetype');
  }
</style>
```

```typescript
// After font load, use in canvas context:
ctx.font = '8px Volter';
ctx.fillStyle = '#ffffff';
ctx.fillText('Room 1', x, y);
```

Fonts must be served from the extension's static assets (via `vscode.Uri.joinPath` + `webview.assetUri`). External Google Fonts CDN URLs require relaxing `style-src` and `font-src` to include `https://fonts.googleapis.com` and `https://fonts.gstatic.com`, which is possible but adds attack surface. Bundling the TTF file locally is recommended for a personal tool.

---

## Recommendations

| Component | Choice | Version | Rationale |
|-----------|--------|---------|-----------|
| Rendering engine | Canvas 2D | Browser native | Zero bundle overhead; sufficient for a VS Code tool panel; not blocked by webview CSP; upgrade path to PixiJS v8 is straightforward |
| Rendering fallback/upgrade | PixiJS | v8.x (2024+) | If animation, scrolling, or per-frame performance becomes a bottleneck; confirmed working in Electron; no `unsafe-eval` required; `scuti-renderer` provides Habbo-specific reference implementation |
| Asset extraction | nitro-converter | Latest (Node 18+) | Primary tool; outputs `.nitro` bundles (PNG atlas + JSON manifest) that unzip to standalone web-compatible assets |
| Asset source (pre-extracted) | sphynxkitten/nitro-assets | Latest | Community-maintained pre-extracted Nitro bundles; fastest path to getting furniture/avatar assets without running the full pipeline |
| Quick SWF-to-PNG (furniture only) | scottstamp/FurniExtractor | Latest | Simpler C# tool for selective furniture extraction when full nitro-converter pipeline is excessive |
| Habbo v14 server reference | Quackster/Kepler | Latest release | Most complete v14 emulator; provides compatible asset set |
| Pixel font (authentic) | Volter (Goldfish) | v1.0 | Sulake-released; free for personal use; visually identical to original Habbo UI |
| Pixel font (pure OFL fallback) | Press Start 2P | Latest | OFL 1.1; on Google Fonts; bundle locally as TTF for webview use |
| Reference isometric renderer | mathishouis/scuti-renderer | Latest | Open-source Habbo room engine in TypeScript + PixiJS; study its tile math, sprite loading, and depth sorting |

### Additional Implementation Notes

1. **Isometric tile math:** Standard 2:1 diamond projection. Habbo tiles are 64px wide × 32px tall (screen space). Tile origin at top diamond vertex. Furniture sprites have additional y-offset encoded in the JSON manifest.

2. **Depth sorting:** Paint order is row-major (back-to-front), then within a row, objects closer to the viewer (lower row index + higher column index) paint last. Habbo encodes this in the `z` value in its furniture visualization XML.

3. **`.nitro` bundle access:** The bundle is a standard ZIP file. Use Node's built-in `zlib` or the `jszip` library to unpack PNG and JSON at build time (pre-process assets before bundling into the extension) rather than at runtime in the webview.

4. **CSP for bundled assets:** All fonts, images, and scripts should be served from the extension's own `dist/` folder. Use `webview.assetUri()` to generate safe `vscode-resource:` URIs. No external CDN dependencies.

5. **React 19 + Canvas integration:** Mount the canvas via a `ref` in a `useEffect`. Use `useRef<HTMLCanvasElement>` to get the 2D context. Avoid React re-renders driving canvas redraws — use a separate render loop (or single paint call) that reads from a separate state model.

---

_Sources consulted: GitHub repositories (billsonnn/nitro-converter, billsonnn/nitro-renderer, mathishouis/scuti-renderer, scottstamp/FurniExtractor, sphynxkitten/nitro-assets, eonu/goldfish, Quackster/Kepler, Bopified/Retrosprite, dank074/habbo-asset-extractor, pixijs/pixijs); VS Code extension API documentation; Google Fonts (Press Start 2P); FontLibrary (Dogica); meshcloud GPU acceleration blog; Trail of Bits VSCode security blog._

# Features Research

## Table Stakes (must preserve from pixel-agents)

These features from the original pixel-agents extension must survive the flat-to-isometric
rendering swap unchanged. Only the draw calls change; logic stays identical.

| Feature | Original behaviour | Isometric implementation note |
|---|---|---|
| Character-per-agent mapping | Each Claude Code terminal session spawns one character | Map terminal ID -> isometric avatar; spawn on door tile |
| Animation states | walk / idle / type / read / waiting | Map to Habbo action codes: wlk / std / wav (type analogue) / std+gesture (read) / std+speech bubble (waiting) |
| Office layout editor | Paint tiles, place/rotate furniture, per-tile HSB colour | Keep tile grid as the underlying data model; render each tile as 64x32 isometric diamond |
| 6 character palette variants | Six distinct colour palettes per character | Map each palette to a Habbo figure-code colour group (skin tone + clothing set) |
| Sub-agent parent/child visualisation | Lines or indicators linking parent to child agents | Render a pixel-line drawn in isometric screen space from parent avatar foot to child avatar foot |
| Matrix spawn/despawn effects | Cascading pixel effect on spawn/despawn | Cascade from top of avatar sprite downward; reuse screen-space pixel column approach |
| BFS pathfinding on tile grid | BFS finds walkable path between tiles | BFS is purely logical on the tile grid; isometric view has no impact on the algorithm itself |
| Notification sounds | Audio cues for agent events | No change — audio subsystem is render-layer independent |
| Persistent layouts | Room layout saved to disk | Serialise as heightmap string (Habbo format: "0"-"9" for height, "x" for void, door coordinates) plus furniture manifest |

---

## Habbo Room Visual Requirements

### Isometric Projection

Habbo uses a 2:1 isometric projection (not true dimetric; the tile top face is a rhombus where
width:height = 2:1). The mathematical constants confirmed across multiple open-source renderers
(shroom, bobba_client, scuti-renderer, nitro-renderer) are:

```
TILE_WIDTH       = 64 px   (full tile width measured at the widest horizontal point)
TILE_HEIGHT      = 32 px   (full tile height = half of width, the 2:1 ratio)
TILE_WIDTH_HALF  = 32 px
TILE_HEIGHT_HALF = 16 px
```

Coordinate projection from grid (map.x, map.y) to screen (screen.x, screen.y):

```
screen.x = (map.x - map.y) * TILE_WIDTH_HALF
screen.y = (map.x + map.y) * TILE_HEIGHT_HALF
```

Reverse (screen -> map, floating point):

```
map.x = screen.x / TILE_WIDTH  + screen.y / TILE_HEIGHT
map.y = screen.y / TILE_HEIGHT - screen.x / TILE_WIDTH
```

### Floor Tiles

- Each walkable tile is drawn as a filled 64x32 rhombus (diamond shape).
- Tiles support per-tile elevation (height level 0-9 in Habbo heightmap notation). Each height
  unit raises the tile's screen.y by TILE_HEIGHT_HALF (16 px), creating stair steps.
- Tile shading: the top face is the lightest; the left-facing side face is medium; the
  right-facing side face is the darkest. Classic Habbo uses a fixed 3-tone shading rather than
  dynamic lighting.
- Tile floor texture: a flat colour or pixel-pattern fill with a 1 px dark outline. In the
  pixel-agents context a plain mid-grey fill is sufficient; per-tile HSB colour from the existing
  layout editor maps directly onto this fill.
- Void (un-walkable) tiles: simply not drawn; the underlying panel background shows through.

### Wall Structure

Habbo rooms have two wall surfaces visible from the camera: the left wall (runs along the X axis)
and the right wall (runs along the Y axis). A third surface (corner pillar) appears where they meet.

```
WALL_HEIGHT      = ~115 px (varies by room setting; Habbo's UI exposes a slider;
                             a sensible default for the extension is 3.5 * TILE_HEIGHT = 112 px)
WALL_THICKNESS   = 8 px    (the narrow front face of each wall strip)
FLOOR_THICKNESS  = 8 px    (the underside ledge of the floor visible at the room edge)
```

- Left wall: drawn along the top-left edge of the room. Each wall strip is 32 px wide (one
  TILE_WIDTH_HALF) and WALL_HEIGHT tall.
- Right wall: drawn along the top-right edge of the room. Mirror of left wall in screen space.
- Corner pillar: a single vertical strip at the intersection point.
- Wall shading: left wall is lighter than right wall (simulating a light source from the
  upper-left). Classic Habbo uses approximately 20% brightness difference between the two planes.
- Wall items (posters, windows, clocks): anchored to a specific (x or y) wall column at a
  specific height offset. Left-wall items use x-axis index; right-wall items use y-axis index.

### Furniture Placement Rules

- Every floor furni occupies one or more tiles declared in a size matrix (e.g., 1x1, 2x1, 2x2).
- Furni renders with its anchor point (usually the back-bottom corner of its bounding box) at the
  tile's screen position.
- Furni can be rotated in 90-degree increments (directions 0, 2, 4, 6 in the Habbo 0-7 system
  where only cardinal directions apply to most furniture).
- Furni can be stacked vertically; each furniture item has a declared height in half-tile units
  (stored as z-offset). The Stack Magic Tile exposes z from 0.0 to 40.0 in 0.5 increments.
- Wall items have no z stacking; they layer by y-position on the wall surface.

### Depth Sorting (Z-Ordering)

Habbo uses a painter's-algorithm approach: draw everything back-to-front based on a computed
sort key. The primary sort key for an object at grid position (x, y, z) is:

```
sortKey = x + y + z * epsilon
```

where epsilon is a small fraction ensuring tall stacked items still sort above their tile.
For multi-tile furni, the sort key uses the furni's maximum (x + y) corner.

For objects occupying the same tile, secondary sort order is:
1. Floor tile (lowest)
2. Floor furni (by z-height, ascending)
3. Avatars (above furni at their tile's z-height)
4. Speech bubbles / name tags (always on top)

The general algorithm used by shroom and bobba_client is:

```
renderList.sort((a, b) => {
  const aKey = a.tileX + a.tileY + a.tileZ * 0.001
  const bKey = b.tileX + b.tileY + b.tileZ * 0.001
  return aKey - bKey
})
```

For pixel-agents this simplifies further because there is no user-placed furniture with
arbitrary stacking: furniture is pre-authored in the layout editor, enabling a single static
sort pass at layout load time. Avatars re-sort on every move step.

For multi-tile objects that overlap on screen, correct ordering requires topological sort
(dependency graph where "A must be drawn before B" edges are established by checking axis-
aligned bounding box overlap in isometric space). For the pixel-agents scope (small room,
limited furniture, no user stacking), the simple x+y+z key is sufficient.

### Room Layout Data Format

Habbo heightmap string format (adopted from retro emulators):

```
"00000"   <- row 0, 5 tiles wide, all at height 0
"01110"   <- row 1, centre three tiles at height 1 (one step up)
"x0000"   <- 'x' = void tile (no floor drawn, no walking)
```

Door is specified as a separate (x, y, direction) tuple. Direction uses the Habbo 0-7 scheme.

---

## Avatar Animation Structure

### Direction System

Habbo avatars support 8 facing directions numbered 0-7 clockwise starting from north-east:

```
Direction  Facing (from camera)
0          North-East  (away-right diagonal)
1          East         (right)
2          South-East  (toward-right diagonal)  <- most common "front" view
3          South        (toward camera, full front)
4          South-West  (toward-left diagonal)
5          West         (left)
6          North-West  (away-left diagonal)
7          North        (away from camera, full back)
```

Body direction and head direction are independent parameters, allowing the head to look
at something while the body faces a different way (e.g., standing south but head turning west).

In the classic Habbo isometric view only directions 2, 4, 6, 0 (the four diagonals) are used
for walking; cardinal directions (1, 3, 5, 7) are used for sitting, laying, and waving.

### Action / Posture Codes

| Habbo action code | Meaning | Pixel-agents mapping |
|---|---|---|
| `std` | Standing (idle) | idle state |
| `wlk` / `mv` | Walking | walk state |
| `sit` | Sitting on furniture | (not used; agents don't sit) |
| `lay` | Laying flat | (not used) |
| `wav` | Waving | type state (active tool call) |
| `respect` | Respect gesture | (optional: celebrate / task complete) |
| `blow` | Blowing kiss | (not used) |
| `laugh` | Laughing | (optional: idle variant) |

### Gesture / Expression Codes

These modify only the face layer and stack with posture actions:

| Code | Expression |
|---|---|
| `std` | Neutral |
| `sml` | Smile |
| `sad` | Sad |
| `srp` | Surprised |
| `agr` | Angry / nervous |
| `spk` | Speaking (mouth open) |
| `lol` | Blank (no face) |

Pixel-agents mapping suggestion:
- idle -> `std` gesture
- type (active) -> `sml` or `spk` gesture
- read (search tool) -> `srp` gesture
- waiting (speech bubble) -> `std` gesture
- error / blocked -> `sad` or `agr` gesture

### Frame Counts per Action

Exact frame counts are stored in the client-side `HabboAvatarActions.xml` / `animations.json`
asset files. Based on reverse-engineering documentation and open-source imager implementations:

| Action | Approximate frame count | Notes |
|---|---|---|
| `std` | 1 | Single static frame; eye blink is overlaid as a separate 3-frame sub-animation at random intervals |
| `wlk` | 4 | Four-frame walk cycle per direction (heel-strike, mid, toe-off, float) |
| `wav` | 3 | Three-frame arm raise-hold-lower |
| `sit` | 1 | Static |
| `lay` | 1 | Static |
| `respect` | ~8 | Bow animation |
| Blink overlay | 3 | Frames: open, half, closed; triggered randomly every ~5-10 s |

For the pixel-agents custom sprite approach (not using live Habbo assets): implement as
simple frame loops. A 4-frame walk cycle at 250 ms per frame (4 fps) replicates the classic
Habbo look. Idle adds a blink every 5-8 seconds via a 3-frame eye overlay.

### Body Part Layer Composition

Each avatar is composited from independently rendered layers in a specific z-order (back to front).
Based on the Habbo figure rendering specification:

```
Layer order (back -> front, i.e., render in this sequence):
  1. Body / torso (hd - head+body skin)
  2. Legs (lg)
  3. Shoes (sh)
  4. Shirt / chest (ch)
  5. Jacket / overlay (cc)
  6. Belt (wa)
  7. Head face (hd face portion)
  8. Hair back part (hr - back layer)
  9. Eyewear (ea)
 10. Hat (ha) / head accessory (he)
 11. Hair front part (hrb when hat is worn)
 12. Face accessory / mask (fa)
 13. Carry item if any (crr)
```

For a simplified custom pixel avatar (not using Habbo SWF assets), this collapses to:
body silhouette -> clothing colour -> head -> hair -> hat/accessory.

### File Naming Convention (for Habbo SWF/Nitro assets if sourced)

```
{library}_{size}_{action}_{partType}_{partId}_{direction}_{frame}

Example: hh_human_hair_h_std_hr_4_2_0
  library  = hh_human_hair
  size     = h (full size) or sh (small/zoomed-out)
  action   = std | wlk | wav | sit | lay
  partType = hd | hr | ch | lg | sh | ha | cc | ea | wa | fa | he
  partId   = numeric part variant ID
  direction = 0-7
  frame    = 0-based frame index
```

---

## Habbo-Specific UI Enhancements

### Speech Bubbles (Authentic v14 Style)

Classic Habbo speech bubbles (visible in the Flash client ca. 2005-2010) are:

- A white rounded rectangle with a 1-2 px dark border.
- A small downward-pointing triangular tail on the bottom-left or bottom-centre anchored to
  just above the avatar's head.
- Text inside uses a small sans-serif bitmap font (Volter/Goldfish at 9 pt, or similar pixel font).
- The bubble auto-sizes horizontally to fit text (capped at ~200 px wide); wraps to a second
  line if needed.
- A "..." (ellipsis) variant appears when the avatar is typing but has not yet sent a message.
  This is a narrower fixed-width bubble with three animated dots.
- Bubble fades/disappears after ~4 seconds of no new text.

Pixel-agents mapping:
- waiting state -> "..." bubble above avatar head (agent is paused, awaiting input, or in a
  long tool call with no output yet).
- speech bubble text -> show the last agent log line or tool name, truncated to ~30 chars.

### Name Tags

Classic Habbo name tags are a simple 1-line label rendered directly above the avatar in screen
space (not isometric space — they always face the camera):

- Dark semi-transparent pill/rectangle background.
- White or yellow text with the avatar/agent name.
- Optionally a small coloured dot indicating status (online = green, busy = yellow, away = grey).

For pixel-agents: show the terminal session name or agent ID. Status dot maps to:
- green = idle
- yellow = active (tool running)
- grey = waiting
- red = error

### Badges

Classic Habbo displayed 1-5 small 40x40 px badge icons below the name tag on a character
info popup (not permanently floating). For pixel-agents this is optional scope:
- A single badge icon could show the current active tool category (file ops, web search, code,
  etc.) as a small 16x16 icon above the name tag.

### Room UI Chrome (classic v14 style elements worth adapting)

| Habbo element | Description | Pixel-agents adaptation |
|---|---|---|
| Chat log panel | Scrolling list of speech at bottom of screen | VS Code output panel — not duplicated in canvas |
| Navigator (room list) | List of rooms to enter | Not applicable (single-room experience) |
| Console / friend list | Right-side slide-out panel | Not applicable |
| Tile highlight | Yellow highlight on tile under cursor | Keep from pixel-agents layout editor |
| Furni rotation indicator | Arrow UI when placing furniture | Keep from pixel-agents layout editor |
| Room enter animation | Avatar walks in from door | Spawn at door tile, walk to first idle position |

### Typing Indicator ("..." bubble)

When an agent is running a tool call that has not yet returned:
- Show a compact speech bubble with three animated dots cycling (. -> .. -> ...) at ~500 ms
  per step.
- This directly replaces the pixel-agents "waiting" speech bubble state with an authentic
  Habbo-style visual.

---

## Differentiators vs Scope Boundaries

### Worth Adding (in scope, adds authenticity without bloat)

| Feature | Rationale |
|---|---|
| Classic 64x32 isometric tile grid | Core visual identity; technically straightforward using Canvas 2D transforms |
| Two-tone wall shading (left lighter, right darker) | Takes ~10 lines of canvas code; makes the room look authentic immediately |
| Painter's-algorithm depth sort (x+y key) | Required for correct visual overlap; simple to implement for a fixed-layout room |
| 4-frame walk cycle per 8 directions | Makes agents feel alive; 4 frames x 8 dirs x ~6 body parts = 192 sprites if custom-drawn |
| Idle blink overlay (3-frame, random interval) | High payoff: single blink animation makes idle avatars feel inhabited |
| "..." speech bubble for waiting state | Directly replicates Habbo's in-progress typing visual; trivial to implement |
| Name tag with status dot | Functional (identifies agent) + authentic (matches Habbo style) |
| Stair tiles (height > 0) | Heightmap already supports multi-level; rendering stairs adds visual depth to complex layouts |
| Per-tile HSB floor colour (from existing editor) | Already exists in data model; just maps to isometric tile fill colour |
| Door tile with enter animation | Spawn effect: avatar walks from door tile to first position; uses existing BFS pathfinder |

### Authentic but Avoid (scope creep / diminishing returns)

| Feature | Reason to defer |
|---|---|
| Live Habbo SWF/Nitro asset pipeline | Licence risk; asset extraction complexity; custom pixel sprites are simpler and sufficient |
| Full 13-layer body-part composition | Overkill for a monitoring tool; a 3-4 layer simplified avatar is visually equivalent at this scale |
| Carry item animations (crr/drk) | No natural agent-state mapping; adds sprite complexity for no clarity gain |
| Group badge system | No multi-user context in a local VS Code extension |
| Wired automation furniture | Habbo-specific game mechanic; irrelevant to agent monitoring |
| Furniture animation (multi-frame furni) | Adds asset complexity; static furniture sprites are fine for the office layout |
| Wall item placement in editor | Useful but adds UI complexity; defer to post-MVP |
| Room effects (confetti, snowfall, etc.) | Decorative only; the matrix spawn/despawn effect from pixel-agents already covers celebratory moments |
| Chat log scrollback in canvas | VS Code already provides the terminal output; duplicating it in canvas is redundant |
| Dynamic lighting | Habbo uses flat shading; dynamic lighting breaks the aesthetic and adds render cost |

### Scope Boundary Statement

The rendering layer change is a drop-in replacement: the agent model, state machine, BFS
pathfinder, layout editor data model, sound system, and persistence layer are untouched.
The only new code is:

1. An isometric coordinate math module (screen <-> grid projection).
2. A depth-sort pass replacing the flat row-major render order.
3. Isometric tile and wall draw routines (Canvas 2D path fills).
4. An avatar sprite system with 8 directions x 4 walk frames + 1 idle + 3 blink overlay frames
   (either custom pixel art or sourced from a freely-licensed Habbo-compatible asset set).
5. Authentic speech bubble renderer (rounded rect + tail + bitmap font).
6. Name tag renderer (pill background + text + status dot).

Everything else is a direct port of existing pixel-agents code.

# Pitfalls Research
## Habbo Pixel Agents — Isometric Rendering Layer
_Research date: 2026-02-28_

---

## VS Code Webview CSP Restrictions

### What the Default Policy Looks Like

VS Code recommends this baseline CSP (set via `<meta>` tag in the webview HTML, not via HTTP headers):

```
default-src 'none';
img-src ${webview.cspSource} https: data:;
script-src ${webview.cspSource};
style-src ${webview.cspSource};
```

`${webview.cspSource}` expands to the `vscode-resource:` scheme, which only covers files served from the extension's own directories (via `webview.asWebviewUri()`). All external origins are blocked.

### What Is Blocked by Default

| Feature | Status | Notes |
|---------|--------|-------|
| `eval()` / `new Function()` / `setTimeout(string)` | BLOCKED | No `unsafe-eval` in default policy; PixiJS v6/v7 needed this, v8 does not |
| Inline `<script>` tags | BLOCKED | No `unsafe-inline`; all scripts must be external files |
| Inline `<style>` tags | BLOCKED | No `unsafe-inline`; styles must be external files |
| External CDN scripts | BLOCKED | `script-src` only allows `${webview.cspSource}` |
| External CDN fonts (Google Fonts) | BLOCKED | `font-src` not in default policy; needs explicit addition |
| `fetch()` / XHR to external URLs | BLOCKED | No `connect-src` for external origins |
| WASM execution | BLOCKED | Requires explicit `wasm-unsafe-eval` token |
| Data URIs for images | **ALLOWED** | `img-src ... data:` is in the recommended policy |
| WebGL | **ALLOWED** | WebGL is a Canvas API capability, not a CSP-gated resource |
| Web Audio API (`AudioContext`) | **PARTIALLY ALLOWED** | See audio section below |

### Web Workers — Confirmed Broken Pattern

Web Workers cannot load scripts from `vscode-resource://` URIs. Chrome enforces cross-origin restrictions: a worker script at `vscode-resource://...` cannot be loaded from the webview's `null` origin context (GitHub issue [#87282](https://github.com/microsoft/vscode/issues/87282), closed 2021, limitation persists).

The blob URL workaround (`URL.createObjectURL(new Blob([workerCode]))`) is the only documented path, but it has downstream problems: the worker cannot use `importScripts()` for additional modules, and any chunk-splitting by the bundler breaks because the worker requests blob-prefixed URLs instead of proper origins.

**Mitigation for this project:** The isometric renderer does not require Web Workers. All rendering is synchronous Canvas 2D in the main thread. Do not design any feature that requires off-thread computation via Workers (e.g., A* pathfinding in a Worker, image decode in a Worker) unless you are prepared to use the blob URL workaround with inline bundled code.

### Audio — The Biggest Surprise

VS Code does **not** ship ffmpeg in its Electron build. This blocks most audio codec decoding in webviews (GitHub issues [#66050](https://github.com/microsoft/vscode/issues/66050), [#54097](https://github.com/microsoft/vscode/issues/54097)).

Confirmed behaviour:
- **MP3 via `<audio>` element:** Often fails — no AAC/MP3 decoder shipped.
- **`AudioContext.decodeAudioData()` on MP3:** Throws `DOMException: Unable to decode audio data` (GitHub issue [#148494](https://github.com/microsoft/vscode/issues/148494)).
- **WAV and OGG:** More likely to work because these formats use uncompressed or open codecs supported by Chromium's built-in decoders without ffmpeg. The `vscode-audio-preview` extension (confirmed working, updated June 2024) supports WAV and OGG and uses a WASM-compiled C++ decoder for formats that need it.

**Confirmed safe approach for Habbo sounds:**
1. Convert all Habbo sound effects to **OGG Vorbis** or **uncompressed WAV** at build time.
2. Serve them via `webview.asWebviewUri()` (local file, no external fetch).
3. Load with `AudioContext.decodeAudioData()` from a fetched `ArrayBuffer`.
4. Add `media-src ${webview.cspSource};` to the CSP meta tag.
5. Gate AudioContext creation behind a user gesture to avoid the autoplay policy block.

**Risk:** Even with OGG, codec availability in Electron varies across VS Code versions. Test audio playback on the actual target VS Code version. If it fails, the fallback is silence (non-critical for a personal tool).

### Asset URIs — Critical Pattern

All static assets (PNG atlases, fonts, audio, JSON manifests) must be served through the `vscode-resource:` scheme. The pattern:

```typescript
// Extension side (TypeScript):
const assetUri = panel.webview.asWebviewUri(
  vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'chair.png')
);
// Pass the URI string into the webview HTML or via postMessage
```

Do not use `file://` URIs — they are rejected. Do not use `data:` URIs for large assets (bloats the HTML). Do not `fetch()` from external URLs without adding `connect-src` to the CSP.

### localResourceRoots Gotcha

If `localResourceRoots` is set to `[]` (empty array), all local file access is blocked — including assets in your own extension's `dist/` directory. Always include the extension's output folder:

```typescript
localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')]
```

Omitting this causes assets to silently return 401/Access Denied with no useful error in the webview console (GitHub Discussion [#2707](https://github.com/microsoft/vscode-discussions/discussions/2707)).

---

## Canvas 2D Performance Pitfalls

### Pitfall 1: Full-Canvas Redraw Every Frame (Overdraw)

**What goes wrong:** Calling `ctx.clearRect(0, 0, canvas.width, canvas.height)` every `requestAnimationFrame` then redrawing all tiles, furniture, and avatars clears and repaints every pixel even when nothing moved.

**Why it matters for isometric tile maps:** A 20×20 Habbo room has 400 floor tiles. Each tile is a filled rhombus path (`beginPath` + 4 `lineTo` + `fill`). At 30 fps, that is 12,000 path draw calls per second for the floor alone, before furniture or avatar sprites.

**Mitigation strategies (in order of implementation cost):**

1. **Layer separation with multiple canvases (LOW cost, HIGH impact):** Render static elements (floor tiles, walls, furniture) to an offscreen canvas once; composite to the main canvas on each frame with a single `drawImage`. Only redraw the offscreen canvas when the layout changes. Avatar and bubble layers redraw every frame on the main canvas only.

2. **Dirty rect tracking (MEDIUM cost):** Track which tiles changed (agent moved, tile colour changed) and call `ctx.clearRect` + redraw only the bounding box of changed elements. Requires maintaining a dirty-flag per renderable.

3. **Skip frames when idle (LOW cost):** If no agent state changed since the last frame, skip the `clearRect` + redraw entirely. Add a boolean `isDirty` flag to the render loop.

**Habbo-specific note:** The room background (floor + walls) is fully static between agent actions. Pre-render it once to `OffscreenCanvas` at startup and blit it every frame with one `drawImage` call.

### Pitfall 2: `ctx.save()` / `ctx.restore()` in Tight Sprite Loops

**What goes wrong:** Calling `ctx.save()` and `ctx.restore()` for every sprite draw (e.g., once per avatar body part, once per furniture layer) causes excessive state stack allocations. For a room with 10 agents × 8 body-part layers = 80 save/restore pairs per frame.

**Mitigation:** Set `ctx.globalAlpha`, `ctx.globalCompositeOperation` once before the sorted draw list loop. Restore manually by re-setting the values rather than using save/restore. Only use save/restore when the state change is truly complex (e.g., clipping paths for speech bubble tails).

### Pitfall 3: Depth Sorting Failure for Multi-Tile Furniture

**What goes wrong:** The simple sort key `tileX + tileY + tileZ * epsilon` breaks for furniture larger than 1×1 tiles. A 2×2 table has four tile positions; if the sort key is computed from its origin tile only, it can paint over avatars standing on adjacent tiles that should appear "in front of" the table.

**Why it happens:** The painter's algorithm requires a total ordering of all drawables. Multi-tile objects violate this ordering when their bounding box overlaps other objects along the sort axis.

**Mitigation:** For each multi-tile furniture item, compute the sort key from its **farthest tile from the camera** (max `tileX + tileY` in the footprint), not its origin tile. For the pixel-agents scope (desk + chair minimum), this is a one-time fix at the furniture placement code level.

**The deeper problem:** Topological cycles in the depth order (sprite A is "in front of" sprite B which is "in front of" sprite A due to overlap) are unresolvable with the painter's algorithm. Habbo's original renderer avoided this through room design conventions (furniture does not overlap avatars in ways that create cycles). Follow the same convention: do not place furniture that creates visual cycles with agent walking paths.

### Pitfall 4: Sprite Atlas Decode Cost on First `drawImage`

**What goes wrong:** When an `HTMLImageElement` is passed to `drawImage` for the first time, the browser decodes the compressed PNG and uploads it to the GPU texture cache. This causes a single-frame hitch (often 20-50 ms for a 1024×1024 atlas).

**Mitigation:** After loading the PNG image element, call `createImageBitmap(img)` immediately to force decode and create a GPU-resident `ImageBitmap`. Store the `ImageBitmap` instead of the raw `HTMLImageElement` in the sprite cache, and use it in all subsequent `drawImage` calls. `ImageBitmap` draws are significantly cheaper because no decode happens at draw time.

**Warning:** `createImageBitmap` is asynchronous. Ensure the load sequence is: `Image.onload` → `createImageBitmap(img)` → store result → mark sprite as ready. Do not draw from the sprite cache until the `ImageBitmap` is available.

### Pitfall 5: `ctx.beginPath()` Without `ctx.closePath()` in Rhombus Drawing

**What goes wrong:** If `ctx.beginPath()` is called before each tile but `ctx.closePath()` is omitted, the path accumulates across calls in some browser/Electron versions, growing unboundedly. The cost of `ctx.fill()` grows linearly with path length.

**Mitigation:** Always call `ctx.closePath()` after the last `lineTo` of each rhombus, before `ctx.fill()`. Alternatively, call `ctx.beginPath()` before every tile (this implicitly discards the previous path, but is explicit).

### Pitfall 6: `requestAnimationFrame` Scheduling in an Inactive Webview Panel

**What goes wrong:** VS Code webview panels can be hidden (the user switches to another editor tab). When hidden, the webview iframe is not destroyed — it keeps running. The `requestAnimationFrame` loop continues firing but at a throttled rate (typically 1 fps or paused entirely). When the panel becomes visible again, the loop may fire multiple times in rapid succession to "catch up", causing frame bursts.

**Mitigation:** Use the `document.visibilitychange` event to pause the rAF loop when the panel is hidden:

```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(rafId);
  } else {
    rafId = requestAnimationFrame(renderLoop);
  }
});
```

---

## Asset Licensing Risk

### Sulake DMCA History

Sulake Corporation Oy holds copyright over all Habbo Hotel assets: sprites, sounds, fonts (Volter), and the game client SWF files. Their enforcement history on GitHub (documented in the public DMCA repo at `github/dmca`):

- **March 2015:** Two separate DMCA notices targeting five repositories (HabboPHP, Snowlight, BloonPHP, Habbo-Server, and others). The legal theory was Section 1201 of the DMCA — "bypass of technological protection measures" — not simple copyright infringement. One counter-notice was filed and the complaint was disputed.
- **No documented GitHub DMCA takedowns from Sulake between 2016-2025** appear in the public `github/dmca` repository.

### Community Consensus on Risk Profile

Based on community sources (DevBest forums, Habbo Wiki):

1. **Sulake's primary enforcement focus is monetisation.** Projects operating paid retro hotels (charging credits or selling virtual goods) are the primary targets. Open-source tools that do not compete commercially with Habbo have historically been left alone.
2. **There are too many retro projects for comprehensive enforcement.** Sulake has acknowledged this implicitly by reducing enforcement frequency.
3. **GitHub projects with "Habbo" in the name or README were targeted in 2015.** The DMCA complaint admitted this was partly triggered by the word "Habbo" in repository names, not just the code content.
4. **Asset redistribution is the highest-risk act.** Distributing extracted SWF files or packaged Nitro bundles is riskier than distributing a renderer that expects the user to supply their own assets.

### Risk Classification for This Project

| Action | Risk Level | Reasoning |
|--------|------------|-----------|
| Using pre-extracted assets from `sphynxkitten/nitro-assets` locally | LOW | Personal use only; no redistribution; no monetisation |
| Committing extracted PNG/JSON assets to a **private** git repo | LOW | No public distribution |
| Committing extracted PNG/JSON assets to a **public** git repo | MEDIUM | Public distribution of Sulake IP; remains in community-tolerated zone but is higher exposure |
| Distributing the VS Code extension (marketplace or direct) with bundled Sulake assets | HIGH | Distribution of copyrighted content; much higher exposure than personal-only use |
| Using Volter font (Goldfish) | LOW | Sulake explicitly released Volter for free personal and commercial use; not for resale as a standalone font product. See STACK.md. |
| Using Habbo sound effects | LOW-MEDIUM | No explicit license grant from Sulake for sounds; personal use only; not distributing publicly |

**Recommended stance:** Keep extracted assets out of any public repository. Reference `sphynxkitten/nitro-assets` as the source in documentation, do not commit the binary files to this repo. Document clearly that the tool is personal-only and requires the user to supply their own assets (or fetch from `nitro-assets`) to run.

### Sounds Specifically

No explicit license grant exists for Habbo sound effects. The community norm is to use them in personal retro projects without issue. For this tool (personal, non-distributed), the risk is negligible. If the project ever goes public or distributed, sounds should be replaced with royalty-free alternatives.

---

## Nitro Asset Completeness

### What `sphynxkitten/nitro-assets` Contains

Categories confirmed present in the repository:
- Furniture (floor furni, wall furni)
- Clothing / figure parts
- Effects
- Pets
- Game data JSON (furnidata, figuredata, figuremap, HabboAvatarActions.json)

### Known Completeness Gaps

The maintainer's own README states: *"Completely reconverted as I lost track of additions and converter updates."* This means the repository is periodically bulk-reconverted rather than incrementally maintained. Specific gaps:

1. **v14-era classic furniture is not guaranteed to be present.** The repository tracks Habbo's live CDN assets, which are modern Habbo Hotel (current era). Classic v14 (2007-era) furniture that no longer exists in the live game may be missing or visually restyled. Example: original wooden stools, classic desks, and early Habbo chairs that were redesigned post-2010.

2. **Custom furniture is not covered.** The README explicitly notes: *"conversion is for default furniture only, with custom furniture requiring separate handling."*

3. **HabboAvatarActions.json was broken until February 2024.** The most recent documented update (05/02/24) was specifically to fix this file. Any project set up before that date and using a stale copy may have broken avatar animations.

4. **The avatar figure composer is incomplete for v14 looks.** The avatar sprite system in Nitro is designed for the modern Habbo figure format. Classic v14 avatar clothing and body parts may not have direct equivalents. For this project, this is partly mitigated by using the 6-variant palette system (fixed character sprites) rather than a full avatar composer.

5. **No room background / wallpaper assets.** Background textures and wallpapers exist as separate SWF assets not included in the furniture extraction. Programmatically drawn walls (Canvas 2D path fills) avoid this gap entirely.

### Furniture Specifically Needed for pixel-agents V1

The project requires these 8 furniture types (from PROJECT.md):
- Desk (or table)
- Chair
- Computer / monitor
- Lamp or light
- Plant or decoration
- Bookshelf or cabinet
- Rug or floor mat
- Whiteboard or notice board

All 8 are standard Habbo furniture types that exist in modern furnidata. They should be present in `sphynxkitten/nitro-assets`. However, the **v14-era visual style** of these items (lower polygon, slightly different color palette) may differ from what is in the repository. Verify each item visually before committing to it.

### Mitigation Plan for Gaps

1. **Validate each required furniture item exists** in the pre-extracted assets before writing the furniture renderer.
2. **For missing classic v14 items**, use the closest modern equivalent (isometric projection and 64px tile size are unchanged; only the texture/colour differs).
3. **If the avatar figure system is too complex**, continue with the palette-variant approach (fixed sprites per character variant) which does not require the full Nitro avatar composer.
4. **Fallback extraction path:** Run `billsonnn/nitro-converter` against SWFs from a Kepler v14 server asset set if v14-specific items are required that are missing from `sphynxkitten/nitro-assets`.

---

## React + Canvas Game Loop Pitfalls

### Pitfall 1: React StrictMode Double-Mount Breaks the Render Loop

**What goes wrong:** React 19 in development mode (StrictMode) mounts, unmounts, and remounts every component once immediately after the initial mount. This means `useEffect` runs twice. For a canvas game loop, this results in:
- Two `requestAnimationFrame` loops running simultaneously
- Double the draw calls per frame
- The cleanup function from the first mount is called on the *second* mount's cleanup function (a React bug, GitHub issues [#25614](https://github.com/facebook/react/issues/25614), [#30835](https://github.com/facebook/react/issues/30835))

**Why it's dangerous specifically for canvas:** If the rAF loop ID is stored in a module-level variable (or not stored at all), the cleanup function may cancel the wrong loop or no loop, leaving a ghost loop running after unmount.

**The correct pattern:**
```typescript
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let animId: number;
  let running = true;

  function loop() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // ... draw ...
    animId = requestAnimationFrame(loop);
  }

  animId = requestAnimationFrame(loop);

  return () => {
    running = false;          // stop the loop from scheduling new frames
    cancelAnimationFrame(animId); // cancel the pending frame
  };
}, []); // empty deps — mount/unmount only
```

The `running` boolean is critical. It ensures that even if the cleanup is called with a stale `animId` (the StrictMode double-mount bug), the loop function itself will self-terminate on the next tick.

### Pitfall 2: Stale Closures Capturing Outdated Agent State

**What goes wrong:** The rAF loop callback closes over React state at the time of `useEffect` execution. If agent state (positions, animation frames, speech bubbles) is held in React `useState`, the loop captures the initial empty state and never sees updates.

**Why it happens:** `useEffect` with `[]` dependencies runs once at mount. The loop closure captures the state value from that moment. Subsequent `setState` calls do not update the closure's captured reference.

**The correct pattern:** Store mutable render state in a `useRef`, not `useState`. The ref's `.current` is always the latest value:
```typescript
const agentStateRef = useRef<AgentMap>({});

// Update from message handler (no re-render triggered):
agentStateRef.current[id] = { ...newState };

// Read in rAF loop (always current):
const agents = agentStateRef.current;
```

React `useState` is appropriate for triggering UI re-renders (e.g., toggling a settings panel). It is inappropriate as the primary store for game state consumed by a rAF loop.

### Pitfall 3: Canvas Size Mismatch (CSS Pixels vs Device Pixels)

**What goes wrong:** Setting `canvas.width` and `canvas.height` equal to the CSS layout size (e.g., `800 × 600`) on a HiDPI display (devicePixelRatio = 2) results in blurry rendering because the canvas rasterizes at 800×600 but is displayed at 1600×1200 CSS pixels scaled down by the browser.

**Mitigation:**
```typescript
const dpr = window.devicePixelRatio || 1;
canvas.width = canvas.offsetWidth * dpr;
canvas.height = canvas.offsetHeight * dpr;
ctx.scale(dpr, dpr); // scale all draw calls to compensate
```

This is particularly visible with pixel art sprites — blurring a 64×32 isometric tile at 2× DPR destroys the crisp pixel-art aesthetic.

Also set `ctx.imageSmoothingEnabled = false` when drawing pixel sprites to prevent bilinear interpolation.

### Pitfall 4: React Re-renders Triggering Canvas Redraws

**What goes wrong:** If the parent component re-renders (e.g., VS Code theme changes, a sidebar state update), and the canvas is inside the re-rendering component tree without memoisation, the entire canvas element may be recreated. This:
- Destroys the existing 2D context
- Clears the canvas content
- Causes the `useEffect` cleanup to run and then re-run, restarting the loop

**Mitigation:** Wrap the canvas component in `React.memo` and pass only stable props. Extract agent state updates from React's render path into `useRef` (see Pitfall 2). The canvas component should ideally have zero re-renders after initial mount.

### Pitfall 5: Message Handler and rAF Loop Race Condition

**What goes wrong:** The VS Code extension sends agent updates via `window.addEventListener('message', handler)`. The handler updates render state. The rAF loop reads render state. If the handler runs during a partially-complete draw pass, you can get torn frames (avatar at position A, furniture drawn for position B).

**Mitigation:** The handler should write to a double-buffered state ref or a queue. The rAF loop reads from the current buffer at the start of each frame:
```typescript
// Pending updates queue (written by message handler):
const pendingUpdates = useRef<AgentUpdate[]>([]);

// In rAF loop (first thing each frame):
const updates = pendingUpdates.current.splice(0);
updates.forEach(applyUpdate); // mutates agentStateRef.current
```

This is effectively a producer-consumer pattern over a shared array. Since JavaScript is single-threaded, no mutex is needed — the splice is atomic within a single event loop turn.

---

## Build/Bundle Pitfalls

### Pitfall 1: esbuild `file` Loader + VS Code Asset URIs Don't Mix

**What goes wrong:** esbuild's `file` loader copies assets to `outDir` and embeds the **relative file path string** in the bundle (e.g., `"./assets/chair.png"`). In a VS Code webview, this path is meaningless — assets cannot be loaded from relative paths because the webview runs from a `null` origin. The URL must be a `vscode-resource://` URI generated via `webview.asWebviewUri()`.

**Root cause:** esbuild's `publicPath` option prefixes the stored path string with a static base URL. VS Code asset URIs are dynamic (they include a nonce that changes per session), so they cannot be set at build time.

**The correct approach — do not import PNGs or audio files in JS bundles for webview assets.** Instead:
1. Copy assets to `dist/webview-assets/` using a separate build step (Node `fs.cpSync`, or `cp -r` in the build script).
2. In the extension TypeScript code, construct the `vscode-resource://` URI using `webview.asWebviewUri()` and pass the URI string into the webview via the initial HTML template or via a `postMessage`.
3. In the webview code, receive the asset URI map and load images/audio using standard `new Image()` + `src = uri` or `fetch(uri)`.

This avoids the esbuild asset path problem entirely because assets are never imported as ES modules.

### Pitfall 2: `.nitro` Binary Files Are Not a Recognized esbuild Format

**What goes wrong:** If `.nitro` files are placed in a directory that esbuild processes, it will fail with "No loader is configured for '.nitro' files" or silently skip them.

**Mitigation:**
- Do not pass `.nitro` files through esbuild at all.
- The recommended pipeline is: run a Node.js pre-build script (`extractNitro.ts`) that reads the binary `.nitro` files and outputs PNG + JSON pairs into `dist/webview-assets/`. These outputs are then served as static files, not bundled.
- If `.nitro` files are large (some furniture bundles are 500 KB+), do not embed them in the JS bundle even with the `binary` loader. Embedding them bloats the bundle and re-encodes them as base64, tripling the in-memory size at load time.

### Pitfall 3: PNG Atlas Size and Data URI Bloat

**What goes wrong:** Using esbuild's `dataurl` loader for PNG atlases embeds the PNG as a base64 data URI inside the JS bundle. A 512×512 PNG atlas (~100 KB compressed) becomes ~133 KB of base64 text inside the JS. A 1024×1024 atlas becomes ~500 KB of text. At 5-10 atlases for a full furniture set, this can add 2-5 MB to the webview bundle.

**Impact:** Webview first-load time increases significantly. VS Code does not cache webview bundles across sessions in the same way a browser caches page assets.

**Mitigation:** Use the `copy` loader or a post-build file copy step to keep PNG atlases as separate files served via `vscode-resource://` URIs. The webview loads them on demand using `new Image()`.

### Pitfall 4: TypeScript Path Aliases Break in Webview Bundles

**What goes wrong:** If `tsconfig.json` defines path aliases (e.g., `"@shared/*": ["src/shared/*"]`), esbuild resolves them only if explicitly configured via `alias` in the esbuild config. Forgetting to configure aliases results in runtime "Cannot find module '@shared/...'" errors that only appear in the bundled webview, not during `tsc` typecheck.

**Mitigation:** Mirror all `tsconfig` `paths` entries in the esbuild `alias` config. Validate by checking the bundled output includes the actual shared code, not a failed `require('@shared/...')` call.

### Pitfall 5: Separate Extension and Webview Build Configs Required

The VS Code extension has two separate entry points with different targets:
- **Extension host** (`src/extension.ts`): targets Node.js (`platform: 'node'`), can use `require('vscode')`, `require('fs')`, etc.
- **Webview UI** (`src/webview/index.tsx`): targets browser (`platform: 'browser'`), cannot use Node.js built-ins.

**What goes wrong:** Using a single esbuild config for both or accidentally importing Node.js modules from the webview bundle results in runtime errors like "Buffer is not defined" or "process is not defined" inside the webview.

**Mitigation:** Two separate esbuild configurations, two separate output files. The extension host external-izes `vscode`. The webview bundle marks `vscode` as an empty module (it's not available in the browser context).

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Audio playback fails in webview (no MP3 codec) | HIGH | MEDIUM | Convert all sounds to OGG Vorbis; test on target VS Code version; accept silence as fallback |
| Web Worker pattern attempted, breaks on blob URL | MEDIUM | LOW | Avoid Workers entirely; all rendering is single-threaded Canvas 2D |
| React StrictMode double-mount breaks rAF loop | HIGH (dev only) | MEDIUM | Use `running` boolean guard in loop; test both dev and production builds |
| Stale closure in rAF captures empty agent state | HIGH | HIGH | Store all game state in `useRef`, not `useState` |
| esbuild `file` loader breaks webview asset paths | HIGH | HIGH | Never import PNGs/audio in JS; use separate copy step + asWebviewUri() |
| `.nitro` extraction gives wrong binary format | MEDIUM | MEDIUM | Validate extraction output against Retrosprite; check BigEndian header |
| Classic v14 furniture missing from nitro-assets | MEDIUM | MEDIUM | Inspect each required item visually before committing; fallback to modern equivalent |
| Multi-tile furniture depth sort fails | MEDIUM | LOW | Use farthest-tile sort key for multi-tile items; validate with 2×2 desk placement |
| Sulake DMCA for assets in public repo | LOW | HIGH | Keep extracted assets in private storage; never commit Sulake IP to public repo |
| Habbo sound effects copyright enforcement | LOW | LOW | Personal tool only; no distribution; convert to OGG to avoid MP3 codec issues regardless |
| Canvas HiDPI blurry rendering | HIGH | MEDIUM | Apply devicePixelRatio scaling at canvas init; set imageSmoothingEnabled=false |
| PNG atlas first-draw hitch | MEDIUM | MEDIUM | Pre-decode with createImageBitmap after load; store ImageBitmap in sprite cache |
| `ctx.save()/restore()` loop overhead | MEDIUM | LOW | Set render state once per draw pass, not per sprite |
| localResourceRoots misconfigured, assets 404 | MEDIUM | HIGH | Always include extensionUri in localResourceRoots; test asset loading early |
| React re-render destroys canvas context | LOW | HIGH | Wrap canvas component in React.memo; use useRef for all game state |

---

## Sources

### Primary (HIGH confidence — official sources)
- VS Code Webview API docs: [code.visualstudio.com/api/extension-guides/webview](https://code.visualstudio.com/api/extension-guides/webview) — CSP, localResourceRoots, asWebviewUri, audio codec status
- GitHub issue [#66050](https://github.com/microsoft/vscode/issues/66050) — "Audio is not supported in webview" (confirmed by VS Code team)
- GitHub issue [#54097](https://github.com/microsoft/vscode/issues/54097) — "We don't ship ffmpeg so many common audio and video formats are not supported" (VS Code team quote)
- GitHub issue [#87282](https://github.com/microsoft/vscode/issues/87282) — Web Workers blocked in webviews (vscode-resource cross-origin)
- esbuild Content Types docs: [esbuild.github.io/content-types/](https://esbuild.github.io/content-types/) — loader behaviours, binary/dataurl/file/copy loader specifics
- GitHub DMCA repo: [github/dmca — Sulake 2015](https://github.com/github/dmca/blob/master/2015/2015-03-08-Sulake.md) — only documented GitHub DMCA by Sulake
- React StrictMode docs: [react.dev/reference/react/StrictMode](https://react.dev/reference/react/StrictMode) — double-mount behaviour confirmed

### Secondary (MEDIUM confidence — verified against official sources or multiple sources)
- GitHub issue [#148494](https://github.com/microsoft/vscode/issues/148494) — AudioContext.decodeAudioData MP3 error in VS Code
- GitHub issue [#2707](https://github.com/microsoft/vscode-discussions/discussions/2707) — localResourceRoots misconfiguration causes 401
- React issues [#25614](https://github.com/facebook/react/issues/25614), [#30835](https://github.com/facebook/react/issues/30835) — StrictMode cleanup bug with refs
- esbuild issue [#459](https://github.com/evanw/esbuild/issues/459) — publicPath dynamic resolution limitation
- sphynxkitten/nitro-assets README — asset category listing and maintainer completeness note
- MDN Optimizing Canvas: [developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)

### Tertiary (LOW confidence — single source or community reports)
- DevBest community thread on Sulake DMCA patterns — enforcement focus on monetisation rather than personal tools
- [vscode-audio-preview](https://github.com/sukumo28/vscode-audio-preview) — WAV/OGG confirmed working via WASM decoder; implies pure-browser codec path works where ffmpeg is absent
- Trail of Bits VSCode security blog (2023) — CSP enforcement scope and webview isolation details