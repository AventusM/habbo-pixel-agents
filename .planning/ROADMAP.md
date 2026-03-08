# Roadmap: habbo-pixel-agents

---

# Milestone: v1 — Habbo Isometric Drop-in Replacement

**Goal:** Replace the flat top-down pixel-art renderer in pixel-agents with a faithful Habbo Hotel v14-era isometric 2.5D rendering layer while leaving all agent logic, pathfinding, JSONL watching, and Claude Code integration untouched.
**Requirements:** 57 v1 requirements across 10 categories
**Status:** Complete (2026-03-01)

---

## Phase 1: Coordinate Foundation

**Goal:** Build the pure isometric math module that every subsequent rendering phase depends on, and validate all formulas before any render code is written.
**Requirements:** COORD-01, COORD-02, COORD-03, COORD-04, BUILD-06 (implicit: confirms Node environment is set up)

**Plans:** 1/1 plans complete

Plans:
- [x] 01-01-PLAN.md — Bootstrap Node/TypeScript/Vitest infrastructure and implement isometricMath.ts with passing TDD test suite

**Deliverables:**
- [x] `src/isometricMath.ts` implemented with `tileToScreen(x, y, z)`, `screenToTile(sx, sy)`, `getDirection(fromX, fromY, toX, toY)`, and exported constants `TILE_W=64`, `TILE_H=32`, `TILE_W_HALF=32`, `TILE_H_HALF=16`.
- [x] Unit test suite (Jest or Vitest) with at least 10 assertion pairs covering known tile→screen values, all 8 direction deltas for `getDirection`, and round-trip accuracy for `screenToTile(tileToScreen(x, y, 0))`.
- [x] All unit tests pass on CI (or locally) before Phase 2 begins — this is the hard gate for the rest of the work.
- [x] `isometricMath.ts` has zero imports from any renderer, React, or DOM module (verified by the test environment running in plain Node).

**Research flags:** None — isometric formulas are verified across 4+ open-source renderers and authoritative references. This phase is low-risk.
**Depends on:** None (first phase)

---

## Phase 2: Static Room Rendering

**Goal:** Produce a visible, correct isometric room from any Habbo heightmap string using only Canvas 2D path fills — no sprites, no external assets — giving a demo-able room before the asset pipeline is built.
**Requirements:** ROOM-01, ROOM-02, ROOM-03, ROOM-04, ROOM-05, ROOM-06, ROOM-07, ROOM-08, ROOM-09, ROOM-10, ROOM-11

**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md — TDD: pure TypeScript types, heightmap parser, HSB colour utilities, and depth sort (isoTypes.ts)
- [x] 02-02-PLAN.md — Canvas drawing module: rhombus tiles, wall strips, OffscreenCanvas pre-render, HiDPI init (isoTileRenderer.ts)
- [x] 02-03-PLAN.md — React component + VS Code extension entry: rAF loop, OffscreenCanvas blit, esbuild build scripts (RoomCanvas.tsx + extension.ts)

**Deliverables:**
- [x] `src/isoTileRenderer.ts` draws floor rhombuses (Canvas 2D `beginPath`/`lineTo`/`fill`) in the correct isometric positions, with three-tone shading and per-tile HSB colour support, including stair-step height offsets for tiles at height 1-9.
- [x] Left and right wall strips are drawn along the correct room edges with the left wall lighter than the right wall (~20% brightness difference). Void tiles (`x`) produce no floor or wall draw.
- [x] Static room geometry (floor + walls) is pre-rendered to an `OffscreenCanvas` once at layout load and blitted to the main canvas via a single `drawImage` per frame.
- [x] Canvas initialisation applies `devicePixelRatio` scaling and sets `ctx.imageSmoothingEnabled = false` — isometric tiles are pixel-crisp at 2× DPR.
- [x] The `requestAnimationFrame` loop uses the `running` boolean guard pattern; all mutable render state lives in `useRef`. The loop survives React StrictMode double-mount in development without ghost loops.
- [x] Depth sort pass (`sortKey = tileX + tileY + tileZ * 0.001`) is implemented and produces correct back-to-front paint order for a standard 10×10 office room with stair tiles.

**Research flags:** React StrictMode double-mount pattern must be established here and inherited by all later phases. Camera origin policy (how tile 0,0 maps to the viewport centre) must be decided in this phase — resolve before marking Phase 2 complete.
**Depends on:** Phase 1

---

## Phase 3: Asset Pipeline

**Goal:** Build the runtime sprite cache and asset loading pipeline so that furniture and avatar phases have correctly decoded, GPU-ready `ImageBitmap` objects to draw from using pre-extracted assets.
**Requirements:** ASSET-02, ASSET-03, ASSET-04, ASSET-05, ASSET-06, BUILD-01, BUILD-02, BUILD-03

**Plans:** 3 plans (+ 1 deferred to post-v1)

Plans:
- [x] 03-01-PLAN.md — Sprite cache with ImageBitmap loading and frame lookup API
- [x] 03-02-PLAN.md — Dual esbuild configs, prebuild hook scaffold, .gitignore for extracted assets
- [x] 03-03-PLAN.md — Asset copy plugin, webview URI generation, CSP img-src, chair atlas validation

Deferred to post-v1:
- [ ] 03-04-PLAN.md — .nitro binary extraction script (DEFERRED — using CakeChloe/cortex-assets converted to Nitro schema for v1)

**Deliverables:**
- [x] Build process is split into two separate esbuild configs: one for the extension host (Node.js target, externalises `vscode`) and one for the webview UI (browser target).
- [x] Assets from CakeChloe/cortex-assets (converted to Nitro unbundled schema via `scripts/convert-cortex-to-nitro.mjs`) are copied to `dist/webview-assets/` during build.
- [x] `webview.asWebviewUri()` + `localResourceRoots` configuration is validated: opening the webview panel and checking the browser network tab (or VS Code developer tools) shows no 401/Access Denied errors for any asset in `dist/webview-assets/`.
- [x] `isoSpriteCache.ts` loads atlas PNGs as `HTMLImageElement`, immediately calls `createImageBitmap()` on load, stores `ImageBitmap` objects keyed by atlas name, and resolves frame keys in Nitro convention format (e.g., `h_std_bd_1_0_0`) from the JSON manifest.
- [x] `.gitignore` excludes extracted Sulake assets from the repository.

**Research flags:** esbuild asset path pattern and `localResourceRoots` config are documented failure points. Validate the asset URI pipeline completely before writing any furniture rendering code. All 8 required furniture types sourced from CakeChloe/cortex-assets and converted to Nitro unbundled schema. `.nitro` binary extraction (ASSET-01, ASSET-07) deferred to post-v1 per research recommendation.
**Depends on:** Phase 1 (for constants); Phase 2 must be passing (provides the canvas + webview shell to test asset loading against)

---

## Phase 4: Furniture Rendering

**Goal:** Render all 8 office furniture types in correct isometric positions with proper depth ordering so the room looks like a real Habbo office layout.
**Requirements:** FURN-01, FURN-02, FURN-03, FURN-04, FURN-05

**Plans:** 3 plans

Plans:
- [x] 04-01-PLAN.md — Validate furniture assets and implement single-tile furniture renderer (chair)
- [x] 04-02-PLAN.md — Implement multi-tile furniture with max-coordinate sort key (desk)
- [x] 04-03-PLAN.md — Integrate all 8 furniture types into webview render loop with visual validation

**Deliverables:**
- [x] `src/isoFurnitureRenderer.ts` renders a 1×1 chair at a specified tile position and direction by looking up the correct frame key in the sprite cache and calling `drawImage` with the JSON manifest anchor offsets applied.
- [x] A 2×1 or 2×2 desk renders correctly using the farthest-tile sort key (`max(tileX + tileY)` across the full footprint), so avatars standing on tiles adjacent to the desk appear correctly in front of or behind it.
- [x] All 8 required furniture types (desk, chair, computer/monitor, lamp, plant/decoration, bookshelf/cabinet, rug/floor mat, whiteboard/noticeboard) render at their correct tile positions with direction variants working.
- [x] Furniture is inserted into the depth-sort render list at the correct sort key position relative to floor tiles and avatars.
- [x] Each furniture type has been visually validated against the Habbo v14-era reference before the renderer is considered complete (documented in a short checklist committed to `.planning/`).

**Research flags:** Start with the chair (1×1) to validate the atlas offset + draw flow, then the desk (multi-tile sort key fix), then remaining 6 items. Pre-validate all 8 items exist in the asset source before writing any rendering code (this work begins in Phase 3).
**Depends on:** Phase 1 (coordinate math), Phase 3 (sprite cache)

---

## Phase 5: Avatar System

**Goal:** Render animated Habbo-style characters in 8 directions with walk cycles and idle blinks so agents feel inhabited rather than static.
**Requirements:** AVAT-01, AVAT-02, AVAT-03, AVAT-04, AVAT-05, AVAT-06, AVAT-07, AVAT-08, AGENT-03, AGENT-05

**Plans:** 3 plans

Plans:
- [x] 05-01-PLAN.md — Avatar renderer with 8-direction support, multi-layer composition, and 6 palette variants using placeholder sprites
- [x] 05-02-PLAN.md — Walk cycle animation (4 frames), idle blinks (3-frame overlay), and Matrix spawn/despawn effects
- [x] 05-03-PLAN.md — Pathfinding integration (BFS path to screen positions), direction updates, parent/child relationship lines

**Deliverables:**
- [x] `src/isoAvatarRenderer.ts` renders an avatar at a tile position using an 11-layer Nitro figure composition (hrb, bd, lh, rh, lg, sh, ch, ls, rs, hd, hr) with cortex-assets figure data, in the correct Habbo direction based on `getDirection()` applied to BFS path step deltas.
- [x] The 4-frame walk cycle advances at 250 ms per frame when the avatar is moving; the idle state shows a single static frame with a 3-frame blink overlay triggering randomly every 5-8 seconds.
- [x] Per-layer color tinting via Canvas multiply blend mode provides visually distinct characters — different skin tone or clothing colour group — confirming the variant system maps correctly to sprite selection.
- [x] Matrix spawn effect cascades from the top of the avatar sprite downward on spawn; despawn reverses this. Both use the existing pixel-column approach adapted to isometric screen-space coordinates.
- [x] Sub-agent parent/child lines are drawn in isometric screen space from parent avatar foot position to child avatar foot position, updating as avatars move.
- [x] The BFS algorithm file (`tileMap.ts` or equivalent) has zero modifications; only the one screen-position conversion call changes from the flat multiply to `tileToScreen()`.

**Research flags:** Decision made: full 11-layer Nitro figure composition using CakeChloe/cortex-assets. Cortex-assets provides pre-extracted figure spritesheets with offset data for all body parts (hrb, bd, lh, rh, lg, sh, ch, ls, rs, hd, hr), eliminating the need for simplified custom sprites. Figure offset X negation was required in the renderer due to cortex convention differing from furniture offsets.
**Depends on:** Phase 1 (coordinate math, `getDirection`), Phase 3 (sprite cache)

---

## Phase 6: UI Overlays

**Goal:** Render authentic Habbo-style speech bubbles and name tags so each agent's identity and current action are legible at a glance without looking at the terminal.
**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, AGENT-01

**Plans:** 3 plans

Plans:
- [x] 06-01-PLAN.md — Speech bubble renderer with word wrapping and waiting animation (isoBubbleRenderer.ts)
- [x] 06-02-PLAN.md — Name tag renderer with status dots and semi-transparent pills (isoNameTagRenderer.ts)
- [x] 06-03-PLAN.md — Font bundling (Press Start 2P) and webview HTML @font-face integration

**Deliverables:**
- [x] `src/isoBubbleRenderer.ts` draws speech bubbles as white Canvas 2D rounded rectangles with a 1-2 px dark border and a downward-pointing triangular tail anchored above the avatar head position.
- [x] The waiting state shows an animated "..." bubble with three dots cycling at ~500 ms per step; regular speech shows the last JSONL log line or tool name truncated to ~30 characters with line-wrapping at ~200 px.
- [x] `src/isoNameTagRenderer.ts` draws a dark semi-transparent pill label with the agent/terminal name in white or yellow text plus a status dot (green/yellow/grey/red) reflecting the current agent state.
- [x] All bubbles and name tags are drawn after the full depth-sorted render list — they always appear on top of all room geometry, furniture, and avatars.
- [x] Press Start 2P TTF is bundled locally and declared via `@font-face` in the webview HTML before first render — no external CDN dependency. Volter/Goldfish TTF deferred to post-v1.

**Research flags:** No sprite dependencies — pure Canvas 2D. This is the lowest-risk render phase. Font loading must happen before first render to avoid a flash of unstyled text; declare `@font-face` in the webview HTML shell, not after canvas init.
**Depends on:** Phase 1 (screen coordinates for bubble anchor), Phase 5 (avatars must exist before overlay positions are meaningful)

---

## Phase 7: Layout Editor Integration

**Goal:** Make the layout editor work correctly with the isometric grid so users can paint tiles, place furniture, and customise colours using the same interface as the original pixel-agents editor.
**Requirements:** EDIT-01, EDIT-02, EDIT-03, EDIT-04

**Plans:** 3 plans

Plans:
- [x] 07-01-PLAN.md — Mouse-to-tile conversion and hover highlight rendering
- [x] 07-02-PLAN.md — Editor state management and tile painting integration
- [x] 07-03-PLAN.md — Furniture placement, color picker UI, rotation, and save/load

**Deliverables:**
- [x] `src/isoLayoutEditor.ts` implements mouse-to-tile conversion using the inverse isometric formula with z=0 assumption (Strategy B): `rawX = adjX / 64 + adjY / 32`, `rawY = adjY / 32 - adjX / 64`, floored to integer tile indices.
- [x] Hovering over a tile draws a yellow rhombus outline (`rgba(255, 255, 100, 0.8)`, 2 px stroke) after the main render pass on the correct isometric tile position.
- [x] All existing layout editor behaviours work correctly: tile walkability painting, per-tile HSB colour picker, furniture placement at clicked tile, furniture rotation, and saving/loading the layout as a Habbo heightmap string with door coordinates.
- [x] Placed furniture in the editor aligns correctly with the isometric tile grid and renders using the furniture renderer (Phase 4) at the selected tile position.

**Research flags:** No deep research needed — inverse isometric transform is a solved problem and Strategy B (z=0 assumption) is a documented accepted approach for editors. This phase must be last among rendering phases because it depends on finalised tile render dimensions (TILE_W=64, TILE_H=32) being locked in by Phase 2.
**Depends on:** Phase 1 (`screenToTile`), Phase 2 (tile render dimensions finalised), Phase 4 (furniture renders in editor preview)

---

## Phase 8: Audio

**Goal:** Replace the existing flat notification chimes with authentic Habbo Hotel classic sound effects, with a silent fallback if the codec is unavailable in the target VS Code version.
**Requirements:** AUDIO-01, AUDIO-02, AUDIO-03, AUDIO-04, AUDIO-05
**Plans:** 3 plans

Plans:
- [x] 08-01-PLAN.md — AudioManager module with graceful codec failure handling
- [x] 08-02-PLAN.md — FFmpeg build-time audio conversion to OGG Vorbis
- [x] 08-03-PLAN.md — Extension integration with CSP media-src and user gesture initialization


**Deliverables:**
- [x] All Habbo sound effects are converted to OGG Vorbis (preferred) or uncompressed WAV at build time using a build step script; no MP3 or AAC files remain in the audio assets.
- [x] Audio files are served via `webview.asWebviewUri()` and loaded with `AudioContext.decodeAudioData()` from a fetched `ArrayBuffer`; `media-src ${webview.cspSource};` is included in the webview CSP meta tag.
- [x] `AudioContext` creation is gated behind the first user interaction (click or keypress) to comply with browser autoplay policy.
- [x] If `decodeAudioData` throws or returns an error, the extension catches it silently and continues without audio — no error message or broken state is exposed to the user.
- [x] Audio playback is empirically tested on the actual target VS Code version; the test result (working / silent fallback) is documented in `.planning/` before this phase is considered complete.

**Research flags:** OGG Vorbis should work but codec availability in Electron varies across VS Code versions — this cannot be confirmed from documentation. Test on the actual target VS Code install. Accept silence as a valid outcome. This phase is completely decoupled from all rendering phases and can begin after Phase 2 provides the webview shell.
**Depends on:** Phase 2 (webview shell must exist for audio context testing); otherwise independent of all other rendering phases

---

# Milestone: v2 — Polish & Extended Features

**Goal:** Expand the v1 isometric renderer with a richer furniture catalog, avatar interaction polish (sitting, depth sorting fixes), and visual refinements.
**Status:** In Progress

---

## Phase 9: Furniture Catalog & Rendering Fixes

**Goal:** Data-driven furniture catalog with 16 new items, direction-aware rotation, flip caching, unified furniture+avatar depth sorting, avatar occlusion fixes.
**Status:** Complete (2026-03-05)
**Depends on:** v1

---

## Phase 10a: Avatar Polish

**Goal:** Despawn bug fix, display names, speech bubble cleanup, desk facing, bubble height cap.
**Status:** Complete (2026-03-05)
**Depends on:** Phase 9

---

## Phase 10b: Chair Sitting

**Goal:** Slower walking, chair sitting, walkable furniture.
**Status:** Complete (2026-03-05)
**Depends on:** Phase 10a

---

## Phase 11: Chair Layer Splitting

**Goal:** Split chair furniture into separate seat and backrest renderables at different depth values so that a sitting avatar sorts between them — backrest renders in front of avatar, seat renders behind.
**Status:** Complete (2026-03-05)
**Depends on:** Phase 10b

---

## Phase 12: Room Walls & Kanban Notes

**Goal:** Render proper room walls (not just edge strips) with optional window cutouts, and add wall-mounted sticky notes that act as a kanban board synced with GitHub Projects — cards on the board appear as physical post-it notes on the office walls.
**Status:** Planning complete
**Depends on:** Phase 11

**Plans:** 3/3 plans complete

Plans:
- [ ] 12-01-PLAN.md — Full wall panel geometry replacing per-tile strips (isoWallRenderer.ts)
- [ ] 12-02-PLAN.md — GitHub Projects v2 integration via gh CLI with VS Code settings and polling
- [ ] 12-03-PLAN.md — Wall-mounted sticky note rendering and RoomCanvas integration

Notes:
- Replace current wall edge strips with full wall surfaces (back wall, side walls)
- Wall surfaces should support mounted objects (notes, whiteboards, windows)
- Sticky notes on walls follow kanban columns (To Do, In Progress, Done)
- GitHub Projects integration: fetch board columns + cards via `gh` CLI or GitHub REST API, map to wall notes
- Auth via existing `gh` CLI token (no separate OAuth flow needed)
- Settings UI for configuring which GitHub Project to sync (repo + project number)
- Poll/refresh interval for keeping notes in sync
- Optional: window cutouts in walls for visual variety

---

## Phase 13: Volter Font as Default

**Goal:** Confirm licensing is clean for all distribution contexts; make Volter the default font with Press Start 2P as fallback.
**Status:** Pending
**Depends on:** Phase 11

---

## Phase 14: Avatar Builder UI

**Goal:** Add avatar builder UI with modal overlay, clothing selection, color palette swatches, and wardrobe customisation — building on the existing 11-layer Nitro figure composition.
**Status:** Complete
**Depends on:** Phase 11
**Requirements:** P14-01, P14-02, P14-03, P14-04, P14-05, P14-06, P14-07, P14-08

**Plans:** 3/3 plans complete

Plans:
- [x] 14-01-PLAN.md — Outfit config types, curated clothing catalog, color palettes, default presets, new asset downloads
- [x] 14-02-PLAN.md — Dynamic outfit in renderer, per-avatar OutfitConfig, extension host persistence
- [x] 14-03-PLAN.md — Avatar builder modal UI, preview canvas, click-to-open integration, wardrobe

---

### Phase 14.1: Avatar facial features - add eyes and mouth to avatar head rendering (INSERTED)

**Goal:** Integrate hh_human_face cortex-asset as two new render layers (ey, fc) between head and hair, with direction-aware visibility, eye blink animation via existing blinkFrame system, and correct tinting (eyes untinted, mouth skin-toned).
**Requirements:** FACE-01, FACE-02, FACE-03, FACE-04, FACE-05, FACE-06, FACE-07
**Depends on:** Phase 14
**Plans:** 1/1 plans complete

Plans:
- [ ] 14.1-01-PLAN.md — Asset pipeline + PartType extension + renderer face integration + preview + tests

## Phase 15: Performance Optimisation

**Goal:** Dirty-rect tracking, PixiJS v8 migration, or other optimisations for large rooms (20×20+ tiles, 20+ agents) if Canvas 2D becomes a bottleneck.
**Status:** Pending
**Depends on:** Phase 14

---

## Progress

### v1 (Complete)

| Phase | Requirements | Status | Completed |
|-------|-------------|--------|-----------|
| 1. Coordinate Foundation | COORD-01 – COORD-04 | Complete | 2026-02-28 |
| 2. Static Room Rendering | ROOM-01 – ROOM-11 | Complete | 2026-02-28 |
| 3. Asset Pipeline | ASSET-01 – ASSET-07, BUILD-01 – BUILD-03 | Complete | 2026-02-28 |
| 4. Furniture Rendering | FURN-01 – FURN-05 | Complete | 2026-03-01 |
| 5. Avatar System | AVAT-01 – AVAT-08, AGENT-03, AGENT-05 | Complete | 2026-03-01 |
| 6. UI Overlays | UI-01 – UI-08, AGENT-01 | Complete | 2026-03-01 |
| 7. Layout Editor Integration | EDIT-01 – EDIT-04 | Complete | 2026-03-01 |
| 8. Audio | AUDIO-01 – AUDIO-05 | Complete | 2026-03-01 |

### v2 (In Progress)

| Phase | Status | Completed |
|-------|--------|-----------|
| 9. Furniture Catalog & Fixes | Complete | 2026-03-05 |
| 10a. Avatar Polish | Complete | 2026-03-05 |
| 10b. Chair Sitting | Complete | 2026-03-05 |
| 11. Chair Layer Splitting | Complete | 2026-03-05 |
| 12. Room Walls & Kanban Notes | Complete | 2026-03-05 |
| 13. Volter Font as Default | Pending | — |
| 14. Avatar Builder UI | Complete | 2026-03-07 |
| 14.1 Avatar Facial Features | 1/1 | Complete    | 2026-03-07 | 15. Performance Optimisation | Pending | — |

### Phase 16: Agent factory workflow with team sections and orchestration UI

**Goal:** Transform the single-room Habbo experience into a structured office floor with 4 team sections (Planning, Core Dev, Infrastructure, Support), add intelligent agent classification from JSONL transcripts, introduce teleport booth spawn/despawn with flash effects, role-based outfits and idle behaviors, camera pan/zoom navigation, and a VS Code Activity Bar orchestration sidebar panel with agent list, section overview, activity log, and quick actions.
**Requirements**: AF-01, AF-02, AF-03, AF-04, AF-05, AF-06, AF-07, AF-08, AF-09, AF-10, AF-11, AF-12, AF-13, AF-14, AF-15, AF-16, AF-17, AF-18, AF-19, AF-20, AF-21, AF-22, AF-23, AF-24, AF-25, AF-26, AF-27, AF-28
**Depends on:** Phase 14
**Plans:** 4/9 plans executed

Plans:
- [ ] 16-01-PLAN.md — Agent classification types, role taxonomy, team mapping, and display name logic
- [ ] 16-02-PLAN.md — Room layout engine with 2x2 section grid templates (small/medium/large)
- [ ] 16-03-PLAN.md — Camera pan/zoom controller with click-drag and scroll-wheel
- [ ] 16-04-PLAN.md — Furniture catalog expansion, teleport booth (country_gate), and flash effect
- [ ] 16-05-PLAN.md — Agent classification integration into AgentManager and extension host
- [ ] 16-06-PLAN.md — Section manager, template layout wiring, and teleport spawn integration
- [ ] 16-07-PLAN.md — Role-based outfit presets and role-specific idle behaviors
- [ ] 16-08-PLAN.md — Orchestration sidebar panel (WebviewViewProvider) with message bridge
- [ ] 16-09-PLAN.md — Agent popup cards, activity-linked furniture, role outfits tab, and visual checkpoint

### Phase 17: Bugfixes & Wishlist

**Goal:** Ongoing phase for incremental fixes and polish. Items: (1) Sticky notes should render on a single wall only, not spread across multiple walls.
**Requirements**: Ongoing — items added as needed
**Depends on:** Phase 12
**Plans:** 3/3 plans complete

Plans:
- [ ] 17-01-PLAN.md — Constrain In Progress sticky notes to left wall only (remove right-wall overflow)

### Phase 18: Architecture Documentation Lite — code-linked diagrams of current codebase state for human review

**Goal:** Create a top-level ARCHITECTURE.md with Mermaid diagrams documenting the current codebase state (system overview, module dependencies, render pipeline, agent data flow, asset pipeline, module index) for human review — accurate as-is documentation, not aspirational.
**Requirements**: ARCH-18-01
**Depends on:** Phase 17
**Plans:** 1 plan

Plans:
- [ ] 18-01-PLAN.md — ARCHITECTURE.md with 6 Mermaid diagrams and module index (includes human review checkpoint)

### Phase 19: Architecture Refactor Full — deep codebase restructuring with comprehensive architecture docs and code-linked diagrams

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 18
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 19 to break down)

---

*Created: 2026-02-28*
*Last updated: 2026-03-08*

### Phase 17.2: Fix walking animation clipping and layer artifacts (INSERTED)

**Goal:** Fix body-chest offset mismatch during walk animation (skin pixels bleeding through clothing) and doubled-hand artifact in flipped directions by computing walk-frame offset deltas and applying them to non-walk parts.
**Requirements**: BUG-17.2-01, BUG-17.2-02, BUG-17.2-03
**Depends on:** Phase 17
**Plans:** 1/1 plans complete

Plans:
- [ ] 17.2-01-PLAN.md — Walk-frame offset delta correction for non-walk parts with regression tests

### Phase 17.1: Stray pixel diagnostic fix and right-click movement (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 17
**Plans:** 2/2 plans complete

Plans:
- [x] TBD (run /gsd:plan-phase 17.1 to break down) (completed 2026-03-07)
