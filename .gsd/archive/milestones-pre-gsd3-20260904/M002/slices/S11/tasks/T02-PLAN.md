# T02: 17.1-stray-pixel-diagnostic-fix-and-right-click-movement 02

**Slice:** S11 — **Milestone:** M002

## Description

Change the interaction model so left-click selects avatars and right-click moves them.

Purpose: Users want to left-click avatars to open the builder panel and right-click to move avatars. Currently left-click does both (select then move), which is confusing. Separating click types makes both actions single-click and non-conflicting.

Output: Modified `RoomCanvas.tsx` with right-click movement via `onContextMenu` handler.

## Must-Haves

- [ ] "Left-click on avatar opens the builder panel (unchanged)"
- [ ] "Left-click on empty tile does NOT move any avatar"
- [ ] "Right-click on any walkable tile moves the nearest idle avatar to that tile"
- [ ] "Right-click on a chair tile moves nearest avatar to sit in the chair"
- [ ] "Browser context menu is suppressed on canvas right-click"
- [ ] "Editor modes (paint, color, furniture) still work with left-click only"

## Files

- `src/RoomCanvas.tsx`
