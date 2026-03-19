---
applyTo: "src/iso*Renderer*,src/RoomCanvas.tsx,src/isometricMath.ts,src/isoSpriteCache.ts,src/pixelLabAvatarRenderer.ts,src/roomLayoutEngine.ts"
---

# Rendering Instructions

## Isometric Math

All rendering uses 2:1 diamond projection (64x32px tiles):

```
screenX = (tileX - tileY) * 32
screenY = (tileX + tileY) * 16 - tileZ * 16
```

Constants: `TILE_W=64`, `TILE_H=32`, `TILE_W_HALF=32`, `TILE_H_HALF=16`

## Depth Sorting

Painter's algorithm with sort key: `tileX + tileY + tileZ * 0.001`

Items with higher sort keys are drawn later (on top). The `tileZ * 0.001` term ensures height affects sorting minimally within the same tile plane.

## Direction System

Habbo directions (clockwise from NE): 0=NE, 1=E, 2=SE, 3=S, 4=SW, 5=W, 6=NW, 7=N

`getBaseDirection()` maps to sprite directions:
- 0 → 0 (use dir 0 sprites)
- 2 → 2 (use dir 2 sprites)
- 4 → 2 (use dir 2 sprites, flip horizontally)
- 6 → 0 (use dir 0 sprites, flip horizontally)

Items MUST be placed with supported directions or they render NOTHING silently.

## Sprite Positioning

### Furniture
```
dx = screenX + offsetX
dy = screenY + TILE_H_HALF + offsetY
```
Registration point: tile center = top vertex + 16px down.

### Figures (Avatars)
```
dx = regX - offsetX
dy = regY - offsetY
```
Both subtract! Using `regX + offsetX` breaks part alignment.

TILE_W_HALF correction after flip: `drawX += flip ? TILE_W_HALF : -TILE_W_HALF`

### Flip Logic
`shouldFlip = shouldMirrorSprite(direction) XOR frame.flipH`

## Common Pitfalls

1. **Direction mismatch**: If furniture only has dir 0 sprites, only dirs 0 and 6 work (6 uses 0 + flip)
2. **Offset sign errors**: Furniture adds offsets, figures subtract them — mixing these up breaks alignment
3. **Multi-tile furniture**: Depth sort must account for all occupied tiles, not just the anchor tile
4. **FlipH XOR**: Both `shouldMirrorSprite` AND `frame.flipH` affect the final flip — they XOR, not AND

## Testing

Rendering changes should have corresponding test coverage in `tests/`. Run `npx vitest run` after any changes.
