---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: 07-layout-editor-integration/07-02-PLAN.md
status: in_progress
stopped_at: Completed 07-layout-editor-integration/07-01-PLAN.md
last_updated: "2026-03-01T18:06:15.000Z"
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 20
  completed_plans: 17
---

# STATE.md

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** Claude Code agents should feel like they're working together in a recognisable Habbo Hotel room — the isometric 2.5D aesthetic must be faithful to the classic v14 era.
**Current focus:** Phase 7 IN PROGRESS — Layout Editor Integration (1/3 plans complete)

## Current Status

Phase 7 (Layout Editor Integration) **IN PROGRESS**. Plan 07-01 complete — mouse-to-tile conversion with inverse isometric formula and hover highlight rendering. Next: Plan 07-02 - editor state management and tile painting integration.

**Last session:** 2026-03-01T18:06:15.000Z
**Stopped at:** Completed 07-layout-editor-integration/07-01-PLAN.md
**Next action:** Execute Plan 07-02 — integrate editor mode into RoomCanvas with tile painting

## Current Phase

**Phase:** 07-layout-editor-integration
**Current Plan:** 07-02-PLAN.md
**Status:** In Progress

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-28 | Fork pixel-agents, replace rendering layer only | Agent logic is correct and stable — only renderer changes |
| 2026-02-28 | Canvas 2D (not PixiJS/WebGL) for rendering | Zero overhead, sufficient for low-fps tile tool, matches existing codebase |
| 2026-02-28 | sphynxkitten/nitro-assets as primary asset source | Pre-extracted, no build-time SWF pipeline needed for V1 |
| 2026-02-28 | Build-time .nitro extraction via Node script | Never pass binary assets through esbuild |
| 2026-02-28 | OGG Vorbis for all audio | VS Code Electron ships without ffmpeg — MP3 decoding fails |
| 2026-02-28 | Press Start 2P as default font, Volter as opt-in | Volter is Sulake IP — default must be license-clean |
| 2026-02-28 | Never commit extracted Sulake assets to public repo | Low DMCA risk for personal tool, but keep assets local-only |
| 2026-02-28 | Simplified avatar sprites (3-4 layers) over full Habbo figure compositor | Full 13-layer body composition is out of scope for V1 |
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

## Blockers

None.

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01-coordinate-foundation | 01-01 | 5min | 2 | 6 |
| 02-static-room-rendering | 02-01 | 2min | 2 | 2 |
| 02-static-room-rendering | 02-02 | 3min | 2 | 3 |
| 02-static-room-rendering | 02-03 | 25min | 3 | 5 |
| 05-avatar-system | 05-01 | 5min | 3 | 9 |
| 05-avatar-system | 05-02 | 6min | 3 | 7 |
| 05-avatar-system | 05-03 | 3min | 2 | 3 |
| 07-layout-editor-integration | 07-01 | 4min | 2 | 3 |

## Phase History

| Phase | Plan | Summary |
|-------|------|---------|
| 01-coordinate-foundation | 01-01 | Node/TypeScript/Vitest bootstrapped; 24 isometric math assertions passing |
| 02-static-room-rendering | 02-01 | Isometric types and pure logic implemented with TDD (25 tests passing) — parseHeightmap, hsbToHsl, tileColors, depthSort |
| 02-static-room-rendering | 02-02 | Canvas drawing module with HiDPI support, depth-sorted rendering, and wall strip edge detection (58 tests passing) |
| 02-static-room-rendering | 02-03 | React component with StrictMode-safe rAF loop, VS Code extension host + webview, esbuild bundling — visual verification approved |
| 05-avatar-system | 05-01 | Implemented 8-direction avatar renderer with 4-layer composition and 6 palette variants using ImageMagick-generated placeholder sprites (192 total frames) |
| 05-avatar-system | 05-02 | Walk cycle animation (4 FPS), idle blinks (5-8s intervals), and Matrix spawn effects with 184 placeholder sprites (idle, walk, blink overlays) |
| 05-avatar-system | 05-03 | BFS pathfinding integration with isometric avatar movement - tile paths to screen positions with facing directions and parent/child relationship lines |
| 07-layout-editor-integration | 07-01 | Mouse-to-tile conversion with inverse isometric formula and hover highlight rendering (10 tests passing) - getHoveredTile handles canvas scaling and camera offset |
