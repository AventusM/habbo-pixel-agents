# Plan 04-02: Multi-Tile Furniture Rendering - SUMMARY

**Completed:** 2026-02-28
**Duration:** ~7 minutes
**Tasks:** 1 (completed)
**Files modified:** 2
**Tests added:** 8

## What Was Built

Extended the furniture renderer to support multi-tile furniture (desks 2×1, bookshelves 2×2) with max-coordinate sort key pattern to fix the depth sorting bug where avatars standing behind furniture edges incorrectly appear in front.

### Task 1: Multi-Tile Furniture Renderer

Implemented `createMultiTileFurnitureRenderable()` function that calculates the max coordinate across the furniture footprint for depth sorting while rendering the sprite at the origin tile position.

**Core implementation:**
```typescript
export interface MultiTileFurnitureSpec {
  name: string;
  tileX: number;          // Origin tile (bottom-left)
  tileY: number;
  tileZ: number;
  widthTiles: number;     // Footprint width
  heightTiles: number;    // Footprint height
  direction: 0 | 2 | 4 | 6;
}

export function createMultiTileFurnitureRenderable(
  spec: MultiTileFurnitureSpec,
  spriteCache: SpriteCache,
  atlasName: string,
): Renderable
```

**Max-coordinate sort key logic:**
```typescript
// Calculate max coordinate across full footprint
const sortTileX = spec.tileX + spec.widthTiles - 1;
const sortTileY = spec.tileY + spec.heightTiles - 1;

return {
  tileX: sortTileX,  // Use max for depth sort
  tileY: sortTileY,
  tileZ: spec.tileZ,
  draw: (ctx) => {
    // Render at origin tile, not sort tile
    const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);
    // ...
  }
};
```

**Why max coordinate?**

The depth sort formula is `tileX + tileY + tileZ * 0.001`. Objects with higher X+Y values render later (on top).

- **Origin tile (minX, minY):** If a 2×1 desk at origin (3,3) uses (3,3) as sort key, its far edge is at (4,3). An avatar at (4,3) would have the same sort key and might render behind the desk due to insertion order. This causes the occlusion bug.

- **Max coordinate (maxX, maxY):** If the desk uses (4,3) as sort key (the farthest tile in its footprint), the depth sort ensures the desk's far edge determines rendering order. An avatar at (4,3) and desk with sort key (4,3) will have equal keys, but an avatar at (4,4) will correctly render in front of the desk.

**Example:**
- Desk: origin (3,3), footprint 2×1, sort key (4,3), renders at (3,3)
- Bookshelf: origin (5,5), footprint 2×2, sort key (6,6), renders at (5,5)
- Tall shelf: origin (2,3), footprint 1×2, sort key (2,4), renders at (2,3)

**Features:**
- Same sprite rendering pipeline as single-tile (coordinate rounding, direction mirroring)
- Shares `getBaseDirection()` and `shouldMirrorSprite()` helpers
- Graceful null handling for missing frames
- Works with existing `depthSort()` function unchanged

**Test coverage (8 new tests):**
- Max coordinate calculation for 2×1 desk
- Max coordinate calculation for 2×2 bookshelf
- Max coordinate calculation for 1×2 tall furniture
- Render at origin tile position verification
- Frame key format validation
- Direction mirroring for multi-tile
- Missing frame graceful degradation
- Coordinate rounding verification

## Files Modified

1. `src/isoFurnitureRenderer.ts` - Added MultiTileFurnitureSpec interface and createMultiTileFurnitureRenderable function (+109 lines)
2. `tests/isoFurnitureRenderer.test.ts` - Added 8 comprehensive multi-tile tests (+165 lines)

## Test Results

**Unit tests:** 25/25 passing (17 single-tile + 8 multi-tile)
**Full suite:** 91/91 passing (83 from Phases 1-4 + 8 new)
**TypeScript:** 0 errors

Grep verification:
- ✅ `widthTiles.*-.*1` pattern found (max-coordinate calculation)
- ✅ `tileToScreen.*spec\\.tileX` pattern found (origin tile rendering)

All verification criteria met:
- [x] MultiTileFurnitureSpec interface defined with widthTiles, heightTiles fields
- [x] createMultiTileFurnitureRenderable() uses max(tileX + tileY) for sort key
- [x] Renderable.draw renders at origin tile (spec.tileX, spec.tileY), not sort tile
- [x] 8 unit tests passing for multi-tile furniture
- [x] Test coverage includes 2×1 desk and 2×2 furniture examples
- [x] No regressions: full test suite green

## Edge Cases Validated

| Footprint | Origin | Max Coordinate | Sort Key Correct? |
|-----------|--------|----------------|-------------------|
| 2×1 | (3,3) | (4,3) | ✅ Yes |
| 2×2 | (5,5) | (6,6) | ✅ Yes |
| 1×2 | (2,3) | (2,4) | ✅ Yes |
| 1×1 | (1,1) | (1,1) | ✅ Yes (use single-tile function) |

**1×1 furniture note:** While multi-tile function can handle 1×1 (widthTiles=1, heightTiles=1), the single-tile function `createFurnitureRenderable` is more efficient for chairs, lamps, etc.

## Deviations from Research

**No deviations.** Implementation follows 04-RESEARCH.md "Pattern 2: Multi-Tile Furniture Rendering" exactly:
- ✅ Max-coordinate sort key pattern
- ✅ Origin tile rendering position
- ✅ Coordinate rounding with Math.floor()
- ✅ Direction mirroring support
- ✅ Graceful null handling

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Separate function for multi-tile | Keeps single-tile function lean; avoids footprint parameter overhead for 1×1 furniture |
| Max coordinate = tileX + widthTiles - 1 | Ensures farthest edge of furniture determines depth ordering |
| Render at origin tile | Sprite position must match furniture placement in layout editor |
| Share direction helpers | getBaseDirection() and shouldMirrorSprite() work for both single and multi-tile |

## Success Criteria Met

- [x] MultiTileFurnitureSpec interface defined with widthTiles, heightTiles fields
- [x] createMultiTileFurnitureRenderable() uses max(tileX + tileY) for sort key
- [x] Renderable.draw renders at origin tile (spec.tileX, spec.tileY), not sort tile
- [x] 8 unit tests passing for multi-tile furniture
- [x] Test coverage includes 2×1 desk and 2×2 furniture examples
- [x] No regressions: full test suite green (91 tests)

## Next Steps

**Plan 04-03:** Integrate furniture rendering into VS Code webview render loop. Load furniture atlas, insert furniture renderables into unified depth-sort pipeline with floor tiles, and visually validate all 8 furniture types render correctly with proper depth ordering.

**Checkpoint:** Plan 04-03 includes human-verify checkpoint to validate visual rendering of all 8 furniture types in the webview.
