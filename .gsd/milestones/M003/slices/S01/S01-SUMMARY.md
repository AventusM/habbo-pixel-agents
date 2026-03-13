---
id: S01
parent: M003
milestone: M003
provides:
  - PixelLab oil lamp as Nitro-compatible hc_lmp replacement
requires: []
affects: []
key_files:
  - dist/webview-assets/furniture/hc_lmp.png
  - dist/webview-assets/furniture/hc_lmp.json
  - src/isoFurnitureRenderer.ts
key_decisions:
  - Single layer (layerCount=1) instead of 4 — PixelLab produces static images, no animated flame layers
  - Offset calibration: x=-22 (centered), y=-35 (bottom_y=9, matching other floor-standing furniture)
  - Glow overlay repositioned from screenY-55 to screenY-15, radius reduced from 64 to 48
patterns_established:
  - PixelLab furniture → Nitro JSON conversion: pack PNG into spritesheet with shadow diamond + icon, set single layer, calibrate offsets by matching bottom_y to ~9
observability_surfaces:
  - Console log: "✓ Loaded Nitro furniture: hc_lmp" confirms asset loading
drill_down_paths:
  - .gsd/milestones/M003/slices/S01/S01-PLAN.md
duration: 30m
verification_result: passed
completed_at: 2026-03-12
---

# S01: Replace hc_lmp With PixelLab Oil Lamp

**Replaced copyrighted Habbo HC Lamp sprite with a PixelLab-generated oil lamp, including Nitro JSON conversion and glow overlay repositioning.**

## What Happened

Converted the 44×44 PixelLab oil lamp PNG (`pixellab-A-habbo-oil-lamp-1773429495282.png`) into a Nitro-compatible spritesheet + JSON. The spritesheet packs the main sprite, an isometric shadow diamond, and a scaled-down icon into a 44×83 PNG. Offsets were calibrated against other floor-standing furniture items (bolly_vase, exe_plant, original hc_lmp) — all have bottom_y ≈ 5–11, so offsetY=-35 gives bottom_y=9.

The original hc_lmp had 4 layers (body, animated flame, glow, shade detail). The PixelLab replacement uses layerCount=1 since it's a single static image — no animation.

The warm glow overlay in `isoFurnitureRenderer.ts` was repositioned from `screenY - 55` (tuned for the 90px original) to `screenY - 15` (appropriate for the 44px PixelLab lamp), with radius reduced from 64px to 48px.

## Verification

- Nitro JSON schema validation: passed (name, type, spritesheet, assets, visualization, logic all present)
- Build: `node esbuild.config.mjs` passes clean
- Extension Development Host: launched for visual inspection

## Deviations

none

## Known Limitations

- No animated flame — the PixelLab lamp is static, unlike the original's 4-frame flame animation
- Offset tuning is theoretical — based on matching other furniture's bottom_y values; may need empirical adjustment after visual inspection

## Follow-ups

- Visual fine-tuning of offset if the lamp sits too high/low on the tile
- Consider generating PixelLab versions of other furniture items using the same conversion pattern

## Files Created/Modified

- `dist/webview-assets/furniture/hc_lmp.png` — new PixelLab spritesheet (44×83)
- `dist/webview-assets/furniture/hc_lmp.json` — new Nitro JSON (1 layer, offsets -22/-35)
- `dist/webview-assets/furniture/hc_lmp.png.orig` — backup of original Habbo sprite
- `dist/webview-assets/furniture/hc_lmp.json.orig` — backup of original Habbo JSON
- `src/isoFurnitureRenderer.ts` — glow overlay repositioned for shorter lamp

## Forward Intelligence

### What the next slice should know
- The conversion pattern is: take PixelLab PNG → pack into spritesheet with shadow + icon → set layerCount=1, single direction, 1×1 dimensions → calibrate offsetY so bottom_y ≈ 9 for floor-standing items

### What's fragile
- Offset values (-22, -35) are calibrated analytically, not visually confirmed — first visual test may reveal the lamp floats or sinks

### Authoritative diagnostics
- Console log "✓ Loaded Nitro furniture: hc_lmp" in webview startup — confirms asset loaded correctly
- Missing sprite warning "❌ Missing furniture sprite: hc_lmp_64_a_0_0" — would indicate JSON/PNG mismatch

### What assumptions changed
- Original assumption: would need multiple layers for flame animation — actually PixelLab produces static images, so single layer is the right approach
