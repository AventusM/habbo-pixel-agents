# S13: Fix Move Logic To Respect Selected Avatar

**Goal:** Wire the existing AvatarSelectionManager.
**Demo:** Wire the existing AvatarSelectionManager.

## Must-Haves


## Tasks

- [x] **T01: 17.3-fix-move-logic-to-respect-selected-avatar 01** `est:1min`
  - Wire the existing AvatarSelectionManager.selectAvatar() call into the left-click avatar handler so that right-click movement respects which avatar the user selected.

Purpose: Currently right-click always moves the nearest avatar because selectAvatar() is never called -- selectedAvatarId is always null. This makes multi-avatar rooms unusable since the user cannot control which avatar moves.

Output: Fixed RoomCanvas.tsx where left-clicking an avatar sets it as selected, and right-click movement prefers that selected avatar.

## Files Likely Touched

- `src/RoomCanvas.tsx`
