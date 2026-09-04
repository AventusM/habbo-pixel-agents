---
phase: 17.8-remove-copyrighted-habbo-characters
plan: 02
subsystem: avatar-rendering
tags: [habbo-removal, cleanup, pixellab, character-legend]
dependency_graph:
  requires: [17.8-01]
  provides: [clean-avatar-system, character-legend-panel]
  affects: [src/RoomCanvas.tsx, src/avatarManager.ts, src/agentTypes.ts, src/avatarRendererTypes.ts]
tech_stack:
  added: [src/CharacterLegendPanel.tsx]
  patterns: [pixellab-only-renderer, clean-avatarspec]
key_files:
  created:
    - src/CharacterLegendPanel.tsx
  modified:
    - src/avatarRendererTypes.ts
    - src/agentTypes.ts
    - src/avatarManager.ts
    - src/isoAgentBehavior.ts
    - src/isoPathfinding.ts
    - src/pixelLabAvatarRenderer.ts
    - src/RoomCanvas.tsx
    - src/webview.tsx
    - src/extension.ts
    - scripts/download-habbo-assets.mjs
    - scripts/convert-cortex-to-nitro.mjs
    - esbuild.config.mjs
  deleted:
    - src/isoAvatarRenderer.ts
    - src/avatarOutfitConfig.ts
    - src/avatarBuilderPreview.ts
    - src/AvatarBuilderModal.tsx
    - src/AvatarDebugGrid.tsx
    - tests/isoAvatarRenderer.test.ts
    - tests/avatarOutfitConfig.test.ts
    - assets/habbo/figures/ (42 files)
decisions:
  - "TILE_STEP_DURATION_MS (350ms) inlined directly in avatarManager.ts — was only exported from isoAvatarRenderer.ts"
  - "CharacterLegendPanel uses colored rectangles not sprite icons — simpler and avoids atlas dependency"
  - "isBuilderOpen/builderAvatarId state removed entirely from RoomCanvas — no residual dead state"
metrics:
  duration: 13min
  completed_date: "2026-03-12T19:40:41Z"
  tasks: 2
  files: 22
---

# Phase 17.8 Plan 02: Remove Habbo Figure Code and Add Character Legend Summary

Deleted all Habbo figure/character source files and assets, cleaned AvatarSpec of Habbo-specific fields, replaced the dual-renderer architecture with PixelLab-only, and added a character legend panel showing team-to-character mapping.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Delete Habbo figure source files, test files, and assets | 586772b | 15 files deleted/modified |
| 2 | Clean up imports, types, references + add CharacterLegendPanel | b6b1279 | 12 files modified/created |

## What Was Built

### Deleted
- `src/isoAvatarRenderer.ts` — 11-layer Habbo avatar renderer with blink animations
- `src/avatarOutfitConfig.ts` — Figure catalog, 28 clothing items, 8 presets, color palettes
- `src/avatarBuilderPreview.ts` — Live preview canvas for avatar builder
- `src/AvatarBuilderModal.tsx` — Interactive avatar builder panel
- `src/AvatarDebugGrid.tsx` — Debug grid for Habbo renderer development
- `tests/isoAvatarRenderer.test.ts` — 26+ Habbo renderer tests
- `tests/avatarOutfitConfig.test.ts` — 30+ outfit config tests
- `assets/habbo/figures/` — 42 PNG+JSON figure asset files (21 pairs)

### Modified
- `src/avatarRendererTypes.ts`: Removed `outfit?`, `nextBlinkMs`, `blinkFrame`; added `team?: TeamSection`
- `src/agentTypes.ts`: Removed OutfitConfig import, `avatarOutfits` ExtensionMessage, `saveAvatar`/`loadAvatars` WebviewMessages
- `src/avatarManager.ts`: Removed OutfitConfig/savedOutfits; inlined TILE_STEP_DURATION_MS; sets `spec.team` directly
- `src/RoomCanvas.tsx`: Removed habboRenderer/builder panel/debugGrid; PixelLab is sole renderer; added CharacterLegendPanel
- `src/webview.tsx`: Removed nitroFiguresBase loading and `loadAvatars` postMessage
- `src/extension.ts`: Removed nitroFiguresBaseUri, saveAvatar/loadAvatars handlers, unused fs imports
- `scripts/download-habbo-assets.mjs`: Removed FIGURE_ITEMS array and figures download loop
- `scripts/convert-cortex-to-nitro.mjs`: Removed figure conversion section and convertFigure function
- `esbuild.config.mjs`: Removed figures asset copy step

### Created
- `src/CharacterLegendPanel.tsx`: Fixed React overlay at bottom-right (10px margin) with team legend: colored 10x10 rectangle + label per team (planning, core-dev, infrastructure, support)

## Verification Results

- `npx tsc --noEmit` — passes with zero src/ errors (pre-existing test file errors excluded)
- `npx vitest run` — 364 passing, 5 failing (all pre-existing failures in isoKanbanRenderer and messageBridge)
- No file in src/ imports from deleted modules
- `assets/habbo/figures/` directory does not exist
- CharacterLegendPanel rendered in RoomCanvas JSX

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TILE_STEP_DURATION_MS was only exported from deleted isoAvatarRenderer.ts**
- **Found during:** Task 2 (cleaning avatarManager.ts)
- **Issue:** avatarManager.ts imported `TILE_STEP_DURATION_MS` from `./isoAvatarRenderer.js` which was deleted
- **Fix:** Inlined the constant (350) directly in avatarManager.ts
- **Files modified:** src/avatarManager.ts
- **Commit:** b6b1279

**2. [Rule 2 - Missing] Tests referencing nextBlinkMs/blinkFrame fields**
- **Found during:** Task 2 (test cleanup)
- **Issue:** isoAgentBehavior.test.ts and isoPathfinding.test.ts had AvatarSpec fixtures with removed fields
- **Fix:** Removed nextBlinkMs and blinkFrame from test fixture objects
- **Files modified:** tests/isoAgentBehavior.test.ts, tests/isoPathfinding.test.ts
- **Commit:** b6b1279

**3. [Rule 1 - Bug] isoAgentBehavior.ts and isoPathfinding.ts imported AvatarSpec from deleted file**
- **Found during:** Task 2 TypeScript check
- **Issue:** Both files imported `type { AvatarSpec }` from `./isoAvatarRenderer.js`
- **Fix:** Updated imports to `./avatarRendererTypes.js`
- **Files modified:** src/isoAgentBehavior.ts, src/isoPathfinding.ts
- **Commit:** b6b1279

## Self-Check: PASSED

- src/CharacterLegendPanel.tsx: FOUND
- src/isoAvatarRenderer.ts: DELETED (confirmed)
- assets/habbo/figures/: DELETED (confirmed)
- commit 586772b: FOUND
- commit b6b1279: FOUND
