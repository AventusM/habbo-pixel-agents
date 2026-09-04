# T02: 17.8-remove-copyrighted-habbo-characters 02

**Slice:** S18 — **Milestone:** M002

## Description

Remove all copyrighted Habbo character/figure code, assets, and UI. Add character legend panel.

Purpose: Eliminate all copyright-infringing Habbo figure content — renderer, builder UI, outfit catalog, figure assets, conversion scripts. Replace with a simple character legend panel showing which team maps to which character. After this plan, the only avatar renderer is PixelLab.

Output: 5 source files deleted, 2 test files deleted, 42 figure asset files deleted, ~10 files modified to remove Habbo references, 1 new CharacterLegendPanel.tsx created.

## Must-Haves

- [ ] "No Habbo figure/character assets remain in the repository"
- [ ] "No Habbo avatar renderer code remains in src/"
- [ ] "No avatar builder UI is accessible or rendered"
- [ ] "Avatar builder related message types are removed from agentTypes.ts"
- [ ] "AvatarSpec no longer contains Habbo-specific fields (outfit, nextBlinkMs, blinkFrame)"
- [ ] "AvatarSpec has a team field for PixelLab character selection"
- [ ] "Character legend panel shows team-to-character mapping in the room view"
- [ ] "All tests pass (excluding pre-existing 5 failures)"
- [ ] "Figure download/conversion scripts no longer process figure assets"

## Files

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
