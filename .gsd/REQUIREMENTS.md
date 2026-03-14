# Requirements

## Active

## Validated

### COORD-01 — `tileToScreen(x, y, z)` returns correct screen pixel coordinates matching the 2:1 isometric formula (`screenX = (x - y) * 32`, `screenY = (x + y) * 16 - z * 16`) for all integer tile positions and height levels 0-9.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

`tileToScreen(x, y, z)` returns correct screen pixel coordinates matching the 2:1 isometric formula (`screenX = (x - y) * 32`, `screenY = (x + y) * 16 - z * 16`) for all integer tile positions and height levels 0-9.

### COORD-02 — `screenToTile(sx, sy)` returns correct floating-point grid coordinates matching the inverse isometric formula for all pixel positions within the canvas.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

`screenToTile(sx, sy)` returns correct floating-point grid coordinates matching the inverse isometric formula for all pixel positions within the canvas.

### COORD-03 — `getDirection(fromX, fromY, toX, toY)` returns the correct Habbo 0-7 direction value for all 8 possible BFS step deltas (cardinal and diagonal).

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

`getDirection(fromX, fromY, toX, toY)` returns the correct Habbo 0-7 direction value for all 8 possible BFS step deltas (cardinal and diagonal).

### COORD-04 — All coordinate functions are pure (no side effects, no render dependencies) and pass unit tests against known tile-to-screen values before any rendering code is written.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

All coordinate functions are pure (no side effects, no render dependencies) and pass unit tests against known tile-to-screen values before any rendering code is written.

### ROOM-01 — Each walkable tile is rendered as a filled 64×32 px rhombus (diamond) using Canvas 2D path fills — not a rectangle and not a sprite.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Each walkable tile is rendered as a filled 64×32 px rhombus (diamond) using Canvas 2D path fills — not a rectangle and not a sprite.

### ROOM-02 — Tiles at height levels 1-9 are rendered with the correct vertical offset (`tileZ * 16 px` upward shift), producing visible stair-step geometry.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Tiles at height levels 1-9 are rendered with the correct vertical offset (`tileZ * 16 px` upward shift), producing visible stair-step geometry.

### ROOM-03 — Floor tiles use three-tone shading: top face lightest, left face medium, right face darkest — matching classic Habbo flat shading with no dynamic lighting.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Floor tiles use three-tone shading: top face lightest, left face medium, right face darkest — matching classic Habbo flat shading with no dynamic lighting.

### ROOM-04 — Per-tile HSB colour from the existing layout editor data model is preserved and applied as the tile fill colour.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Per-tile HSB colour from the existing layout editor data model is preserved and applied as the tile fill colour.

### ROOM-05 — Left wall strips are rendered along the top-left room edge; right wall strips along the top-right edge; both are Canvas 2D fills with the left wall lighter than the right wall (approximately 20% brightness difference).

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Left wall strips are rendered along the top-left room edge; right wall strips along the top-right edge; both are Canvas 2D fills with the left wall lighter than the right wall (approximately 20% brightness difference).

### ROOM-06 — Void (non-walkable) tiles marked `x` in the heightmap are not drawn; the panel background shows through.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Void (non-walkable) tiles marked `x` in the heightmap are not drawn; the panel background shows through.

### ROOM-07 — All renderables (tiles, walls, furniture, avatars) are depth-sorted using sort key `tileX + tileY + tileZ * 0.001` (painter's algorithm, back-to-front), producing correct visual overlap with no Z-fighting artifacts for a standard office room layout.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

All renderables (tiles, walls, furniture, avatars) are depth-sorted using sort key `tileX + tileY + tileZ * 0.001` (painter's algorithm, back-to-front), producing correct visual overlap with no Z-fighting artifacts for a standard office room layout.

### ROOM-08 — The static room geometry (floor tiles and walls) is pre-rendered to an `OffscreenCanvas` once at layout load; it is composited to the main canvas each frame via a single `drawImage`, not re-drawn per frame.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

The static room geometry (floor tiles and walls) is pre-rendered to an `OffscreenCanvas` once at layout load; it is composited to the main canvas each frame via a single `drawImage`, not re-drawn per frame.

### ROOM-09 — Canvas is initialised with `canvas.width = offsetWidth * devicePixelRatio` and `ctx.scale(dpr, dpr)`, and `ctx.imageSmoothingEnabled = false` is set before any sprite draws, so isometric tiles remain pixel-crisp at HiDPI display resolutions.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Canvas is initialised with `canvas.width = offsetWidth * devicePixelRatio` and `ctx.scale(dpr, dpr)`, and `ctx.imageSmoothingEnabled = false` is set before any sprite draws, so isometric tiles remain pixel-crisp at HiDPI display resolutions.

### ROOM-10 — The `requestAnimationFrame` loop uses a `running` boolean guard so it self-terminates on cleanup even under React StrictMode double-mount.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

The `requestAnimationFrame` loop uses a `running` boolean guard so it self-terminates on cleanup even under React StrictMode double-mount.

### ROOM-11 — All mutable render state (agent positions, animation frames, speech bubble text) is stored in `useRef`, not `useState`, so the rAF loop always reads current values without stale-closure bugs.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

All mutable render state (agent positions, animation frames, speech bubble text) is stored in `useRef`, not `useState`, so the rAF loop always reads current values without stale-closure bugs.

### ASSET-02 — PNG atlas files and JSON manifests are never imported through esbuild; they are copied to `dist/webview-assets/` by the build step and loaded in the webview via `webview.asWebviewUri()` URIs.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

PNG atlas files and JSON manifests are never imported through esbuild; they are copied to `dist/webview-assets/` by the build step and loaded in the webview via `webview.asWebviewUri()` URIs.

### ASSET-03 — `localResourceRoots` includes `vscode.Uri.joinPath(context.extensionUri, 'dist')` so webview assets are served without 401 errors.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

`localResourceRoots` includes `vscode.Uri.joinPath(context.extensionUri, 'dist')` so webview assets are served without 401 errors.

### ASSET-04 — After an atlas PNG is loaded as an `HTMLImageElement`, `createImageBitmap()` is called immediately to pre-decode it; `ImageBitmap` objects are stored in the sprite cache and used for all `drawImage` calls.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

After an atlas PNG is loaded as an `HTMLImageElement`, `createImageBitmap()` is called immediately to pre-decode it; `ImageBitmap` objects are stored in the sprite cache and used for all `drawImage` calls.

### ASSET-05 — The sprite cache resolves frame keys in Nitro convention format (e.g., `h_std_bd_1_0_0`) to `{x, y, w, h}` atlas regions using the converted JSON manifest.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

The sprite cache resolves frame keys in Nitro convention format (e.g., `h_std_bd_1_0_0`) to `{x, y, w, h}` atlas regions using the converted JSON manifest.

### ASSET-06 — Two separate esbuild configurations exist — one for the extension host (Node.js target) and one for the webview UI (browser target) — so Node.js built-ins are never bundled into the webview.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Two separate esbuild configurations exist — one for the extension host (Node.js target) and one for the webview UI (browser target) — so Node.js built-ins are never bundled into the webview.

### FURN-01 — A chair (1×1 tile) renders correctly in isometric projection using the atlas frame for the correct direction, with anchor offsets from the JSON manifest applied, and appears at the correct screen position for its tile coordinates.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

A chair (1×1 tile) renders correctly in isometric projection using the atlas frame for the correct direction, with anchor offsets from the JSON manifest applied, and appears at the correct screen position for its tile coordinates.

### FURN-02 — A desk (2×1 or 2×2 tile) renders correctly and uses the farthest-tile sort key (`max(tileX + tileY)` across its footprint) so avatars on adjacent tiles are not incorrectly obscured by the desk.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

A desk (2×1 or 2×2 tile) renders correctly and uses the farthest-tile sort key (`max(tileX + tileY)` across its footprint) so avatars on adjacent tiles are not incorrectly obscured by the desk.

### FURN-03 — All 8 furniture types required for the office layout (desk, chair, computer/monitor, lamp, plant/decoration, bookshelf/cabinet, rug/floor mat, whiteboard/noticeboard) render in isometric projection with correct depth ordering.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

All 8 furniture types required for the office layout (desk, chair, computer/monitor, lamp, plant/decoration, bookshelf/cabinet, rug/floor mat, whiteboard/noticeboard) render in isometric projection with correct depth ordering.

### FURN-04 — Furniture direction (rotation in 90-degree increments: Habbo directions 0, 2, 4, 6) is applied by selecting the matching direction frame from the atlas manifest.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Furniture direction (rotation in 90-degree increments: Habbo directions 0, 2, 4, 6) is applied by selecting the matching direction frame from the atlas manifest.

### FURN-05 — Before the furniture renderer is written, each of the 8 required furniture types is visually validated to exist in the asset source (CakeChloe/cortex-assets converted to Nitro schema) with the expected 64px isometric style.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Before the furniture renderer is written, each of the 8 required furniture types is visually validated to exist in the asset source (CakeChloe/cortex-assets converted to Nitro schema) with the expected 64px isometric style.

### AVAT-01 — Avatars render in 8 facing directions (0-7) with the correct sprite selected for each direction based on `getDirection()` output from BFS path step deltas.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Avatars render in 8 facing directions (0-7) with the correct sprite selected for each direction based on `getDirection()` output from BFS path step deltas.

### AVAT-02 — The walk animation plays a 4-frame cycle at 250 ms per frame when an avatar is moving along a BFS path.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

The walk animation plays a 4-frame cycle at 250 ms per frame when an avatar is moving along a BFS path.

### AVAT-03 — The idle state displays a single static frame; a 3-frame blink overlay triggers randomly every 5-8 seconds.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

The idle state displays a single static frame; a 3-frame blink overlay triggers randomly every 5-8 seconds.

### AVAT-04 — Avatar sprites are composed from 11 Nitro figure layers (hrb, bd, lh, rh, lg, sh, ch, ls, rs, hd, hr) using cortex-assets figure data with per-layer color tinting via Canvas multiply blend mode.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Avatar sprites are composed from 11 Nitro figure layers (hrb, bd, lh, rh, lg, sh, ch, ls, rs, hd, hr) using cortex-assets figure data with per-layer color tinting via Canvas multiply blend mode.

### AVAT-05 — The avatar's screen position at each BFS path step is computed by calling `tileToScreen(tileX, tileY, tileHeight)` — the BFS algorithm itself is unchanged.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

The avatar's screen position at each BFS path step is computed by calling `tileToScreen(tileX, tileY, tileHeight)` — the BFS algorithm itself is unchanged.

### AVAT-06 — Each of the 6 character palette variants produces a visually distinct avatar (different skin tone or clothing colour group) that is recognisably different from the others.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Each of the 6 character palette variants produces a visually distinct avatar (different skin tone or clothing colour group) that is recognisably different from the others.

### AVAT-07 — Matrix spawn and despawn effects are preserved: cascade from the top of the avatar sprite downward on spawn, and upward collapse on despawn.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Matrix spawn and despawn effects are preserved: cascade from the top of the avatar sprite downward on spawn, and upward collapse on despawn.

### AVAT-08 — Sub-agent parent/child relationships are visualised by a line drawn in isometric screen space from the parent avatar's foot position to the child avatar's foot position.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Sub-agent parent/child relationships are visualised by a line drawn in isometric screen space from the parent avatar's foot position to the child avatar's foot position.

### AGENT-01 — All existing agent behaviours — walk, idle, type/wave, read/surprised, waiting/"..." bubble — are preserved and map to the corresponding isometric avatar action/gesture codes.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

All existing agent behaviours — walk, idle, type/wave, read/surprised, waiting/"..." bubble — are preserved and map to the corresponding isometric avatar action/gesture codes.

### AGENT-02 — JSONL transcript file watching is unchanged: no modifications to the watcher, state machine, or Claude Code integration.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

JSONL transcript file watching is unchanged: no modifications to the watcher, state machine, or Claude Code integration.

### AGENT-03 — BFS pathfinding operates on the unchanged logical tile grid; only the single screen-position conversion call changes from flat-multiply to `tileToScreen()`.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

BFS pathfinding operates on the unchanged logical tile grid; only the single screen-position conversion call changes from flat-multiply to `tileToScreen()`.

### AGENT-04 — Agents spawn at the room door tile and walk to their first idle position using the existing BFS pathfinder.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Agents spawn at the room door tile and walk to their first idle position using the existing BFS pathfinder.

### AGENT-05 — Agent state transitions (idle → walking → typing → waiting → idle) continue to be driven by JSONL events with the same timing and trigger logic as the original pixel-agents extension.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Agent state transitions (idle → walking → typing → waiting → idle) continue to be driven by JSONL events with the same timing and trigger logic as the original pixel-agents extension.

### UI-01 — Speech bubbles are rendered as white Canvas 2D rounded rectangles with a 1-2 px dark border and a small downward-pointing triangular tail anchored above the avatar's head.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Speech bubbles are rendered as white Canvas 2D rounded rectangles with a 1-2 px dark border and a small downward-pointing triangular tail anchored above the avatar's head.

### UI-02 — The waiting/"..." speech bubble animates three dots cycling at approximately 500 ms per step (`. → .. → ...`) and appears when an agent is in the waiting state.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

The waiting/"..." speech bubble animates three dots cycling at approximately 500 ms per step (`. → .. → ...`) and appears when an agent is in the waiting state.

### UI-03 — Speech bubble text shows the last agent log line or tool name, truncated to approximately 30 characters, and wraps to a second line if the text exceeds approximately 200 px wide.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Speech bubble text shows the last agent log line or tool name, truncated to approximately 30 characters, and wraps to a second line if the text exceeds approximately 200 px wide.

### UI-04 — Name tags are rendered as dark semi-transparent pill backgrounds with white or yellow text displaying the agent/terminal session name.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Name tags are rendered as dark semi-transparent pill backgrounds with white or yellow text displaying the agent/terminal session name.

### UI-05 — Name tags include a coloured status dot: green (idle), yellow (active/tool running), grey (waiting), red (error).

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Name tags include a coloured status dot: green (idle), yellow (active/tool running), grey (waiting), red (error).

### UI-06 — All speech bubbles and name tags are drawn after the depth-sorted render list so they always appear on top of all room geometry, furniture, and avatar sprites.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

All speech bubbles and name tags are drawn after the depth-sorted render list so they always appear on top of all room geometry, furniture, and avatar sprites.

### UI-07 — Press Start 2P (OFL 1.1) is the default font, loaded from a locally bundled TTF file via `@font-face` in the webview HTML — no external CDN dependency.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Press Start 2P (OFL 1.1) is the default font, loaded from a locally bundled TTF file via `@font-face` in the webview HTML — no external CDN dependency.

### EDIT-01 — Mouse-to-tile conversion in the layout editor uses the inverse isometric formula (`screenToTile()` with z=0 assumption — Strategy B) so clicking a tile in the canvas selects the correct grid cell.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Mouse-to-tile conversion in the layout editor uses the inverse isometric formula (`screenToTile()` with z=0 assumption — Strategy B) so clicking a tile in the canvas selects the correct grid cell.

### EDIT-02 — The hovered tile is highlighted by drawing a yellow rhombus outline (`rgba(255, 255, 100, 0.8)`) over the correct isometric tile position after the main render pass.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

The hovered tile is highlighted by drawing a yellow rhombus outline (`rgba(255, 255, 100, 0.8)`) over the correct isometric tile position after the main render pass.

### EDIT-03 — All existing layout editor behaviours are preserved: tile painting, per-tile HSB colour, furniture placement, furniture rotation, and saving/loading the layout as a Habbo heightmap string with door coordinates.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

All existing layout editor behaviours are preserved: tile painting, per-tile HSB colour, furniture placement, furniture rotation, and saving/loading the layout as a Habbo heightmap string with door coordinates.

### EDIT-04 — Furniture placement in the editor respects the isometric tile grid so placed furniture aligns correctly with the rendered tile positions.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Furniture placement in the editor respects the isometric tile grid so placed furniture aligns correctly with the rendered tile positions.

### AUDIO-01 — All Habbo sound effects are converted to OGG Vorbis (or uncompressed WAV) at build time; no MP3 or AAC files are used.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

All Habbo sound effects are converted to OGG Vorbis (or uncompressed WAV) at build time; no MP3 or AAC files are used.

### AUDIO-02 — Audio files are served via `webview.asWebviewUri()` and loaded using `AudioContext.decodeAudioData()` from a fetched `ArrayBuffer`.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Audio files are served via `webview.asWebviewUri()` and loaded using `AudioContext.decodeAudioData()` from a fetched `ArrayBuffer`.

### AUDIO-03 — `AudioContext` creation is gated behind a user gesture to comply with browser autoplay policy.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

`AudioContext` creation is gated behind a user gesture to comply with browser autoplay policy.

### AUDIO-04 — If audio codec loading fails, the extension falls back to silence — no error is shown to the user and no other feature is broken.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

If audio codec loading fails, the extension falls back to silence — no error is shown to the user and no other feature is broken.

### AUDIO-05 — The `media-src ${webview.cspSource};` directive is included in the webview CSP meta tag.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

The `media-src ${webview.cspSource};` directive is included in the webview CSP meta tag.

### BUILD-01 — Running the build produces a working VS Code extension that loads without errors in the target VS Code version (the extension host activates and the webview panel opens).

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Running the build produces a working VS Code extension that loads without errors in the target VS Code version (the extension host activates and the webview panel opens).

### BUILD-02 — The pre-build asset conversion script runs before the esbuild step and its output is present in `dist/webview-assets/` when the webview initialises.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

The pre-build asset conversion script runs before the esbuild step and its output is present in `dist/webview-assets/` when the webview initialises.

### BUILD-03 — The build does not commit any extracted Sulake assets (PNG, JSON, sound files) to the git repository; `.gitignore` excludes `dist/webview-assets/` or equivalent.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

The build does not commit any extracted Sulake assets (PNG, JSON, sound files) to the git repository; `.gitignore` excludes `dist/webview-assets/` or equivalent.

## Deferred

### ASSET-01 — A Node.js pre-build script (`extractNitro.ts`) correctly parses the custom `.nitro` binary format (BigEndian UI16 file count, per-file UI16 name length + UI32 compressed length + zlib-inflated data) and outputs PNG atlas files and JSON manifests to `dist/webview-assets/`.

- Status: deferred
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

A Node.js pre-build script (`extractNitro.ts`) correctly parses the custom `.nitro` binary format (BigEndian UI16 file count, per-file UI16 name length + UI32 compressed length + zlib-inflated data) and outputs PNG atlas files and JSON manifests to `dist/webview-assets/`. *Deferred: project uses CakeChloe/cortex-assets conversion instead of .nitro extraction.*

### ASSET-07 — The extraction script is validated by running it against a known `.nitro` bundle and comparing extracted PNG + JSON output visually against Retrosprite.

- Status: deferred
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

The extraction script is validated by running it against a known `.nitro` bundle and comparing extracted PNG + JSON output visually against Retrosprite. *Deferred: no .nitro bundles used; validation done via cortex-assets frame key verification.*

### UI-08 — Volter/Goldfish font is available as an explicit opt-in setting; when enabled, it loads from a locally bundled TTF file and a licensing disclaimer is shown in the extension settings UI. *(Deferred to post-v1)*

- Status: deferred
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Volter/Goldfish font is available as an explicit opt-in setting; when enabled, it loads from a locally bundled TTF file and a licensing disclaimer is shown in the extension settings UI. *Deferred to post-v1: requires extension settings UI for opt-in and licensing disclaimer.*

## Out of Scope
