---
id: Q11
title: "Mobile viewport: pinch-zoom, touch pan, fit-to-screen, resize re-render"
type: quick
status: done
completed: 2026-09-06
verification_result: passed
files_modified:
  - src/cameraController.ts
  - src/isoTileRenderer.ts
  - src/RoomCanvas.tsx
  - src/agentTypes.ts
  - tsconfig.json
  - tests/cameraController.test.ts
---

# Q11: Mobile viewport support for the room — SUMMARY

**Room fits mobile viewports on load, pinches/pannes by touch, and desktop
resizes no longer crop walls/tiles.**

## What Happened

Three root causes found and fixed:
1. `initCanvas` pinned `canvas.style.width` to the measured pixel value, so
   after any viewport change offsetWidth was frozen and re-init measured the
   stale size (the reported crop bug). Fixed: re-assert 100% sizing before
   measuring; transform reset before DPR scale so initCanvas is re-runnable.
2. No resize listener: added a debounced (150ms) handler — re-init canvas,
   recompute camera origin, `reRenderRoom()` the offscreen buffer.
3. No touch input: added `touch-action: none`; 1-finger pan, 2-finger pinch
   zoom with start-midpoint pivot via new `setZoomWithPivot` (+ `clampZoom`)
   in cameraController. Fit-to-viewport initial zoom (≤1, ≥0.3) computed with
   the same bounds math as computeCameraOrigin.

## Bonus: tsconfig coverage gap

`tsconfig.json` included only `src/**/*.ts` — **no .tsx file was ever
typechecked**. Added `src/**/*.tsx` + `"jsx": "react-jsx"`. The TILE_H
ReferenceError (missing import in computeFitZoom) that broke rendering was
invisible to typecheck because of this; after the fix the .tsx surface is
checked (pre-existing test-file errors unchanged at 7 baseline). Also fixed
the surfaced missing `clearAgents` ExtensionMessage type.

## Verification

- `npx vitest run` — 536/536 (3 new: clampZoom + setZoomWithPivot pivot math)
- typecheck — 7 errors (pre-existing baseline; .tsx now covered)
- Browser-verified: load at 600×500 → room fits viewport width (zoom 0.75);
  enlarge to 1280×800 → full repaint with margins on all sides (no crop);
  backing store follows DPR (2560×1600 at dpr2)
- Pushed to Pages (PR #67) for mobile pinch/pan UAT
