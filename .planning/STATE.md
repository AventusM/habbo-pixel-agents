---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: Not started
status: planning
last_updated: "2026-03-09T18:45:12.648Z"
progress:
  total_phases: 21
  completed_phases: 18
  total_plans: 50
  completed_plans: 48
---

# STATE.md

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** Claude Code agents should feel like they're working together in a recognisable Habbo Hotel room — the isometric 2.5D aesthetic must be faithful to the classic v14 era.
**Current focus:** Phase 18 — architecture documentation

## Current Status

v1.0 (phases 1-8) complete. v2 work in progress: Phase 9 (furniture catalog + rendering fixes) and Phase 10a/10b (avatar polish + chair sitting) are complete. Phase 11 plan 01 (chair layer splitting) is complete. Phase 12 plans 01-03 complete (wall panels + kanban). Phase 14 plans 01-03 complete (outfit config, renderer integration, builder modal UI). Phase 14.1 plan 01 complete (avatar facial features with eyes, mouth, blink animation).

**Last session:** 2026-03-09T18:42:50.481Z
**Milestone status:** v2 in progress

## Current Phase

**Phase:** 16 — Agent Factory Workflow with Team Sections and Orchestration UI
**Current Plan:** Not started
**Status:** Ready to plan

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-28 | Fork pixel-agents, replace rendering layer only | Agent logic is correct and stable — only renderer changes |
| 2026-02-28 | Canvas 2D (not PixiJS/WebGL) for rendering | Zero overhead, sufficient for low-fps tile tool, matches existing codebase |
| 2026-02-28 | CakeChloe/cortex-assets as primary asset source | Pre-extracted custom JSON converted to Nitro unbundled schema, no build-time SWF pipeline needed for V1 |
| 2026-02-28 | Build-time .nitro extraction via Node script | Never pass binary assets through esbuild |
| 2026-02-28 | OGG Vorbis for all audio | VS Code Electron ships without ffmpeg — MP3 decoding fails |
| 2026-02-28 | Press Start 2P as default font, Volter as opt-in | Volter is Sulake IP — default must be license-clean |
| 2026-02-28 | Never commit extracted Sulake assets to public repo | Low DMCA risk for personal tool, but keep assets local-only |
| 2026-02-28 | Simplified avatar sprites (3-4 layers) over full Habbo figure compositor | Original decision — superseded by cortex-assets availability (see 2026-03-01 entries) |
| 2026-02-28 | useRef for all mutable render state in React | rAF loop closes over stale useState — useRef only |
| 2026-02-28 | Mault docs/specs/ excluded from fileProliferation + tempFiles detectors | GSD planning docs accumulate by design, not violations |
| 2026-02-28 | ESM import paths use .js extension for .ts source files | Node ESM spec requires; Vitest resolves .js -> .ts transparently |
| 2026-02-28 | moduleResolution=bundler in tsconfig | esbuild is Phase 3+ bundler target; bundler resolution avoids future compat issues |
| 2026-02-28 | environment: node in vitest.config.ts | Enforces zero DOM imports in math modules (COORD-04) |
| 2026-02-28 | tileToScreen formula: screenX=(tileX-tileY)*32, screenY=(tileX+tileY)*16-tileZ*16 | Matches Habbo v14 diamond convention, verified against scuti/shroom/bobba |
| 2026-02-28 | Use 0.001 Z-weight in depth sort formula | Prevents stair tiles (high Z) from rendering in front of lower-position tiles — X+Y position must dominate |
| 2026-02-28 | Clamp left/right face lightness at 0% instead of allowing negative values | HSL lightness below 0% is invalid — clamping ensures valid CSS color strings |
| 2026-02-28 | Treat unknown heightmap chars as void (null) | Graceful degradation for malformed input — matches Habbo client behavior |
| 2026-02-28 | Use stable sort for identical depth keys | Preserves original ordering for tiles at same position — predictable rendering |
| 2026-02-28 | Use happy-dom instead of jsdom for canvas mocking | jsdom has ESM/CommonJS compatibility issues; happy-dom is lighter and better maintained |
| 2026-02-28 | Create OffscreenCanvas mock in setup.ts | Minimal mock sufficient for smoke tests — no pixel output verification needed |
| 2026-02-28 | Set imageSmoothingEnabled=false on both canvas contexts | Ensures pixel-crisp rendering at all DPR levels for isometric tile fidelity |
| 2026-02-28 | Use .cjs extension for extension.js output | package.json has type=module, so .js files are ESM; CommonJS extension code must use .cjs |
| 2026-02-28 | runningRef.current = false BEFORE cancelAnimationFrame | Ensures frame() guard sees false before cancellation, prevents StrictMode race conditions |
| 2026-02-28 | Store all mutable render state in single renderState useRef | Keeps frame-loop values in one ref, prevents useState stale closures |
| 2026-02-28 | Add preLaunchTask to launch.json for auto-build | Ensures latest code bundled before F5, prevents testing stale builds |
| 2026-03-01 | Use pathToIsometricPositions() as integration layer | BFS algorithm itself never needs modification — only position conversion changed |
| 2026-03-01 | Last path step uses previous direction | Maintains avatar facing after reaching goal — prevents jarring direction resets |
| 2026-03-01 | Cyan line with 60% opacity for parent-child relationships | Distinct from other UI elements, non-intrusive transparency |
| 2026-03-01 | CakeChloe/cortex-assets as figure asset source | Pre-extracted figure spritesheets with offsets; no SWF extraction needed |
| 2026-03-01 | Full 11-layer Nitro figure composition | cortex-assets provides all body parts; simplified sprites unnecessary |
| 2026-03-01 | Figure offset X negation in renderer | Cortex figure offset convention has inverted X vs furniture; negate in drawNitroAvatarFrame |
| 2026-03-02 | AVATAR_GROUND_Y = 12px offset | Avatar shoe bottoms sat 12px above furniture ground plane; constant shifts sprites down to align |
| 2026-03-05 | Chair backrest depth bias +0.8 (vs avatar +0.6) | Guarantees backrest renders in front of sitting avatar's torso; seat at base depth renders behind |
| 2026-03-05 | Split threshold z>0 strict positive | Matches hc_chr metadata convention; z=-100 for dir2 backrest correctly skips split |
| 2026-03-05 | Wall panels draw before floor tiles on OffscreenCanvas | Painter's algorithm keeps walls behind all floor geometry without extra z-sorting |
| 2026-03-05 | Shared baseline per wall side as max(sy+TILE_H+WALL_HEIGHT) | Eliminates height-gap artifacts when tiles sit at different elevations |
| 2026-03-05 | execFileSync args array (not execSync shell string) for gh CLI graphql | Avoids shell quoting issues with multi-line GraphQL strings |
| 2026-03-05 | Temp file with --input flag for complex items GraphQL query | Fully avoids shell quoting for the larger two-query GitHub Projects flow |
| 2026-03-05 | Silent fallback pattern for fetchKanbanCards: catch all errors, return [] | Consistent with Phase 8 audio pattern; extension stays operational when gh uninstalled/unauthenticated |
| 2026-03-05 | Kanban notes drawn as topmost overlay after speech bubbles in rAF loop | Always visible on top of room geometry; no depth sort needed for screen-space overlays |
| 2026-03-05 | drawKanbanNotes no-op when cards.length === 0 | Zero draw cost for rooms without GitHub Projects settings configured |
| 2026-03-06 | In Progress notes confined to left wall only | Right wall reserved exclusively for Done aggregate note — cross-wall overflow broke spatial metaphor |
| 2026-03-07 | Replaced Shirt_F_Tshirt_Plain with Shirt_F_Schoolshirt | Tshirt_Plain directory in cortex-assets has no JSON metadata — only PNG |
| 2026-03-07 | Validate all catalog setIds against actual cortex-assets frame keys | Plan-estimated setIds were placeholders; real values differ significantly |
| 2026-03-07 | Import PartType from avatarOutfitConfig.ts, remove renderer duplicate | Single source of truth for body part type definitions |
| 2026-03-07 | AvatarManager savedOutfits map for late-spawning avatars | Outfits loaded before agent spawn applied when agent eventually spawns |
| 2026-03-07 | Standalone preview renderer duplicates tinting logic | Intentional decoupling from room render loop per research — preview is simpler (no spawn/walk) |
| 2026-03-07 | Avatar click opens builder instead of toggling selection | Builder replaces selection as primary click action; selection manager preserved for click-to-move |
| 2026-03-07 | Eyes use white multiply identity (#FFFFFF) for tinting | Preserves pre-colored pupil/sclera pixel detail; other tint colors destroy eye contrast |
| 2026-03-07 | Eye setId mapped from variant via modulo 11 | 11 eye styles available in hh_human_face; variant cycling provides visual variety |
| 2026-03-07 | Face direction filtering: skip ey/fc for dirs 0 and 7 | Back of head has no face sprites; correct Habbo behavior |
| 2026-03-07 | Mouth (fc) tinted with skin color | Standard Habbo convention; fc sprites are grayscale designed for multiply blend |
| 2026-03-07 | clearRect must use full tint canvas dimensions | Shared tint canvas (min 128x128) retained residual pixels from prior large sprites when small face sprites were drawn |
| 2026-03-07 | Inline panel at bottom-left instead of full-screen modal overlay | Non-blocking avatar builder allows simultaneous canvas interaction (click-to-move, sit) |
| 2026-03-07 | Removed isBuilderOpenRef click-blocking guard | Only usage was early-return in handleClick; removal enables canvas interaction while editor open |
| 2026-03-07 | Preview canvas 80x120 (reduced from 120x180) | Compact form factor fits 220px-wide inline panel |
| 2026-03-07 | Tint offscreen canvas imageSmoothingEnabled=false | drawImage interpolation generates fractional alpha at sprite edges that survives multiply+destination-in compositing |
| 2026-03-07 | PNG spritesheets verified clean (0 stray pixels across 21 figure assets) | Scanner confirms compositing is root cause, not source art |
| 2026-03-07 | Right-click for movement, left-click for selection/builder only | Separates select and move into different click types; eliminates confusing dual-purpose left-click |
| 2026-03-07 | Walk delta computed in pre-flip space | Flip handled by drawTintedBodyPart; no negation needed for flipped directions |
| 2026-03-07 | Delta computation guarded by stateForFrame === walk | Skip entirely for idle/sit states for clarity over relying on fallback zero |
| 2026-03-08 | Default unmapped agent roles to core-dev team | Most agents are implementers; safe default for unknown subagent_types |
| 2026-03-08 | Task area inferred by counting file path category hits | Most frequent category wins; provides meaningful display name suffix |
| 2026-03-08 | Mutable CameraState for renderState ref pattern | Avoids immutable copy overhead in rAF loop |
| 2026-03-08 | 5px drag threshold for camera pan vs click | Prevents accidental pans when clicking avatars/tiles |
| 2026-03-08 | World-space overlays inside camera transform, screen-space outside | Expanded notes stay fixed on screen; room elements pan/zoom together |
| 2026-03-08 | mouseToTile helper replaces getHoveredTile | Camera-aware inverse transform before isometric tile conversion |
| 2026-03-08 | country_gate as teleport booth stand-in from cortex-assets | Real Habbo furniture item available in cortex-assets repo |
| 2026-03-08 | 600ms teleport effect duration with sin-curve alpha peak | Smooth peak at progress=0.5, natural fade-in/fade-out |
| 2026-03-08 | Radial gradient with lighter composite for teleport glow | White center fading to light blue; additive blending for luminous effect |
| 2026-03-08 | Read first 50 JSONL lines for initial classification | Balances speed vs accuracy for agent display on spawn |
| 2026-03-08 | EventEmitter on OrchestrationPanelProvider for extension-level actions | Decouples sidebar message handling from provider class |
| 2026-03-08 | MessageBridge broadcastAgentEvent replaces direct postMessage | Both room and sidebar receive agent updates uniformly |
| 2026-03-08 | ROLE_OUTFIT_PRESETS uses existing catalog setIds with distinct color schemes per team | No new cortex-assets needed; visual differentiation via color palette and clothing type |
| 2026-03-08 | Core Dev idle: sit-at-desk, Planning idle: pace with 8-12s pauses | Role-appropriate behaviors make agents visually recognizable by team |
| 2026-03-08 | onClassificationNeeded callback pattern for VS Code UI | Separates extension host UI concerns from agent manager logic |
| 2026-03-08 | Dismissed quickpick defaults to core-dev team | Consistent with Plan 01 unmapped role default |
| 2026-03-08 | Popup card auto-dismisses after 5 seconds; second click opens builder | Avoid UI clutter; progressive disclosure |
| 2026-03-08 | Furniture activity glow uses lighter composite with 10s threshold | Non-destructive additive glow responsive to recent agent events |
| 2026-03-08 | Auto-follow camera 3s check interval with 10% lerp per frame | Smooth pan avoids jarring jumps; 3s debounce prevents flicker |
| 2026-03-08 | Role Outfits tab preserves skin color when applying presets | Maintains avatar identity while changing team outfit |
| 2026-03-08 | Lazy SectionManager initialization from global floorTemplate | Set in webview.tsx, consumed in RoomCanvas via window global |
| 2026-03-08 | Walk-to-booth despawn with 500ms delay for teleport flash | Smooth animation before avatar removal |
| 2026-03-08 | Section furniture populated from template on canvas init | All 4 zone furniture arrays merged into render state |
| 2026-03-09 | meta.json as authoritative agent classification source | JSONL scanning unreliable for sub-agent types; meta.json written by Claude Code |
| 2026-03-09 | Root-level JSONL files excluded from agent discovery | Parent conversations are orchestrators, not working sub-agents |
| 2026-03-09 | Dedup guard before spawn in agentCreated handler | Prevents all side effects from re-broadcast messages |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Fix invisible teleport booths - change country_gate direction from 2 to 0 | 2026-03-08 | e19fae2 | [1-fix-invisible-teleport-booths-change-cou](./quick/1-fix-invisible-teleport-booths-change-cou/) |
| 2 | Watch subagents subdirectories for sub-agent JSONL files in AgentManager | 2026-03-08 | 3df25a6 | [2-watch-subagents-subdirectories-for-sub-a](./quick/2-watch-subagents-subdirectories-for-sub-a/) |
| 3 | Only discover sub-agents from the current active session | 2026-03-09 | 033e1cd | [3-only-discover-sub-agents-from-the-curren](./quick/3-only-discover-sub-agents-from-the-curren/) |
| 4 | Auto-despawn agents through teleport booth when JSONL files removed | 2026-03-09 | ddf45c6 | [4-auto-despawn-agents-through-teleport-boo](./quick/4-auto-despawn-agents-through-teleport-boo/) |

## Blockers

None.

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01-coordinate-foundation | 01-01 | 5min | 2 | 6 |
| 02-static-room-rendering | 02-01 | 2min | 2 | 2 |
| 02-static-room-rendering | 02-02 | 3min | 2 | 3 |
| 02-static-room-rendering | 02-03 | 25min | 3 | 5 |
| 03-asset-pipeline | 03-01 | 5min | 2 | 4 |
| 03-asset-pipeline | 03-02 | 4min | 2 | 3 |
| 03-asset-pipeline | 03-03 | 6min | 3 | 5 |
| 04-furniture-rendering | 04-01 | 4min | 2 | 3 |
| 04-furniture-rendering | 04-02 | 5min | 2 | 3 |
| 04-furniture-rendering | 04-03 | 6min | 3 | 4 |
| 05-avatar-system | 05-01 | 5min | 3 | 9 |
| 05-avatar-system | 05-02 | 6min | 3 | 7 |
| 05-avatar-system | 05-03 | 3min | 2 | 3 |
| 07-layout-editor-integration | 07-01 | 4min | 2 | 3 |
| 07-layout-editor-integration | 07-02 | 6min | 2 | 3 |
| 07-layout-editor-integration | 07-03 | 5min | 3 | 4 |
| 06-ui-overlays | 06-01 | 4min | 2 | 3 |
| 06-ui-overlays | 06-02 | 3min | 2 | 2 |
| 06-ui-overlays | 06-03 | 4min | 2 | 3 |
| 08-audio | 08-01 | 4min | 2 | 3 |
| 08-audio | 08-02 | 3min | 2 | 2 |
| 08-audio | 08-03 | 5min | 3 | 4 |
| 11-chair-layer-splitting | 11-01 | 3min | 2 | 3 |
| 12-room-walls-kanban-notes | 12-01 | 3min | 2 | 4 |
| 12-room-walls-kanban-notes | 12-02 | 5min | 2 | 5 |
| Phase 12-room-walls-kanban-notes P12-03 | 2min | 2 tasks | 3 files |
| Phase 17-bugfixes-and-wishlist P17-01 | 3min | 2 tasks | 2 files |
| Phase 14-avatar-builder-ui P14-01 | 8min | 2 tasks | 3 files |
| Phase 14-avatar-builder-ui P14-02 | 3min | 2 tasks | 7 files |
| Phase 14-avatar-builder-ui P14-03 | 3min | 2 tasks | 3 files |
| Phase 14.1-avatar-facial-features P14.1-01 | 4min | 2 tasks | 6 files |
| Phase 17-bugfixes-and-wishlist P17-02 | 2min | 2 tasks | 3 files |
| Phase 17-bugfixes-and-wishlist P17-03 | 2min | 2 tasks | 3 files |
| Phase 17.1-stray-pixel-diagnostic-fix-and-right-click-movement P17.1-01 | 16min | 1 task | 4 files |
| Phase 17.1-stray-pixel-diagnostic-fix-and-right-click-movement P17.1-02 | 1min | 1 task | 1 file |
| Phase 17.2-fix-walking-animation-clipping-and-layer-artifacts P17.2-01 | 2min | 2 tasks | 2 files |
| Phase 16-agent-factory-workflow P16-01 | 3min | 2 tasks | 3 files |
| Phase 16-agent-factory-workflow PP16-02 | 2min | 2 tasks tasks | 2 files files |
| Phase 16-agent-factory-workflow P16-03 | 4min | 2 tasks | 3 files |
| Phase 16-agent-factory-workflow PP16-04 | 2min | 2 tasks tasks | 5 files files |
| Phase 16-agent-factory-workflow P16-05 | 2min | 2 tasks | 4 files |
| Phase 16-agent-factory-workflow P16-06 | 3min | 2 tasks | 4 files |
| Phase 16-agent-factory-workflow P16-07 | 3min | 2 tasks | 3 files |
| Phase 16-agent-factory-workflow P16-08 | 4min | 2 tasks | 7 files |
| Phase 16-agent-factory-workflow P16-09 | 6min | 3 tasks | 4 files |
| Phase 17.3-fix-move-logic-to-respect-selected-avatar PP17.3-01 | 1min | 1 task tasks | 1 file files |
| Phase quick-2 P01 | 1min | 1 tasks | 1 files |
| Phase 17.4-fix-agent-discovery-pipeline P01 | 2min | 2 tasks | 3 files |
| Phase quick-3 P01 | 1min | 1 tasks | 1 files |
| Phase quick-4 P01 | 1min | 1 tasks | 1 files |
| Phase 17.5-auto-despawn-agents-on-task-completion P01 | 2min | 1 tasks | 2 files |

## Phase History

| Phase | Plan | Summary |
|-------|------|---------|
| 01-coordinate-foundation | 01-01 | Node/TypeScript/Vitest bootstrapped; 24 isometric math assertions passing |
| 02-static-room-rendering | 02-01 | Isometric types and pure logic implemented with TDD (25 tests passing) — parseHeightmap, hsbToHsl, tileColors, depthSort |
| 02-static-room-rendering | 02-02 | Canvas drawing module with HiDPI support, depth-sorted rendering, and wall strip edge detection (58 tests passing) |
| 02-static-room-rendering | 02-03 | React component with StrictMode-safe rAF loop, VS Code extension host + webview, esbuild bundling — visual verification approved |
| 03-asset-pipeline | 03-01 | Sprite cache with ImageBitmap loading, frame lookup API, cortex-assets download script |
| 03-asset-pipeline | 03-02 | Dual esbuild configs (extension host + webview), prebuild hook, .gitignore for extracted assets |
| 03-asset-pipeline | 03-03 | Asset copy plugin, webview URI generation, CSP img-src, cortex-to-nitro conversion script |
| 04-furniture-rendering | 04-01 | Single-tile furniture renderer validated with chair — atlas frame lookup and anchor offset positioning |
| 04-furniture-rendering | 04-02 | Multi-tile furniture with max-coordinate sort key — desk renders correctly with avatar depth ordering |
| 04-furniture-rendering | 04-03 | All 8 furniture types integrated into render loop with visual validation against Habbo v14 reference |
| 05-avatar-system | 05-01 | Implemented 8-direction avatar renderer with 11-layer Nitro figure composition using cortex-assets figure data |
| 05-avatar-system | 05-02 | Walk cycle animation (4 FPS), idle blinks (5-8s intervals), and Matrix spawn effects with 184 placeholder sprites (idle, walk, blink overlays) |
| 05-avatar-system | 05-03 | BFS pathfinding integration with isometric avatar movement - tile paths to screen positions with facing directions and parent/child relationship lines |
| 07-layout-editor-integration | 07-01 | Mouse-to-tile conversion with inverse isometric formula and hover highlight rendering (10 tests passing) - getHoveredTile handles canvas scaling and camera offset |
| 07-layout-editor-integration | 07-02 | Editor state management and tile painting integration (16 tests passing) - toggleTileWalkability, setTileColor, mouse handlers in RoomCanvas with hover tracking |
| 07-layout-editor-integration | 07-03 | Furniture placement UI, color picker, rotation, and save/load — layout editor feature-complete |
| 06-ui-overlays | 06-01 | Speech bubble renderer with word wrapping, waiting animation, and triangular tail anchoring |
| 06-ui-overlays | 06-02 | Name tag renderer with status dots and semi-transparent pills |
| 06-ui-overlays | 06-03 | Press Start 2P font bundled with @font-face; Volter deferred to post-v1 |
| 08-audio | 08-01 | AudioManager module with graceful codec failure handling and silent fallback |
| 08-audio | 08-02 | OGG Vorbis audio conversion for all Habbo sound effects |
| 08-audio | 08-03 | Extension integration with CSP media-src, user gesture initialization, empirical testing complete |
| 11-chair-layer-splitting | 11-01 | Chair seat and backrest split into separate renderables with depth bias for correct avatar occlusion |
| 12-room-walls-kanban-notes | 12-01 | Full-height room perimeter wall panels with shared baseline replacing per-tile wall strips (14 new tests, 263 total passing) |
| 12-room-walls-kanban-notes | 12-02 | GitHub Projects v2 kanban fetch via gh CLI graphql with VS Code settings, polling interval, and silent error fallback returning KanbanCard[] to webview (268 tests passing) |
| 12-room-walls-kanban-notes | 12-03 | Sticky note renderer for kanban cards on isometric room walls — color-coded by status, distributed across left/right wall tile slots (279 tests passing) |
| 17-bugfixes-and-wishlist | 17-01 | In Progress notes constrained to left wall only — removed rightSmallTiles loop, updated capacity formula, added single-wall assertion test (277 tests passing) |
| 14-avatar-builder-ui | 14-01 | OutfitConfig type system with 28 curated clothing items, color palettes, 8 default presets, and 14 new cortex-assets figure downloads (301 tests passing) |
| 14-avatar-builder-ui | 14-02 | Dynamic OutfitConfig wired into avatar renderer with per-agent outfit persistence via .habbo-agents/avatars.json (309 tests passing) |
| 14-avatar-builder-ui | 14-03 | Avatar builder modal with live preview, clothing/color customization, gender toggle, wardrobe presets, and click-to-open/save flow (309 tests passing) |
| 14.1-avatar-facial-features | 14.1-01 | Eyes and mouth added to 13-layer avatar composition using hh_human_face cortex-asset with blink via eyb action and direction-filtered rendering (317 tests passing) |
| 17-bugfixes-and-wishlist | 17-02 | Fixed tint canvas residual pixel leak by clearing full canvas dimensions; added direction mapping and face rendering tests (321 tests passing) |
| 17-bugfixes-and-wishlist | 17-03 | Converted avatar builder from full-screen blocking modal to compact inline panel at bottom-left, enabling simultaneous canvas interaction (321 tests passing) |
| 17.1-stray-pixel-diagnostic-fix-and-right-click-movement | 17.1-01 | Spritesheet scanner confirms clean PNGs; tint canvas imageSmoothingEnabled=false eliminates compositing ghost pixels (321 tests passing) |
| 17.1-stray-pixel-diagnostic-fix-and-right-click-movement | 17.1-02 | Right-click avatar movement via onContextMenu handler; left-click simplified to selection and builder panel only (321 tests passing) |
| 17.2-fix-walking-animation-clipping-and-layer-artifacts | 17.2-01 | Walk-frame offset delta correction for chest/head/hair/face parts tracking body bounce during walk animation (325 tests passing) |
| 16-agent-factory-workflow | 16-01 | Agent classification pipeline mapping JSONL subagent_type to roles, teams, and display names with 26 tests (351 tests passing) |
| 16-agent-factory-workflow | 16-02 | Room layout engine generating 2x2 section grid templates with dividers, doorways, and per-section tiles for 3 sizes (371 tests passing) |
| 16-agent-factory-workflow | 16-03 | Click-drag pan and scroll-wheel zoom for room canvas with pivot-point correction and camera-aware tile picking (380 tests passing) |
| 16-agent-factory-workflow | 16-04 | Section-themed furniture catalog with teleport booth, radial gradient spawn/despawn flash effect, and per-team furniture placement (390 tests passing) |
| 16-agent-factory-workflow | 16-05 | Classification pipeline wired into agent discovery with auto-classify on spawn, VS Code quickpick for unknowns, and webview team reassignment (390 tests passing) |
| 16-agent-factory-workflow | 16-06 | SectionManager wiring template layout into live rendering with section-aware agent spawning at teleport booths, walk-to-booth despawn flow, and teleport flash effects (390 tests passing) |
| 16-agent-factory-workflow | 16-07 | Role-based outfit presets and team-specific idle behaviors: coders sit at desks, planners pace, others wander within section bounds (390 tests passing) |
| 16-agent-factory-workflow | 16-08 | Orchestration sidebar panel with agent list, section overview, activity log, MessageBridge relay, and quick actions (399 tests passing) |
| 16-agent-factory-workflow | 16-09 | Agent popup cards, activity-linked furniture glows, Role Outfits tab in Avatar Builder, and auto-follow camera (399 tests passing) |

### Pending Todos

1 pending todo.

## Accumulated Context

### Roadmap Evolution
- Phase 16 added: Agent factory workflow with team sections and orchestration UI
- Phase 17 added: Bugfixes & Wishlist — ongoing phase for incremental fixes and polish
- Phase 14.1 inserted after Phase 14: Avatar facial features - add eyes and mouth to avatar head rendering (URGENT)
- Phase 17.1 inserted after Phase 17: Stray pixel diagnostic fix and right-click movement (URGENT)
- Phase 17.2 inserted after Phase 17: Fix walking animation clipping and layer artifacts (URGENT)
- Phase 17.3 inserted after Phase 17: Fix move logic to respect selected avatar (URGENT)
- Phase 17.4 inserted after Phase 17: Fix agent discovery pipeline - deduplicate spawns, filter parent conversations, classify sub-agents properly (URGENT)
- Phase 17.5 inserted after Phase 17: Auto-despawn agents on task completion (URGENT)
