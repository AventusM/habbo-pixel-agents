---
created: 2026-03-07T19:08:21.831Z
title: Fix walking animation clipping and layer artifacts
area: rendering
files:
  - src/isoAvatarRenderer.ts
---

## Problem

Walking animations have visual glitches in certain directions:
- Clipping between avatar body and clothing layers (body parts showing through clothes)
- "Two left hands" artifact — duplicate or misaligned hand layers visible in some directions
- Similar small visual inconsistencies during walk cycle frames

Likely caused by incorrect layer ordering, offset miscalculation, or flip logic errors for specific direction + walk frame combinations in the avatar renderer. The 11-layer figure composition (hrb, bd, lh, rh, lg, sh, ch, ls, rs, hd, hr) may have incorrect z-ordering or offset data for certain walking directions.

## Solution

- Investigate layer draw order per direction during walk frames in `isoAvatarRenderer.ts`
- Check if flip logic (XOR of `shouldMirrorSprite(direction)` and frame `flipH`) produces correct results for all 8 directions during walk cycles
- Verify cortex-assets walk frame offsets for each body part layer — some frames may have incorrect offset data causing overlap/clipping
- Compare rendered output against Habbo v14 reference for each walking direction
- Phase 17 bugfix item — plan and execute via GSD workflow
