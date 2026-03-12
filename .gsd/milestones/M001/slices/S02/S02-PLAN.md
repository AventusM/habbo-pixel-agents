# S02: Static Room Rendering

**Goal:** Define the pure data types and logic functions that the tile renderer (Plan 02) and React component (Plan 03) depend on.
**Demo:** Define the pure data types and logic functions that the tile renderer (Plan 02) and React component (Plan 03) depend on.

## Must-Haves


## Tasks

- [x] **T01: 02-static-room-rendering 01**
  - Define the pure data types and logic functions that the tile renderer (Plan 02) and React component (Plan 03) depend on. This is a TDD plan — tests are written first, then implementation, RED-GREEN-REFACTOR.

Purpose: Establish a typed contract for the tile grid and rendering pipeline before any canvas code is written. Tests run in the Node environment (no DOM), confirming these modules are renderer-independent.

Output: `src/isoTypes.ts` with all shared types and pure logic; passing unit tests covering all cases needed by ROOM-02, ROOM-03, ROOM-04, ROOM-06, ROOM-07.
- [x] **T02: 02-static-room-rendering 02**
  - Implement `src/isoTileRenderer.ts` — the pure canvas drawing module that produces the complete static room geometry (floor rhombuses and wall strips) on an OffscreenCanvas. No React imports. No DOM lifecycle. All drawing is deterministic given the tile grid and canvas dimensions.

Purpose: Separate all canvas path logic from React lifecycle. This module is called once per layout load from RoomCanvas.tsx (Plan 03) to produce the pre-rendered room bitmap.

Output: `src/isoTileRenderer.ts` with `initCanvas`, `computeCameraOrigin`, `preRenderRoom`, and `WALL_HEIGHT` constant. Verified by manual inspection of canvas output via a test harness or direct visual check.
- [x] **T03: 02-static-room-rendering 03**
  - Wire `isoTileRenderer.ts` into a React component (`RoomCanvas.tsx`) and a VS Code extension entry point (`extension.ts` + `webview.tsx`). This plan implements the React lifecycle, StrictMode-safe rAF loop, OffscreenCanvas compositing, heightmap change detection, and esbuild bundling — producing a demo-able VS Code webview.

Purpose: Deliver the visible end state of Phase 2 — a VS Code webview panel that renders a correct isometric room from a heightmap string and can be visually verified.

Output: `RoomCanvas.tsx`, `extension.ts`, `webview.tsx`. Verified by loading the extension in VS Code and visually inspecting the rendered room.

## Files Likely Touched

- `src/isoTypes.ts`
- `tests/isoTypes.test.ts`
- `src/isoTileRenderer.ts`
- `src/RoomCanvas.tsx`
- `src/extension.ts`
- `src/webview.tsx`
