# S22: Section Desk & Chair Furniture — UAT

**Milestone:** M002
**Written:** 2026-03-14

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: All changes are in layout generation logic covered by unit tests; no runtime/UI behavior changed.

## Preconditions

- Node.js and project dependencies installed (`npm install`)
- Tests runnable via `npx vitest run`

## Smoke Test

Run `npx vitest run tests/roomLayoutEngine.test.ts` — all 24 tests pass including the 4 new desk+chair tests.

## Test Cases

### 1. Each section has exactly 2 desk+chair combos

1. Generate floor templates for all three sizes (small, medium, large)
2. For each section, count furniture items named `hc_dsk` and `hc_chr`
3. **Expected:** Every section has exactly 2 `hc_dsk` and 2 `hc_chr` items

### 2. Chair positions match deskTile coordinates

1. For each section, compare `hc_chr` furniture positions to `deskTiles` array
2. **Expected:** `chairs[i].tileX === deskTiles[i].x` and `chairs[i].tileY === deskTiles[i].y` for i=0,1

### 3. Desks placed one tile above chairs

1. For each section, compare `hc_dsk` positions to `deskTiles` array
2. **Expected:** `desks[i].tileX === deskTiles[i].x` and `desks[i].tileY === deskTiles[i].y - 1`

### 4. All furniture on walkable tiles

1. Generate heightmap for each template size
2. Check that every `hc_dsk` and `hc_chr` tile is `'0'` (walkable) in the heightmap
3. **Expected:** No furniture lands on void (`'x'`) tiles

### 5. Idle tiles don't overlap furniture

1. Collect all `hc_dsk` and `hc_chr` tile coordinates into a set
2. Check that no idle tile in any section matches a furniture coordinate
3. **Expected:** Zero overlap between idle tiles and furniture positions

### 6. No test regressions

1. Run full test suite: `npx vitest run`
2. **Expected:** All 373 tests pass across 25 test files

## Edge Cases

### Small template (usable=7)

1. Generate small template, check desk positions stay within section bounds
2. Desk at `y-1` must be ≥ section origin y (inset ensures this)
3. **Expected:** All furniture within `[origin, origin+usable)` range

### Teleport booth count unchanged

1. Count `ads_cltele` furniture across all sections
2. **Expected:** Exactly 1 teleport booth (in planning section only)

## Failure Signals

- Any roomLayoutEngine test failure
- Desk or chair furniture on void tile ('x') in heightmap
- Idle tiles overlapping furniture positions
- More or fewer than 2 desks/chairs per section

## Requirements Proved By This UAT

- FURN-01 — Chair furniture placed with correct direction at tile coordinates
- FURN-04 — Furniture direction applied via direction field in FurnitureSpec

## Not Proven By This UAT

- Visual rendering of desk+chair combos in the webview (requires live runtime)
- Auto-sit behavior when agents arrive at chair tiles (not implemented yet)
- Chair sitting animation and layer splitting (covered by S02/S03)

## Notes for Tester

The chairs use `hc_chr` (HC Chair) which is in the `CHAIR_IDS` set in `furnitureRegistry.ts`, so `isChairType()` will return true. This means right-clicking a chair tile should trigger the sit flow. Auto-sit on agent arrival is not wired yet.
