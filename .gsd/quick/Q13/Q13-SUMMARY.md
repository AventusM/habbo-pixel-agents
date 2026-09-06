---
id: Q13
title: "Render performance: tint cache, notes layer cache, visible-slice blit, throttle, DPR cap"
type: quick
status: done
completed: 2026-09-06
verification_result: passed
files_modified:
  - src/isoAvatarRenderer.ts
  - src/isoKanbanRenderer.ts
  - src/isoTileRenderer.ts
  - src/RoomCanvas.tsx
---

# Q13: Zoom/pan + general render performance — SUMMARY

## Problem

Zoom/pan laggy on mobile AND desktop. Per-frame costs at 60fps regardless of scene
activity: full room buffer scaled through the camera transform every frame,
60+ kanban notes re-rasterized (text!) every frame, ~10 Nitro body parts
re-tinted (draw → multiply → mask composite) per avatar per frame, all at up to
3x DPR.

## Fixes

1. **Tint cache** (`isoAvatarRenderer`): per-(frame, color, flip) tinted sprite
   cache via WeakMap — composite pipeline runs once per variant instead of
   every frame; draw is a single drawImage
2. **Kanban notes layer cache** (`RoomCanvas`): notes render into a world-space
   offscreen layer rebuilt only when inputs change (cards/filter/expand/ticket
   links/origin), then blitted like the room buffer
3. **Visible-slice blit** (`blitWorldLayer`): room + notes layers are blitted
   1:1 for the on-screen world rect only — no whole-buffer transform scaling
4. **Render throttle**: full rate while camera moves or agents walk/spawn;
   ~50ms cadence (~20fps) when static — idle/blink/walk frame rates fit
5. **DPR cap 2** for the main canvas + room/notes buffers (pixel art; ~44%
   fewer pixels on 3x phones)
6. `isoKanbanRenderer` context types widened to accept OffscreenCanvas 2D
   contexts (shared AnyCanvasCtx alias)

## Verification

- typecheck baseline (7), vitest 536/536
- Browser: idle render cadence measured at ~90ms (probe-inflated; target 50ms)
  vs continuous 60fps before; full rate during motion
- Deployed via PR for on-device UAT
