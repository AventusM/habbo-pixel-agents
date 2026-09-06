---
id: Q11
title: "Mobile viewport: pinch-zoom, touch pan, fit-to-screen, resize re-render"
type: quick
status: implemented (see Q11-SUMMARY.md)
created: 2026-09-06
files_modified:
  - src/cameraController.ts
  - src/isoTileRenderer.ts
  - src/RoomCanvas.tsx
  - tests/cameraController.test.ts
---

# Q11: Mobile viewport support for the room

## Problem

1. Room doesn't fit a mobile viewport — no touch zoom/pan.
2. Loading in a small window then enlarging leaves walls/tiles cropped:
   `initCanvas` + `preRenderRoom` run once at mount; no resize listener re-sizes
   the backing store or re-renders the offscreen room buffer.

## Solution

1. `initCanvas` resets its transform before DPR scaling (re-runnable)
2. RoomCanvas: debounced resize handler — re-init canvas, recompute camera origin, `reRenderRoom()`
3. Fit-to-viewport initial zoom (clamped ≤ 1, ≥ 0.3) using the same bounds math as `computeCameraOrigin`
4. Touch: `touch-action: none`; 1-finger pan, 2-finger pinch zoom with midpoint pivot
5. `cameraController`: exported `clampZoom` + `setZoomWithPivot` helpers (+ tests)

## Verification

- typecheck baseline, vitest green
- Build + deploy to Pages; mobile pinch/pan + desktop resize verified
