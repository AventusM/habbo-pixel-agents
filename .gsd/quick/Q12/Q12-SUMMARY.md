---
id: Q12
title: "Full-room rendering at any viewport + parallel asset loading"
type: quick
status: done
completed: 2026-09-06
verification_result: passed
files_modified:
  - src/RoomCanvas.tsx
  - src/web/main.tsx
  - src/webview.tsx
---

# Q12: Full-room rendering + load speed — SUMMARY

## Problem (from mobile UAT screenshot)

The offscreen room buffer was sized to the *viewport*, so on a phone the buffer
clipped the room: only one section's floor+walls rendered while furniture and
avatars (drawn live) floated around it. Zooming out couldn't recover pixels
that were never rendered. Also, loading 42 figure + 26 furniture Nitro assets
sequentially made first paint slow.

## Solution

1. `renderRoomBuffer()`: the offscreen buffer is sized to the ROOM's world
   extent (bounds via `computeRoomBounds`, + 48px pad), min the viewport size —
   the full room is always pre-rendered; camera zoom/pan merely navigates it
2. Frame loop draws the buffer at its world size (`drawImage(offscreen, 0, 0,
   bufW, bufH)`) under the camera transform
3. Camera init: zoom = fit-to-viewport (≤1), pan centers the buffer —
   `pan = canvasCenter − bufferCenter` (zoom-independent centering)
4. Resize: re-render buffer (grows with viewport), re-center, preserve zoom
5. Nitro furniture + figure loading parallelized with `Promise.all` in both
   the web and extension loaders (68 sequential awaits → parallel)

## Verification

- typecheck 7 (baseline); vitest 536/536; bundle markers present
- Deployed via PR #68; mobile UAT on Pages (full room visible, all sections'
  floors + walls + furniture aligned, pinch to zoom, pan to explore)
