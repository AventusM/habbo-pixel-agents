# T02: 02-static-room-rendering 02

**Slice:** S02 — **Milestone:** M001

## Description

Implement `src/isoTileRenderer.ts` — the pure canvas drawing module that produces the complete static room geometry (floor rhombuses and wall strips) on an OffscreenCanvas. No React imports. No DOM lifecycle. All drawing is deterministic given the tile grid and canvas dimensions.

Purpose: Separate all canvas path logic from React lifecycle. This module is called once per layout load from RoomCanvas.tsx (Plan 03) to produce the pre-rendered room bitmap.

Output: `src/isoTileRenderer.ts` with `initCanvas`, `computeCameraOrigin`, `preRenderRoom`, and `WALL_HEIGHT` constant. Verified by manual inspection of canvas output via a test harness or direct visual check.

## Must-Haves

- [ ] "preRenderRoom() draws all non-void tiles as filled 64×32 rhombuses at the correct isometric positions on an OffscreenCanvas"
- [ ] "Tiles at height 1-9 are visually offset upward by tileZ*16 px — stair-step geometry is visible"
- [ ] "Floor tiles show three distinct fill colours (top/left/right faces) using HSL shading with correct brightness offsets"
- [ ] "Left wall strips appear on the left face of edge tiles (tx===0 or tile to the left is void); right wall strips on right face of edge tiles (ty===0 or tile above is void)"
- [ ] "Void (x/X) tiles produce no draw calls — the canvas shows panel background in those positions"
- [ ] "OffscreenCanvas is created at physical pixel dimensions (CSS size * DPR) with imageSmoothingEnabled=false on its context"
- [ ] "initCanvas() sets canvas.width/height to offsetWidth/offsetHeight*DPR, calls ctx.scale(dpr,dpr), sets imageSmoothingEnabled=false"
- [ ] "computeCameraOrigin() returns the pixel offset that centres the room bounding box in the given CSS pixel viewport dimensions"

## Files

- `src/isoTileRenderer.ts`
