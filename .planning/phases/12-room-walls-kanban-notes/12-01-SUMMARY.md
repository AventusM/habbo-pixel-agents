---
phase: 12-room-walls-kanban-notes
plan: 01
subsystem: rendering
tags: [walls, isometric, canvas, geometry]
dependency_graph:
  requires: [src/isometricMath.ts, src/isoTypes.ts, src/isoTileRenderer.ts]
  provides: [src/isoWallRenderer.ts]
  affects: [src/isoTileRenderer.ts, tests/setup.ts]
tech_stack:
  added: []
  patterns: [painter's-algorithm, shared-baseline-geometry, parallelogram-wall-strips]
key_files:
  created:
    - src/isoWallRenderer.ts
    - tests/isoWallRenderer.test.ts
  modified:
    - src/isoTileRenderer.ts
    - tests/setup.ts
decisions:
  - "Wall panels draw before floor tiles on the OffscreenCanvas so painter's algorithm keeps walls behind all floor geometry"
  - "Shared baseline computed as max(sy + TILE_H + WALL_HEIGHT) across all edge tiles, ensuring no gaps between tiles at different heights"
  - "Corner post uses fillRect (4px wide vertical rectangle) centered at tile (0,0) top vertex"
  - "drawLeftFace and drawRightFace kept in isoTileRenderer.ts for potential future use (wall-mounted furniture)"
metrics:
  duration: 3min
  completed: "2026-03-05"
  tasks: 2
  files: 4
---

# Phase 12 Plan 01: Room Wall Panels Summary

Full-height isometric wall panels replacing per-tile wall strips, using a shared baseline to eliminate height-gap artifacts.

## What Was Built

- `src/isoWallRenderer.ts`: New module exporting `drawWallPanels()` — scans TileGrid for left and right wall edge tiles, computes a shared baseline for each wall side, draws parallelogram strips extending to that baseline, and draws a 4px corner post at tile (0,0)
- Updated `preRenderRoom` in `src/isoTileRenderer.ts` to call `drawWallPanels` before the depth-sorted floor tile loop and removed the per-tile `drawLeftFace`/`drawRightFace` calls from the renderable draw closures

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create isoWallRenderer.ts with wall geometry and tests | a71c48b | src/isoWallRenderer.ts, tests/isoWallRenderer.test.ts |
| 2 | Integrate wall panels into preRenderRoom, remove per-tile strips | c8fcfc5 | src/isoTileRenderer.ts, tests/setup.ts |

## Decisions Made

- **Wall panels before floor tiles:** Walls are drawn first on the OffscreenCanvas so the depth-sorted floor tiles (drawn after) naturally cover the bottom edges of wall strips — correct painter's algorithm layering with no extra z-sorting needed.
- **Shared baseline per wall side:** Each wall side (left / right) independently computes `max(sy + TILE_H + WALL_HEIGHT)` across all its edge tiles. This guarantees strips from high-elevation tiles still reach the same bottom as strips from low-elevation tiles — no gaps.
- **Parallelogram geometry:** Left wall strips shear left (maintaining the 2:1 isometric diamond angle). Bottom-left vertex is `(sx - TILE_W_HALF, baseline - TILE_H_HALF)` to preserve the parallelogram shear rather than dropping straight down.
- **Corner post via fillRect:** A 4px-wide rectangle at the tile (0,0) top vertex fills the V-notch between left and right wall panels at the back of the room.
- **Keep drawLeftFace/drawRightFace:** The per-tile helpers remain in `isoTileRenderer.ts` (no longer called from the tile loop) for potential future use in wall-mounted furniture rendering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OffscreenCanvas mock missing fillRect method**
- **Found during:** Task 2 verification (`npx vitest run tests/isoTileRenderer.test.ts`)
- **Issue:** The global OffscreenCanvas mock in `tests/setup.ts` did not include a `fillRect` method. When `drawWallPanels` was integrated into `preRenderRoom`, the corner post's `ctx.fillRect(...)` call threw `TypeError: ctx.fillRect is not a function`
- **Fix:** Added `fillRect: () => {}` to the mock context returned by `OffscreenCanvas.getContext()`
- **Files modified:** `tests/setup.ts`
- **Commit:** c8fcfc5

## Verification

- `npx vitest run` — 263 tests across 17 test files, all passing (14 new wall renderer tests + 249 existing)
- `npm run typecheck` — no TypeScript errors
- Visual verification: requires manual webview check to confirm walls appear as full-height panels

## Self-Check: PASSED

All files and commits verified:
- FOUND: src/isoWallRenderer.ts
- FOUND: tests/isoWallRenderer.test.ts
- FOUND: commit a71c48b (Task 1)
- FOUND: commit c8fcfc5 (Task 2)
