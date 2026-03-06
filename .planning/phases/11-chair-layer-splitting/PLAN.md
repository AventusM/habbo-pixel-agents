# Phase 10c: Chair Layer Splitting for Sitting Avatars

## Context

When an avatar sits on a chair (Phase 10b), the entire avatar renders in front of the chair due to the +0.6 depth bias. The chair backrest should render in front of the avatar (the avatar sits "inside" the chair). This requires splitting chair furniture into two depth-sorted renderables: seat layers (behind avatar) and backrest layers (in front of avatar).

The asset data already supports this — `hc_chr.json` has `layerCount: 2` with layer 'b' (backrest) having explicit z-values per direction (z=100 for dirs 0,6; z=-100 for dirs 2,4). No asset changes needed.

## Approach

Split chair furniture into two renderables at different depth values so that the avatar sorts between them. The existing multi-tile slicing system (`sliceMultiTileRenderable`) provides a pattern: one furniture item becomes multiple renderables with different `tileX/tileY` for depth sorting.

**Key insight:** For a chair at tile (X,Y), depth = X+Y. Currently:
- Chair renders at depth X+Y (all layers together)
- Avatar renders at depth X+Y+0.6

After splitting:
- Chair seat (layer 'a') renders at depth X+Y (behind avatar at X+Y+0.6)
- Chair backrest (layer 'b') renders at depth X+Y+0.8 (in front of avatar at X+Y+0.6)

This is direction-dependent: the z-value in the visualization metadata tells us which layers go in front vs behind.

---

## Tasks

### 1. Modify `createNitroFurnitureRenderable` to return multiple renderables for chairs

**File:** `src/isoFurnitureRenderer.ts`

Currently `createNitroFurnitureRenderable()` returns a single `Renderable` that draws all layers. Change it to:

- Check if the furniture is a chair type (using `isChairType()` from furnitureRegistry)
- If chair: return an **array** of renderables, one per layer group:
  - **Back layers** (negative or zero z): rendered at normal tile depth
  - **Front layers** (positive z): rendered at tile depth + 0.8 (after avatar's +0.6)
- If not a chair: return single renderable as before (no behavior change)

The direction-dependent z-values from `getLayerZValues()` already exist. For `hc_chr`:
- Direction 0: layer 'b' has z=100 (positive → front)
- Direction 2: layer 'b' has z=-100 (negative → back)

This means the backrest correctly swaps front/back based on viewing angle.

**Implementation:**

```typescript
function createNitroChairRenderables(
  spec: FurnitureSpec,
  spriteCache: SpriteCache,
  nitroAssetName: string,
): Renderable[] {
  // Same layer resolution as createNitroFurnitureRenderable
  // but partition layers into back (z <= 0) and front (z > 0) groups
  // Return two renderables:
  //   back: tileX = spec.tileX, tileY = spec.tileY (normal depth)
  //   front: tileX = spec.tileX + 0.8, tileY = spec.tileY (after avatar)
}
```

### 2. Update `createFurnitureRenderables` to handle array returns

**File:** `src/isoTileRenderer.ts`

In `createFurnitureRenderables()`, when processing single-tile furniture:
- If the item is a chair type, call `createNitroChairRenderables()` which returns `Renderable[]`
- Spread/push all returned renderables into the output array
- Non-chair furniture: unchanged single renderable

### 3. Handle single-layer chairs gracefully

**File:** `src/isoFurnitureRenderer.ts`

Some chairs like `greek_c19_chair` have `layerCount: 1`. For these:
- All layers have z=0 (no front/back distinction)
- Fall back to single renderable (no splitting needed)
- Only split when there are layers with z > 0

### 4. Handle sofas (multi-tile chairs)

**File:** `src/isoFurnitureRenderer.ts`

`exe_sofa` and `club_sofa` are multi-tile chair types. The multi-tile slicing system already handles depth per row. For these:
- The existing `sliceMultiTileRenderable` handles depth partitioning
- Layer splitting should apply within each slice's draw call
- Or: skip layer splitting for multi-tile chairs initially (acceptable clipping for v1)

---

## Files Modified

| File | Changes |
|------|---------|
| `src/isoFurnitureRenderer.ts` | `createNitroChairRenderables()`, layer z-partitioning logic |
| `src/isoTileRenderer.ts` | Handle array returns from chair renderable creation |

## Verification

1. **Sitting on hc_chr**: Avatar body visible, chair backrest renders in front of avatar torso
2. **Direction 0 (facing NE)**: Backrest visible in front
3. **Direction 2 (facing SE)**: Backrest renders behind (z=-100), avatar in front — correct
4. **Direction 4/6**: Mirrors of 2/0 — flip logic handles correctly
5. **Non-chair furniture**: No visual change, single renderable as before
6. **Single-layer chairs**: Graceful fallback, no splitting
7. **Standing near chairs**: Normal +0.6 avatar bias still works for non-sitting avatars
8. **`npx vitest run`**: No regressions
