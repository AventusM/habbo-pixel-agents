---
created: 2026-03-08T19:45:00.000Z
title: Verify DPR coordinate fix across displays and interactions
area: rendering
files:
  - src/RoomCanvas.tsx
---

## Problem

Fixed a systemic DPR bug where `canvas.width/height` (physical pixels) was used instead of `canvas.offsetWidth/offsetHeight` (CSS pixels) for all coordinate math in RoomCanvas. This caused floor tiles to render at DPR×offset from avatars/furniture on Retina displays, and broke tile hover, click, sticky note selection, camera pan/zoom, and jump-to-section.

## Solution

Replaced all coordinate-space `canvas.width/height` with `canvas.offsetWidth/offsetHeight` in:
- `drawImage(offscreen)` destination size
- `applyCameraTransform` dimensions
- `mouseToTile` scale and `screenToWorld` dimensions
- `jumpToSection` and auto-follow camera target
- `drawOrchestrationOverlay` dimensions
- Mouse drag pan scaling
- Wheel zoom pivot and bounds
- Sticky note click detection (was using `* dpr`, now uses CSS scale + `screenToWorld`)

Verify on: Retina (DPR=2), external monitor (DPR=1), various VS Code zoom levels. Check:
- Floor tiles align with avatars
- Tile hover highlights match cursor position
- Click-to-select avatars works
- Right-click movement targets correct tile
- Sticky note click detection works
- Camera pan/zoom behaves correctly
- Jump-to-section centers correctly
