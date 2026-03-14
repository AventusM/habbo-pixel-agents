---
id: S22
parent: M002
milestone: M002
provides:
  - 2 desk+chair furniture combos per team section (8 desks, 8 chairs total)
  - Agents routed to chair positions via deskTiles
requires:
  - slice: S21
    provides: Larger room templates with multi-row desk placement
affects: []
key_files:
  - src/roomLayoutEngine.ts
  - tests/roomLayoutEngine.test.ts
key_decisions:
  - Chairs at deskTile positions; desks diagonally NE at (chairX-1, chairY-1) direction 0
  - Chair direction 6 (NW) faces agent toward desk
  - hc_dsk only has direction 0 atlas frames — no other directions available
  - Limited to exactly 2 combos per section
  - Idle tiles exclude both chair and desk positions to prevent wander overlap
patterns_established:
  - Furniture combos (desk+chair pairs) generated from deskTile positions in getSectionFurniture
observability_surfaces:
  - none
drill_down_paths: []
duration: 20m
verification_result: passed
completed_at: 2026-03-14
---

# S22: Section Desk & Chair Furniture

**Each team section now has 2 desk+chair furniture combos; agents walk to chair positions when active.**

## What Happened

Modified `generateDeskTiles` to produce exactly 2 chair positions per section near the section center. Updated `getSectionFurniture` to place `hc_dsk` (desk) diagonally NE of each chair at `(chairX-1, chairY-1)` with direction 0, and `hc_chr` (chair) at the deskTile position with direction 6 (NW, facing the desk). Lamp repositioned near the section wall. Updated `generateIdleTiles` to exclude both chair and desk furniture tiles from the wander set. Added 4 new tests covering furniture counts, position alignment, walkability, and idle tile exclusion. Multiple iterations to get the visual alignment right — hc_dsk only supports direction 0 sprites.

## Verification

All 373 tests pass (25 test files). 4 new tests verify: furniture counts (2 desks + 2 chairs per section), chair-desk position alignment, all furniture on walkable tiles, no idle tile overlap with furniture.

## Deviations

None.

## Known Limitations

- Agents don't auto-sit when arriving at a chair via the `agentStatus=active` flow — only right-click manual sitting triggers `sitAvatar`. Auto-sit on arrival could be a follow-up.
- Desk+chair layout is uniform across all sections (same positions relative to section origin).

## Follow-ups

- Auto-sit: when an agent walks to a deskTile that has a chair, automatically sit them on arrival instead of requiring right-click.

## Files Created/Modified

- `src/roomLayoutEngine.ts` — generateDeskTiles (2 chairs per section), getSectionFurniture (desk+chair combos), generateIdleTiles (exclude desk tiles)
- `tests/roomLayoutEngine.test.ts` — 4 new tests for desk+chair furniture
- `CLAUDE.md` — added Terminal Output Safety section

## Forward Intelligence

### What the next slice should know
- Each section now has real furniture at deskTile positions. The `hc_chr` at deskTile coordinates means `isChairType()` will return true for those tiles.

### What's fragile
- The desk position is at `(chairX-1, chairY-1)`. If chairs are placed at the section edge, desks could go out of bounds.

### Authoritative diagnostics
- `tests/roomLayoutEngine.test.ts` — covers all furniture placement assertions across all 3 template sizes.

### What assumptions changed
- deskTiles direction changed from 2 (SE) to 6 (NW) — any code using deskTile.dir for non-sit purposes may see different facing.
