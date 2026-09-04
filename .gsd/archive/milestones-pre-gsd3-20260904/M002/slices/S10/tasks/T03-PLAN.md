# T03: 17-bugfixes-and-wishlist 03

**Slice:** S10 — **Milestone:** M002

## Description

Convert the avatar builder from a full-screen blocking modal to a non-blocking inline panel rendered below the layout editor.

Purpose: The current AvatarBuilderModal opens as a `position: fixed` overlay (z-index 1000) that blocks all canvas interaction. Users want to keep using the room (clicking to move avatars, sitting in chairs) while the editor is open. The inline panel should feel like a natural extension of the existing layout editor toolbar.

Output: Refactored `AvatarBuilderPanel` component rendered inline in the left panel area, with the click handler updated to allow simultaneous canvas interaction.

## Must-Haves

- [ ] "Avatar editor renders as an inline panel below the LayoutEditorPanel, not as a full-screen modal overlay"
- [ ] "Clicking an avatar opens the inline editor panel without blocking click-to-move on the canvas"
- [ ] "The inline panel includes all existing functionality: preview, clothing selection, color palettes, gender toggle, wardrobe, save/cancel"
- [ ] "Clicking the canvas while the editor is open still allows avatar movement and chair interactions"
- [ ] "Saving or cancelling the editor closes the inline panel"

## Files

- `src/AvatarBuilderModal.tsx`
- `src/RoomCanvas.tsx`
- `src/avatarBuilderPreview.ts`
