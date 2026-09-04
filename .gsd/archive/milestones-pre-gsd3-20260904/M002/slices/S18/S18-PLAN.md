# S18: Remove Copyrighted Habbo Characters

**Goal:** Generate 4 team-specific PixelLab characters and wire per-team atlas selection into the renderer.
**Demo:** Generate 4 team-specific PixelLab characters and wire per-team atlas selection into the renderer.

## Must-Haves


## Tasks

- [x] **T01: 17.8-remove-copyrighted-habbo-characters 01**
  - Generate 4 team-specific PixelLab characters and wire per-team atlas selection into the renderer.

Purpose: Before removing Habbo avatar code, all 4 teams must have distinct PixelLab characters so that removal leaves zero visual gaps. Each team gets a unique character: planning (suit/clipboard look), core-dev (hoodie/laptop — existing beanie-hoodie-guy works here), infrastructure (hard hat/tool-belt look), support (headset/help-desk look).

Output: 4 committed character spritesheets in assets/pixellab/, updated pixelLabAvatarRenderer.ts with per-team atlas selection, updated webview.tsx to load all atlases.
- [x] **T02: 17.8-remove-copyrighted-habbo-characters 02**
  - Remove all copyrighted Habbo character/figure code, assets, and UI. Add character legend panel.

Purpose: Eliminate all copyright-infringing Habbo figure content — renderer, builder UI, outfit catalog, figure assets, conversion scripts. Replace with a simple character legend panel showing which team maps to which character. After this plan, the only avatar renderer is PixelLab.

Output: 5 source files deleted, 2 test files deleted, 42 figure asset files deleted, ~10 files modified to remove Habbo references, 1 new CharacterLegendPanel.tsx created.
- [x] **T03: 17.8-remove-copyrighted-habbo-characters 03**
  - Full codebase audit for leftover Habbo figure references and UAT verification.

Purpose: Per user requirements, a full codebase audit after removal is mandatory to catch any remaining figure-related imports, references, or dead code paths. This plan also includes a human verification checkpoint to confirm the room view renders correctly with team-specific characters and the legend panel.

Output: Clean codebase with zero Habbo figure/character references. Visual verification of room rendering.

## Files Likely Touched

- `assets/pixellab/pl-planning.png`
- `assets/pixellab/pl-planning.json`
- `assets/pixellab/pl-core-dev.png`
- `assets/pixellab/pl-core-dev.json`
- `assets/pixellab/pl-infrastructure.png`
- `assets/pixellab/pl-infrastructure.json`
- `assets/pixellab/pl-support.png`
- `assets/pixellab/pl-support.json`
- `src/pixelLabAvatarRenderer.ts`
- `src/avatarManager.ts`
- `src/webview.tsx`
- `src/extension.ts`
- `src/isoAvatarRenderer.ts`
- `src/avatarOutfitConfig.ts`
- `src/avatarBuilderPreview.ts`
- `src/AvatarBuilderModal.tsx`
- `src/AvatarDebugGrid.tsx`
- `src/avatarRendererTypes.ts`
- `src/agentTypes.ts`
- `src/RoomCanvas.tsx`
- `src/webview.tsx`
- `src/extension.ts`
- `src/avatarManager.ts`
- `src/pixelLabAvatarRenderer.ts`
- `src/CharacterLegendPanel.tsx`
- `tests/isoAvatarRenderer.test.ts`
- `tests/avatarOutfitConfig.test.ts`
- `scripts/download-habbo-assets.mjs`
- `scripts/convert-cortex-to-nitro.mjs`
- `assets/habbo/figures/`
- `assets/habbo/manifest.json`
- `esbuild.config.mjs`
