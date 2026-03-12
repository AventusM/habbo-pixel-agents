# S10: Bugfixes And Wishlist

**Goal:** Constrain In Progress sticky notes to the left wall only, removing the cross-wall overflow to the right wall.
**Demo:** Constrain In Progress sticky notes to the left wall only, removing the cross-wall overflow to the right wall.

## Must-Haves


## Tasks

- [x] **T01: 17-bugfixes-and-wishlist 01**
  - Constrain In Progress sticky notes to the left wall only, removing the cross-wall overflow to the right wall.

Purpose: Currently, when there are more In Progress cards than the left wall can hold, they overflow onto the right wall, visually breaking the spatial metaphor (left = active work, right = completed work). This fix confines all small In Progress notes to the left wall.

Output: Modified `drawKanbanNotes` function with single-wall constraint and updated tests.
- [x] **T02: 17-bugfixes-and-wishlist 02** `est:2min`
  - Fix stray pixel particle appearing when avatars face sideways directions, and ensure face features (eyes, mouth) are visually correct at all rendered angles.

Purpose: After Phase 14.1 added face rendering, a small pixel/particle appears approximately one tile away from the avatar at diagonal directions (1, 3, 5). Additionally, face detail at side angles may be insufficient or mispositioned. These bugs make face rendering visually distracting rather than enhancing avatar appearance.

Output: Modified face rendering logic in `isoAvatarRenderer.ts` that eliminates stray pixels and correctly positions face sprites at all directions, with matching fixes in `avatarBuilderPreview.ts`.
- [x] **T03: 17-bugfixes-and-wishlist 03** `est:2min`
  - Convert the avatar builder from a full-screen blocking modal to a non-blocking inline panel rendered below the layout editor.

Purpose: The current AvatarBuilderModal opens as a `position: fixed` overlay (z-index 1000) that blocks all canvas interaction. Users want to keep using the room (clicking to move avatars, sitting in chairs) while the editor is open. The inline panel should feel like a natural extension of the existing layout editor toolbar.

Output: Refactored `AvatarBuilderPanel` component rendered inline in the left panel area, with the click handler updated to allow simultaneous canvas interaction.

## Files Likely Touched

- `src/isoKanbanRenderer.ts`
- `tests/isoKanbanRenderer.test.ts`
- `src/isoAvatarRenderer.ts`
- `src/avatarBuilderPreview.ts`
- `tests/isoAvatarRenderer.test.ts`
- `src/AvatarBuilderModal.tsx`
- `src/RoomCanvas.tsx`
- `src/avatarBuilderPreview.ts`
