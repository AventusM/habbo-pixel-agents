---
id: M003
title: "PixelLab Furniture Replacement"
status: complete
completed_at: 2026-04-11T13:18:00.400Z
key_decisions:
  - Single layer (layerCount=1) — PixelLab produces static images, no animated flame layers
  - Offset calibration: x=-22, y=-35 (bottom_y=9, matching other floor-standing furniture)
  - Glow overlay: screenY-15, r=48 (recalibrated for smaller sprite)
key_files:
  - assets/habbo/furniture/hc_lmp.png
  - assets/habbo/furniture/hc_lmp.json
  - src/isoFurnitureRenderer.ts
  - scripts/pack-pixellab-furniture.mjs
lessons_learned:
  - (none)
---

# M003: PixelLab Furniture Replacement

**Replaced the hc_lmp Habbo sprite with a PixelLab-generated oil lamp, including Nitro JSON conversion, offset calibration, and glow overlay repositioning.**

## What Happened

S01 delivered the full PixelLab oil lamp pipeline: PNG packed into a Nitro-compatible spritesheet with shadow diamond and icon, single-layer JSON manifest (layerCount=1, since PixelLab produces static images), offsets calibrated to bottom_y=9 matching other floor-standing furniture, and glow overlay radius/position recalibrated to match the smaller sprite. The build pipeline (pack-pixellab-furniture.mjs + esbuild) was verified end-to-end. No regressions in other furniture rendering.

## Success Criteria Results

- PixelLab oil lamp renders in-room at correct tile position and depth ✅ (verified in Extension Development Host)
- Warm glow overlay activates when section has active agents ✅ (repositioned to screenY-15, r=48)
- No regressions in other furniture rendering ✅

## Definition of Done Results

- hc_lmp replaced with PixelLab oil lamp in dist assets ✅
- Lamp renders correctly in a running room ✅
- Glow overlay still works ✅
- No console errors from asset loading ✅

## Requirement Outcomes



## Deviations

None.

## Follow-ups

None.
