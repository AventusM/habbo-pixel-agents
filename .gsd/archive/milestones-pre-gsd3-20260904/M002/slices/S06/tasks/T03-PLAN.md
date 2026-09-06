# T03: 14-avatar-builder-ui 03

**Slice:** S06 — **Milestone:** M002

## Description

Build the avatar builder modal UI and wire it into the room canvas. Users can click an avatar, customize clothing/colors with live preview, save outfits, and manage wardrobe presets.

Purpose: This is the user-facing feature — the modal overlay that lets users customize agent appearances using the data and rendering infrastructure from Plans 01 and 02.
Output: AvatarBuilderModal.tsx, avatarBuilderPreview.ts, modified RoomCanvas.tsx with click-to-open and outfit save flow.

## Must-Haves

- [ ] "Clicking an avatar in view mode opens the builder modal"
- [ ] "Builder modal shows live preview of avatar as parts/colors change"
- [ ] "User can switch between body, hair, tops, bottoms, shoes, accessories categories"
- [ ] "Gender toggle filters available clothing options"
- [ ] "Color palette swatches change per-part colors instantly"
- [ ] "Save button applies outfit to room avatar and persists via extension host"
- [ ] "Modal closes and room avatar reflects the new outfit"
- [ ] "Wardrobe preset slots allow saving/loading multiple outfits per agent"

## Files

- `src/AvatarBuilderModal.tsx`
- `src/avatarBuilderPreview.ts`
- `src/RoomCanvas.tsx`
- `src/webview.tsx`
