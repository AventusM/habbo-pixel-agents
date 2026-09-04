# S06: Avatar Builder Ui

**Goal:** Define the outfit configuration type system, curated clothing catalog, color palettes, and default presets that form the data foundation for the avatar builder.
**Demo:** Define the outfit configuration type system, curated clothing catalog, color palettes, and default presets that form the data foundation for the avatar builder.

## Must-Haves


## Tasks

- [x] **T01: 14-avatar-builder-ui 01** `est:8min`
  - Define the outfit configuration type system, curated clothing catalog, color palettes, and default presets that form the data foundation for the avatar builder.

Purpose: All subsequent plans (renderer integration, builder UI) depend on these types and data structures. Establishing them first prevents the "scavenger hunt" anti-pattern.
Output: avatarOutfitConfig.ts with types, catalog, palettes, and presets; updated download script with new figure assets; unit tests.
- [x] **T02: 14-avatar-builder-ui 02** `est:3min`
  - Wire the dynamic outfit configuration into the avatar renderer and persistence layer so each agent can have a unique appearance that survives extension reload.

Purpose: Replaces the hardcoded 6-variant system with per-agent OutfitConfig, enabling the builder UI (Plan 03) to actually change how avatars look.
Output: Modified renderer, avatarManager, extension host persistence, message types.
- [x] **T03: 14-avatar-builder-ui 03** `est:3min`
  - Build the avatar builder modal UI and wire it into the room canvas. Users can click an avatar, customize clothing/colors with live preview, save outfits, and manage wardrobe presets.

Purpose: This is the user-facing feature — the modal overlay that lets users customize agent appearances using the data and rendering infrastructure from Plans 01 and 02.
Output: AvatarBuilderModal.tsx, avatarBuilderPreview.ts, modified RoomCanvas.tsx with click-to-open and outfit save flow.

## Files Likely Touched

- `src/avatarOutfitConfig.ts`
- `scripts/download-habbo-assets.mjs`
- `tests/avatarOutfitConfig.test.ts`
- `src/isoAvatarRenderer.ts`
- `src/avatarManager.ts`
- `src/agentTypes.ts`
- `src/extension.ts`
- `src/webview.tsx`
- `tests/isoAvatarRenderer.test.ts`
- `src/AvatarBuilderModal.tsx`
- `src/avatarBuilderPreview.ts`
- `src/RoomCanvas.tsx`
- `src/webview.tsx`
