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
