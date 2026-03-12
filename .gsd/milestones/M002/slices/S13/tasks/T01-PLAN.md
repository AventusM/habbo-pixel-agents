# T01: 17.3-fix-move-logic-to-respect-selected-avatar 01

**Slice:** S13 — **Milestone:** M002

## Description

Wire the existing AvatarSelectionManager.selectAvatar() call into the left-click avatar handler so that right-click movement respects which avatar the user selected.

Purpose: Currently right-click always moves the nearest avatar because selectAvatar() is never called -- selectedAvatarId is always null. This makes multi-avatar rooms unusable since the user cannot control which avatar moves.

Output: Fixed RoomCanvas.tsx where left-clicking an avatar sets it as selected, and right-click movement prefers that selected avatar.

## Must-Haves

- [ ] "Left-clicking an avatar selects it (yellow highlight appears)"
- [ ] "Right-clicking a tile moves the selected avatar, not the nearest one"
- [ ] "Left-clicking empty space deselects the current avatar"
- [ ] "Selected avatar despawn clears the selection (already works)"

## Files

- `src/RoomCanvas.tsx`
