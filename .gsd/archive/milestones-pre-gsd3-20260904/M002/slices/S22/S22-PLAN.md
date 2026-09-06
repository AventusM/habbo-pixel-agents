# S22: Section Desk & Chair Furniture

**Goal:** Each team section has 2 desk+chair furniture combos; agents walk to chairs and sit when active.
**Demo:** Agents assigned to any section walk to a chair at a desk and sit down using the existing chair-sitting system from S02/S03.

## Must-Haves

- Each of the 4 sections places exactly 2 desk+chair combos (8 desks, 8 chairs total)
- Chairs are adjacent to desks, facing the desk
- `deskTiles` coordinates align with the chair positions so `getDeskTile()` sends agents to chairs
- Existing chair-sitting system (`isChairType`, `sitAvatar`) works with the placed chairs
- No regressions in room layout tests

## Verification

- `npx vitest run tests/roomLayoutEngine.test.ts` — all existing + new tests pass
- Each section's `furniture` array contains exactly 2 desk items and 2 chair items (plus existing lamp/teleport)
- Each section's `deskTiles` positions match the chair furniture positions
- Chair furniture IDs are recognized by `isChairType()`

## Tasks

- [ ] **T01: Place desk+chair combos in getSectionFurniture** `est:30m`
  - Why: Sections currently only get a lamp — agents work at invisible desks
  - Files: `src/roomLayoutEngine.ts`, `tests/roomLayoutEngine.test.ts`
  - Do: Modify `getSectionFurniture()` to place 2 `hc_dsk` + 2 `hc_chr` items per section. Position chairs adjacent to desks (one tile offset toward the section interior), direction facing the desk. Update `generateDeskTiles()` so the returned desk tile positions match the chair positions — this is what `getDeskTile()` uses to route agents. Ensure chairs use a direction recognized by the avatar sit system.
  - Verify: `npx vitest run tests/roomLayoutEngine.test.ts`
  - Done when: All 4 sections have 2 desks + 2 chairs in their furniture arrays, deskTiles match chair positions, all tests pass

## Files Likely Touched

- `src/roomLayoutEngine.ts`
- `tests/roomLayoutEngine.test.ts`
