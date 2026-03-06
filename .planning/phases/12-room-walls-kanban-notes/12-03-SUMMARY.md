---
phase: 12-room-walls-kanban-notes
plan: "03"
subsystem: rendering
tags: [kanban, sticky-notes, wall-overlay, canvas, github-projects]
dependency_graph:
  requires:
    - src/isoKanbanRenderer.ts (new)
    - src/agentTypes.ts (KanbanCard, ExtensionMessage)
    - src/isometricMath.ts (tileToScreen, TILE_W_HALF, TILE_H_HALF)
    - src/isoTileRenderer.ts (WALL_HEIGHT)
    - src/isoTypes.ts (TileGrid)
  provides:
    - src/isoKanbanRenderer.ts (drawKanbanNotes, statusToColor)
  affects:
    - src/RoomCanvas.tsx (kanbanCardsRef, kanbanCards message handler, rAF draw call)
tech_stack:
  added: []
  patterns:
    - "Screen-space overlay drawn after depth sort (no camera translate needed)"
    - "useRef for kanban cards — rAF loop reads current value each frame"
    - "Capacity-based note distribution: left wall first, then right wall"
decisions:
  - "statusToColor falls back to grey (#e5e7eb) for any unknown status string"
  - "Notes drawn as topmost overlay in rAF loop, after name tags and speech bubbles"
  - "Slot 0 at 30% wall height, slot 1 at 60% wall height per tile row/column"
  - "drawKanbanNotes is a no-op when cards.length === 0 (graceful empty state)"
key_files:
  created:
    - src/isoKanbanRenderer.ts
    - tests/isoKanbanRenderer.test.ts
  modified:
    - src/RoomCanvas.tsx
metrics:
  duration: 2min
  completed: "2026-03-05"
  tasks: 2
  files: 3
---

# Phase 12 Plan 03: Kanban Sticky Notes Renderer Summary

Sticky note rendering for GitHub Projects kanban cards on isometric room walls using screen-space overlay after depth sort.

## What Was Built

- `src/isoKanbanRenderer.ts`: `statusToColor()` maps GitHub Projects status columns to colors (yellow/blue/green/grey); `leftWallNotePosition()` / `rightWallNotePosition()` compute screen-space positions for note slots on each wall edge; `drawStickyNote()` draws a 48x36 rounded-rect with truncated title text; `drawKanbanNotes()` distributes cards across left wall (column 0 tiles) then right wall (row 0 tiles) at 2 slots per tile row/column
- `src/RoomCanvas.tsx`: Added `kanbanCardsRef`, `kanbanCards` message handler, and `drawKanbanNotes` call at end of rAF loop after speech bubbles

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create isoKanbanRenderer.ts with sticky note drawing and wall position math | 8d82fc9 | src/isoKanbanRenderer.ts, tests/isoKanbanRenderer.test.ts |
| 2 | Integrate kanban messages and note rendering into RoomCanvas | 9dc1b36 | src/RoomCanvas.tsx |

## Decisions Made

- **statusToColor fallback to grey:** Unknown status column names (e.g. Backlog, Review) get `#e5e7eb` neutral grey — consistent with 'No Status' default. Avoids visible errors for custom column names.
- **Notes as topmost overlay:** `drawKanbanNotes` is called last in the rAF loop, after selection highlights, name tags, and speech bubbles. Notes are always visible on top of room geometry.
- **Slot positions at 30% / 60% wall height:** Two vertical positions per tile give visual variety and avoid notes overlapping at the baseline.
- **No-op on empty cards:** Early return when `cards.length === 0` — rooms without GitHub settings show no notes and incur zero draw cost.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written. Minor clarification: plan spec said "shift down ~40px for second note" but the implementation uses `WALL_HEIGHT * 0.3` and `WALL_HEIGHT * 0.6` (30% and 60%) which provides equivalent ~38-40px separation between slots.

## Verification

- `npx vitest run tests/isoKanbanRenderer.test.ts` — 11 tests pass
- `npx vitest run` — 279 tests across 19 test files, all passing
- `npm run typecheck` — no TypeScript errors
- Visual verification: requires manual webview check (Task 3 checkpoint)

## Self-Check: PASSED

All files and commits verified:
- FOUND: src/isoKanbanRenderer.ts
- FOUND: tests/isoKanbanRenderer.test.ts
- FOUND: commit 8d82fc9 (Task 1)
- FOUND: commit 9dc1b36 (Task 2)
