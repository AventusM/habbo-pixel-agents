# Roadmap: habbo-pixel-agents

**Milestone:** v1 — Habbo Isometric Drop-in Replacement
**Goal:** Replace the flat top-down pixel-art renderer in pixel-agents with a faithful Habbo Hotel v14-era isometric 2.5D rendering layer while leaving all agent logic, pathfinding, JSONL watching, and Claude Code integration untouched.
**Requirements:** 57 v1 requirements across 10 categories

---

## Phase 1: Coordinate Foundation

**Goal:** Build the pure isometric math module that every subsequent rendering phase depends on, and validate all formulas before any render code is written.
**Requirements:** COORD-01, COORD-02, COORD-03, COORD-04, BUILD-06 (implicit: confirms Node environment is set up)

**Plans:** 1/1 plans complete

Plans:
- [ ] 01-01-PLAN.md — Bootstrap Node/TypeScript/Vitest infrastructure and implement isometricMath.ts with passing TDD test suite

**Deliverables:**
- [ ] `src/isometricMath.ts` implemented with `tileToScreen(x, y, z)`, `screenToTile(sx, sy)`, `getDirection(fromX, fromY, toX, toY)`, and exported constants `TILE_W=64`, `TILE_H=32`, `TILE_W_HALF=32`, `TILE_H_HALF=16`.
- [ ] Unit test suite (Jest or Vitest) with at least 10 assertion pairs covering known tile→screen values, all 8 direction deltas for `getDirection`, and round-trip accuracy for `screenToTile(tileToScreen(x, y, 0))`.
- [ ] All unit tests pass on CI (or locally) before Phase 2 begins — this is the hard gate for the rest of the work.
- [ ] `isometricMath.ts` has zero imports from any renderer, React, or DOM module (verified by the test environment running in plain Node).

**Research flags:** None — isometric formulas are verified across 4+ open-source renderers and authoritative references. This phase is low-risk.
**Depends on:** None (first phase)

---

## Phase 2: Static Room Rendering

**Goal:** Produce a visible, correct isometric room from any Habbo heightmap string using only Canvas 2D path fills — no sprites, no external assets — giving a demo-able room before the asset pipeline is built.
**Requirements:** ROOM-01, ROOM-02, ROOM-03, ROOM-04, ROOM-05, ROOM-06, ROOM-07, ROOM-08, ROOM-09, ROOM-10, ROOM-11

**Plans:** 3 plans

Plans:
- [ ] 02-01-PLAN.md — TDD: pure TypeScript types, heightmap parser, HSB colour utilities, and depth sort (isoTypes.ts)
- [ ] 02-02-PLAN.md — Canvas drawing module: rhombus tiles, wall strips, OffscreenCanvas pre-render, HiDPI init (isoTileRenderer.ts)
- [ ] 02-03-PLAN.md — React component + VS Code extension entry: rAF loop, OffscreenCanvas blit, esbuild build scripts (RoomCanvas.tsx + extension.ts)

**Deliverables:**
- [ ] `src/isoTileRenderer.ts` draws floor rhombuses (Canvas 2D `beginPath`/`lineTo`/`fill`) in the correct isometric positions, with three-tone shading and per-tile HSB colour support, including stair-step height offsets for tiles at height 1-9.
- [ ] Left and right wall strips are drawn along the correct room edges with the left wall lighter than the right wall (~20% brightness difference). Void tiles (`x`) produce no floor or wall draw.
- [ ] Static room geometry (floor + walls) is pre-rendered to an `OffscreenCanvas` once at layout load and blitted to the main canvas via a single `drawImage` per frame.
- [ ] Canvas initialisation applies `devicePixelRatio` scaling and sets `ctx.imageSmoothingEnabled = false` — isometric tiles are pixel-crisp at 2× DPR.
- [ ] The `requestAnimationFrame` loop uses the `running` boolean guard pattern; all mutable render state lives in `useRef`. The loop survives React StrictMode double-mount in development without ghost loops.
- [ ] Depth sort pass (`sortKey = tileX + tileY + tileZ * 0.001`) is implemented and produces correct back-to-front paint order for a standard 10×10 office room with stair tiles.

**Research flags:** React StrictMode double-mount pattern must be established here and inherited by all later phases. Camera origin policy (how tile 0,0 maps to the viewport centre) must be decided in this phase — resolve before marking Phase 2 complete.
**Depends on:** Phase 1

---

## Phase 3: Asset Pipeline

**Goal:** Build the build-time `.nitro` extraction script and runtime sprite cache so that furniture and avatar phases have correctly decoded, GPU-ready `ImageBitmap` objects to draw from.
**Requirements:** ASSET-01, ASSET-02, ASSET-03, ASSET-04, ASSET-05, ASSET-06, ASSET-07, BUILD-01, BUILD-02, BUILD-03

**Plans:** 4 plans

Plans:
- [ ] 03-01-PLAN.md — Sprite cache with ImageBitmap loading and frame lookup API
- [ ] 03-02-PLAN.md — Dual esbuild configs, prebuild hook scaffold, .gitignore for extracted assets
- [ ] 03-03-PLAN.md — Asset copy plugin, webview URI generation, CSP img-src, chair atlas validation
- [ ] 03-04-PLAN.md — .nitro binary extraction script (optional — use pre-extracted assets from sphynxkitten/nitro-assets)

**Deliverables:**
- [ ] `src/scripts/extractNitro.ts` Node.js script correctly parses the BigEndian `.nitro` binary format (UI16 file count, per-file UI16 name length + UI32 compressed length + zlib inflate) and writes PNG atlas files and JSON manifests to `dist/webview-assets/`.
- [ ] Build process is split into two separate esbuild configs: one for the extension host (Node.js target, externalises `vscode`) and one for the webview UI (browser target). The pre-build extraction script runs before both esbuild steps.
- [ ] `webview.asWebviewUri()` + `localResourceRoots` configuration is validated: opening the webview panel and checking the browser network tab (or VS Code developer tools) shows no 401/Access Denied errors for any asset in `dist/webview-assets/`.
- [ ] `isoSpriteCache.ts` loads atlas PNGs as `HTMLImageElement`, immediately calls `createImageBitmap()` on load, stores `ImageBitmap` objects keyed by atlas name, and resolves frame keys in `{name}_{size}_{layer}_{direction}_{frame}` format from the JSON manifest.
- [ ] Extraction is validated against at least one known `.nitro` bundle (e.g., a chair from `sphynxkitten/nitro-assets`) by comparing the output PNG + JSON against Retrosprite's view of the same bundle.
- [ ] `.gitignore` excludes extracted Sulake assets from the repository.

**Research flags:** This is the highest-risk infrastructure phase. The `.nitro` binary format, esbuild asset path pattern, and `localResourceRoots` config are all documented failure points. Validate the extraction script and asset URI pipeline completely before writing any furniture rendering code. Also: visually inspect each of the 8 required furniture types in `sphynxkitten/nitro-assets` here — document which items need the Kepler-path fallback before Phase 4 begins.
**Depends on:** Phase 1 (for constants); Phase 2 must be passing (provides the canvas + webview shell to test asset loading against)

---

## Phase 4: Furniture Rendering

**Goal:** Render all 8 office furniture types in correct isometric positions with proper depth ordering so the room looks like a real Habbo office layout.
**Requirements:** FURN-01, FURN-02, FURN-03, FURN-04, FURN-05

**Deliverables:**
- [ ] `src/isoFurnitureRenderer.ts` renders a 1×1 chair at a specified tile position and direction by looking up the correct frame key in the sprite cache and calling `drawImage` with the JSON manifest anchor offsets applied.
- [ ] A 2×1 or 2×2 desk renders correctly using the farthest-tile sort key (`max(tileX + tileY)` across the full footprint), so avatars standing on tiles adjacent to the desk appear correctly in front of or behind it.
- [ ] All 8 required furniture types (desk, chair, computer/monitor, lamp, plant/decoration, bookshelf/cabinet, rug/floor mat, whiteboard/noticeboard) render at their correct tile positions with direction variants working.
- [ ] Furniture is inserted into the depth-sort render list at the correct sort key position relative to floor tiles and avatars.
- [ ] Each furniture type has been visually validated against the Habbo v14-era reference before the renderer is considered complete (documented in a short checklist committed to `.planning/`).

**Research flags:** Start with the chair (1×1) to validate the atlas offset + draw flow, then the desk (multi-tile sort key fix), then remaining 6 items. Pre-validate all 8 items exist in the asset source before writing any rendering code (this work begins in Phase 3).
**Depends on:** Phase 1 (coordinate math), Phase 3 (sprite cache)

---

## Phase 5: Avatar System

**Goal:** Render animated Habbo-style characters in 8 directions with walk cycles and idle blinks so agents feel inhabited rather than static.
**Requirements:** AVAT-01, AVAT-02, AVAT-03, AVAT-04, AVAT-05, AVAT-06, AVAT-07, AVAT-08, AGENT-03, AGENT-05

**Deliverables:**
- [ ] `src/isoAvatarRenderer.ts` renders an avatar at a tile position using a 3-4 layer sprite composition (body/skin, clothing, head, hair) in the correct Habbo direction based on `getDirection()` applied to BFS path step deltas.
- [ ] The 4-frame walk cycle advances at 250 ms per frame when the avatar is moving; the idle state shows a single static frame with a 3-frame blink overlay triggering randomly every 5-8 seconds.
- [ ] All 6 palette variants render as visually distinct characters — different skin tone or clothing colour group — confirming the variant system maps correctly to sprite selection.
- [ ] Matrix spawn effect cascades from the top of the avatar sprite downward on spawn; despawn reverses this. Both use the existing pixel-column approach adapted to isometric screen-space coordinates.
- [ ] Sub-agent parent/child lines are drawn in isometric screen space from parent avatar foot position to child avatar foot position, updating as avatars move.
- [ ] The BFS algorithm file (`tileMap.ts` or equivalent) has zero modifications; only the one screen-position conversion call changes from the flat multiply to `tileToScreen()`.

**Research flags:** The decision between sourced Nitro avatar parts versus simplified custom sprites must be made before any implementation work begins. Research strongly recommends simplified 3-4 layer custom sprites per palette variant (avoids the v14 avatar figure compatibility gap entirely). If custom sprites are chosen, this phase includes a sprite sourcing or creation task that is a hard prerequisite — scope that work as the first deliverable of this phase and block implementation until it is resolved.
**Depends on:** Phase 1 (coordinate math, `getDirection`), Phase 3 (sprite cache)

---

## Phase 6: UI Overlays

**Goal:** Render authentic Habbo-style speech bubbles and name tags so each agent's identity and current action are legible at a glance without looking at the terminal.
**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, AGENT-01

**Deliverables:**
- [ ] `src/isoBubbleRenderer.ts` draws speech bubbles as white Canvas 2D rounded rectangles with a 1-2 px dark border and a downward-pointing triangular tail anchored above the avatar head position.
- [ ] The waiting state shows an animated "..." bubble with three dots cycling at ~500 ms per step; regular speech shows the last JSONL log line or tool name truncated to ~30 characters with line-wrapping at ~200 px.
- [ ] `src/isoNameTagRenderer.ts` draws a dark semi-transparent pill label with the agent/terminal name in white or yellow text plus a status dot (green/yellow/grey/red) reflecting the current agent state.
- [ ] All bubbles and name tags are drawn after the full depth-sorted render list — they always appear on top of all room geometry, furniture, and avatars.
- [ ] Press Start 2P TTF is bundled locally and declared via `@font-face` in the webview HTML before first render — no external CDN dependency. Volter/Goldfish TTF is bundled locally and activatable via extension settings with a licensing disclaimer.

**Research flags:** No sprite dependencies — pure Canvas 2D. This is the lowest-risk render phase. Font loading must happen before first render to avoid a flash of unstyled text; declare `@font-face` in the webview HTML shell, not after canvas init.
**Depends on:** Phase 1 (screen coordinates for bubble anchor), Phase 5 (avatars must exist before overlay positions are meaningful)

---

## Phase 7: Layout Editor Integration

**Goal:** Make the layout editor work correctly with the isometric grid so users can paint tiles, place furniture, and customise colours using the same interface as the original pixel-agents editor.
**Requirements:** EDIT-01, EDIT-02, EDIT-03, EDIT-04

**Deliverables:**
- [ ] `src/isoLayoutEditor.ts` implements mouse-to-tile conversion using the inverse isometric formula with z=0 assumption (Strategy B): `rawX = adjX / 64 + adjY / 32`, `rawY = adjY / 32 - adjX / 64`, floored to integer tile indices.
- [ ] Hovering over a tile draws a yellow rhombus outline (`rgba(255, 255, 100, 0.8)`, 2 px stroke) after the main render pass on the correct isometric tile position.
- [ ] All existing editor behaviours work correctly: tile walkability painting, per-tile HSB colour picker, furniture placement at clicked tile, furniture rotation, and save/load of the heightmap string with door coordinates.
- [ ] Placed furniture in the editor aligns correctly with the isometric tile grid and renders using the furniture renderer (Phase 4) at the selected tile position.

**Research flags:** No deep research needed — inverse isometric transform is a solved problem and Strategy B (z=0 assumption) is a documented accepted approach for editors. This phase must be last among rendering phases because it depends on finalised tile render dimensions (TILE_W=64, TILE_H=32) being locked in by Phase 2.
**Depends on:** Phase 1 (`screenToTile`), Phase 2 (tile render dimensions finalised), Phase 4 (furniture renders in editor preview)

---

## Phase 8: Audio

**Goal:** Replace the existing flat notification chimes with authentic Habbo Hotel classic sound effects, with a silent fallback if the codec is unavailable in the target VS Code version.
**Requirements:** AUDIO-01, AUDIO-02, AUDIO-03, AUDIO-04, AUDIO-05

**Deliverables:**
- [ ] All Habbo sound effects are converted to OGG Vorbis (preferred) or uncompressed WAV at build time using a build step script; no MP3 or AAC files remain in the audio assets.
- [ ] Audio files are served via `webview.asWebviewUri()` and loaded with `AudioContext.decodeAudioData()` from a fetched `ArrayBuffer`; `media-src ${webview.cspSource};` is included in the webview CSP meta tag.
- [ ] `AudioContext` creation is gated behind the first user interaction (click or keypress) to comply with browser autoplay policy.
- [ ] If `decodeAudioData` throws or returns an error, the extension catches it silently and continues without audio — no error message or broken state is exposed to the user.
- [ ] Audio playback is empirically tested on the actual target VS Code version; the test result (working / silent fallback) is documented in `.planning/` before this phase is considered complete.

**Research flags:** OGG Vorbis should work but codec availability in Electron varies across VS Code versions — this cannot be confirmed from documentation. Test on the actual target VS Code install. Accept silence as a valid outcome. This phase is completely decoupled from all rendering phases and can begin after Phase 2 provides the webview shell.
**Depends on:** Phase 2 (webview shell must exist for audio context testing); otherwise independent of all other rendering phases

---

## v2 Phases (future)

- Phase 9: Full Habbo Furniture Catalog — expand beyond the 8 core office pieces toward the complete Habbo furniture catalog incrementally.
- Phase 10: Volter Font as Default — confirm licensing is clean for all distribution contexts; make Volter the default font with Press Start 2P as fallback.
- Phase 11: Advanced Avatar System — full 13-layer Habbo figure compositor if the palette-variant approach proves too limiting.
- Phase 12: Performance Optimisation — dirty-rect tracking, PixiJS v8 migration, or other optimisations for large rooms (20×20+ tiles, 20+ agents) if Canvas 2D becomes a bottleneck.

---

## Progress

| Phase | Requirements | Status | Completed |
|-------|-------------|--------|-----------|
| 1. Coordinate Foundation | COORD-01 – COORD-04 | Complete | 2026-02-28 |
| 2. Static Room Rendering | ROOM-01 – ROOM-11 | Complete | 2026-02-28 |
| 3. Asset Pipeline | ASSET-01 – ASSET-07, BUILD-01 – BUILD-03 | Not started | — |
| 4. Furniture Rendering | FURN-01 – FURN-05 | Not started | — |
| 5. Avatar System | AVAT-01 – AVAT-08, AGENT-03, AGENT-05 | Not started | — |
| 6. UI Overlays | UI-01 – UI-08, AGENT-01 | Not started | — |
| 7. Layout Editor Integration | EDIT-01 – EDIT-04 | Not started | — |
| 8. Audio | AUDIO-01 – AUDIO-05 | Not started | — |

---

*Created: 2026-02-28*
*Last updated: 2026-02-28 after Phase 2 planning*
