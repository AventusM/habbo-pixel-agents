# T03: 12-room-walls-kanban-notes 03

**Slice:** S04 — **Milestone:** M002

## Description

Render GitHub Projects kanban cards as wall-mounted sticky notes in the isometric room. Notes are drawn as screen-space overlays (like speech bubbles) after the depth-sorted render pass, positioned on the left and right wall surfaces.

Purpose: This is the visual payoff — cards from the GitHub Projects board appear as physical post-it notes on the office walls, making project status visible at a glance in the room.

Output: `src/isoKanbanRenderer.ts` with note rendering, updated `RoomCanvas.tsx` to receive kanban messages and render notes per frame, unit tests.

## Must-Haves

- [ ] "Kanban cards appear as colored sticky notes on room walls"
- [ ] "Notes are color-coded by status column (yellow=Todo, blue=In Progress, green=Done)"
- [ ] "Notes display truncated card titles in small pixel font"
- [ ] "Notes update automatically when new kanbanCards messages arrive"
- [ ] "Notes are drawn as overlays after depth sort (always visible on top of room geometry)"
- [ ] "Rooms without GitHub settings show no notes (graceful empty state)"

## Files

- `src/isoKanbanRenderer.ts`
- `src/RoomCanvas.tsx`
- `tests/isoKanbanRenderer.test.ts`
