# T02: 04-furniture-rendering 02

**Slice:** S04 — **Milestone:** M001

## Description

Implement multi-tile furniture rendering with correct depth sorting so desks and other large furniture render correctly relative to avatars and tiles.

Purpose: Fix the multi-tile occlusion bug where avatars standing behind furniture edges incorrectly appear in front. Use max-coordinate sort key pattern from research to ensure correct depth ordering.

Output: Working desk rendering with validated depth sorting — avatars on adjacent tiles appear correctly in front of or behind the desk.

## Must-Haves

- [ ] "Desk (2×1 or 2×2 furniture) renders without occluding avatars incorrectly"
- [ ] "Multi-tile furniture uses max(tileX + tileY) sort key across full footprint"
- [ ] "Avatar standing behind desk's far edge appears correctly in front of desk"

## Files

- `src/isoFurnitureRenderer.ts`
- `tests/isoFurnitureRenderer.test.ts`
