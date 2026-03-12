# T01: 17-bugfixes-and-wishlist 01

**Slice:** S10 — **Milestone:** M002

## Description

Constrain In Progress sticky notes to the left wall only, removing the cross-wall overflow to the right wall.

Purpose: Currently, when there are more In Progress cards than the left wall can hold, they overflow onto the right wall, visually breaking the spatial metaphor (left = active work, right = completed work). This fix confines all small In Progress notes to the left wall.

Output: Modified `drawKanbanNotes` function with single-wall constraint and updated tests.

## Must-Haves

- [ ] "In Progress sticky notes render only on the left wall, never overflowing to the right wall"
- [ ] "Right wall continues to show only the large Done aggregate note"
- [ ] "Left wall shows both large Backlog aggregate and small In Progress notes (non-overlapping tiles)"
- [ ] "All existing kanban renderer tests pass with updated expectations"

## Files

- `src/isoKanbanRenderer.ts`
- `tests/isoKanbanRenderer.test.ts`
