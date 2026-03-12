# T03: 16-agent-factory-workflow 03

**Slice:** S09 — **Milestone:** M002

## Description

Add click-drag panning and scroll-wheel zoom to the room canvas so users can navigate a large multi-section floor.

Purpose: The 2x2 section floor is too large to fit in a single viewport. Camera navigation is essential for Phase 16's multi-section layout.
Output: `cameraController.ts` with pan/zoom math, RoomCanvas integration, and tests.

## Must-Haves

- [ ] "User can click-drag to pan the room view"
- [ ] "User can scroll-wheel to zoom in/out"
- [ ] "Camera zoom is clamped between 0.3 and 2.0"
- [ ] "All rendering (tiles, furniture, avatars, overlays) respects camera transform"

## Files

- `src/cameraController.ts`
- `src/RoomCanvas.tsx`
- `tests/cameraController.test.ts`
