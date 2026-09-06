# M003: PixelLab Furniture Replacement — Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

## Project Description

Replace copyrighted Habbo Hotel furniture sprites with AI-generated PixelLab equivalents. Starting with `hc_lmp` (HC Lamp) as a proof-of-concept, then extending to the full furniture catalog.

## Why This Milestone

The project uses copyrighted Habbo Hotel furniture sprites extracted from cortex-assets. Replacing them with PixelLab-generated equivalents removes the copyright dependency while maintaining the isometric pixel art aesthetic. Starting with hc_lmp proves the pipeline before scaling.

## User-Visible Outcome

### When this milestone is complete, the user can:

- See the PixelLab oil lamp rendering in-room wherever hc_lmp previously appeared
- The lamp still functions with the existing glow overlay when active

### Entry point / environment

- Entry point: VS Code extension — `habbo-pixel-agents.openRoom`
- Environment: local dev (Extension Development Host)
- Live dependencies involved: none

## Completion Class

- Contract complete means: the Nitro JSON + PNG for hc_lmp load without errors and the sprite renders at correct position on the tile grid
- Integration complete means: the lamp appears in the room, glow overlay fires when active
- Operational complete means: none (no lifecycle concerns)

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- The PixelLab oil lamp renders in a running room at the correct tile position and depth
- The warm glow overlay still activates when the lamp's section has active agents

## Risks and Unknowns

- Offset calibration — the PixelLab image is 44×44 vs the original multi-layer sprite; offsets need empirical tuning to sit correctly on the isometric tile
- Single static image — the original hc_lmp had animated flame frames (layers b/c); the PixelLab image is static, so animation layers will be simplified

## Existing Codebase / Prior Art

- `src/isoFurnitureRenderer.ts` — renders Nitro furniture layers, contains hc_lmp glow overlay
- `src/isoSpriteCache.ts` — `loadNitroAsset()` loads per-item PNG + JSON
- `src/furnitureRegistry.ts` — catalog entry for hc_lmp
- `src/roomLayoutEngine.ts` — places hc_lmp in each section
- `src/webview.tsx` — loads Nitro assets from manifest at startup
- `dist/webview-assets/furniture/hc_lmp.{png,json}` — current cortex-assets sprites
- `dist/webview-assets/manifest.json` — furniture loading manifest

## Scope

### In Scope

- Convert PixelLab oil lamp PNG to Nitro-compatible spritesheet + JSON
- Replace hc_lmp assets in dist/webview-assets/furniture/
- Adjust rendering offsets for correct tile placement
- Maintain glow overlay functionality

### Out of Scope / Non-Goals

- Replacing other furniture items (future slices)
- Adding animation frames to the PixelLab lamp
- Modifying the Nitro loading pipeline

## Technical Constraints

- Must produce a valid NitroAssetData JSON matching the schema in isoSpriteCache.ts
- PNG must be loadable as ImageBitmap via the existing loadNitroAsset() flow
- Offsets are relative to tile floor center (diamond center)
