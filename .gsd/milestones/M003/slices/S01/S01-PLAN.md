# S01: Replace hc_lmp With PixelLab Oil Lamp

**Goal:** Replace the copyrighted Habbo hc_lmp furniture sprite with a PixelLab-generated oil lamp image.
**Demo:** The PixelLab oil lamp renders in the room wherever hc_lmp appeared, with working glow overlay.

## Must-Haves

- PixelLab oil lamp PNG converted to Nitro-compatible spritesheet + JSON
- Existing hc_lmp assets replaced in dist/webview-assets/furniture/
- Glow overlay repositioned for the shorter PixelLab sprite
- Build passes, no console errors from asset loading

## Proof Level

- This slice proves: integration
- Real runtime required: yes (Extension Development Host)
- Human/UAT required: yes (visual inspection)

## Verification

- `node esbuild.config.mjs` — build passes without errors
- Extension Development Host: hc_lmp loads without console errors
- Visual: PixelLab oil lamp renders on tile, glow overlay activates

## Tasks

- [x] **T01: Convert PixelLab PNG to Nitro furniture format** `est:20m`
  - Why: loadNitroAsset() expects a specific JSON schema with spritesheet frames, asset offsets, visualization, and logic metadata
  - Files: `dist/webview-assets/furniture/hc_lmp.png`, `dist/webview-assets/furniture/hc_lmp.json`
  - Do: Pack the 44×44 PixelLab image into a Nitro spritesheet with shadow diamond and icon. Set offsets: x=-22 (centered), y=-35 (bottom_y=9, matching original floor-standing items). layerCount=1, directions=[0], dimensions=[1,1,1].
  - Verify: JSON schema validation passes
  - Done when: hc_lmp.json + hc_lmp.png replaced and matching NitroAssetData schema

- [x] **T02: Adjust glow overlay for PixelLab lamp dimensions** `est:10m`
  - Why: Original glow was at screenY-55 for a 90px lamp; PixelLab lamp is 44px
  - Files: `src/isoFurnitureRenderer.ts`
  - Do: Move glow center from screenY-55 to screenY-15, reduce radius from 64 to 48 to match shorter lamp
  - Verify: Build passes
  - Done when: Glow overlay code updated for new sprite dimensions

- [x] **T03: Build and visual verification** `est:10m`
  - Why: Must verify the complete integration in a running room
  - Files: none (verification only)
  - Do: Run build, launch Extension Development Host, inspect lamp rendering
  - Verify: `node esbuild.config.mjs` passes, lamp visible in room
  - Done when: Lamp renders correctly on tile in Extension Development Host

## Files Likely Touched

- `dist/webview-assets/furniture/hc_lmp.png`
- `dist/webview-assets/furniture/hc_lmp.json`
- `src/isoFurnitureRenderer.ts`
