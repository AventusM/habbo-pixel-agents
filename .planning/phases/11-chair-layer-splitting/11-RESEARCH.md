# Phase 11: Chair Layer Splitting - Research

**Researched:** 2026-03-05
**Domain:** Isometric depth sorting / Canvas 2D painter's algorithm / Furniture layer partitioning
**Confidence:** HIGH

---

## Summary

Phase 11 introduces per-layer depth splitting for chair furniture so that a sitting avatar sorts visually between the chair seat (behind) and chair backrest (in front). Currently, `createNitroFurnitureRenderable` emits one `Renderable` that draws all layers with depth key `tileX + tileY`. Avatars receive a `+0.6` bias on `tileX`, placing them in front of all furniture at the same tile — meaning the backrest is incorrectly hidden behind the avatar.

The fix is to split chairs into two `Renderable` objects: a **seat renderable** at normal depth `tileX + tileY` and a **backrest renderable** at `tileX + 0.8 + tileY` (past the avatar's `+0.6` bias). Whether a layer belongs to seat or backrest is determined by the per-direction `z` value already present in `visualization.directions` of the Nitro JSON — positive `z` = frontmost (backrest), non-positive = seat.

The codebase already has all primitives needed: `getLayerZValues()`, `isChairType()`, `resolveNitroFrame()`, `drawNitroFrame()`, and the `sliceMultiTileRenderable` pattern for multi-renderable output. No new abstractions are required — this is primarily a targeted modification to `createNitroFurnitureRenderable` and its call site in `createFurnitureRenderables`.

**Primary recommendation:** Add `createNitroChairRenderables()` function that partitions layers by z-sign and returns two `Renderable[]` items; call it from `createFurnitureRenderables` when `isChairType()` is true and Nitro metadata has any layer with z > 0.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D (browser built-in) | N/A | Painter's algorithm depth sort | Established in Phase 2; no migration needed |
| TypeScript | 5.x | Type-safe layer partitioning | Project-wide; already in use |
| Vitest | ^3.0.0 | Unit tests for new splitting logic | Existing test infrastructure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | — | — | No new dependencies needed |

**Installation:**
No new packages required.

---

## Architecture Patterns

### Existing Patterns That Apply

#### Pattern 1: Multi-Output Renderable Creation (from `sliceMultiTileRenderable`)
**What:** A single furniture spec produces multiple `Renderable` objects, each with a different `tileX`/`tileY` for depth-sort placement.
**When to use:** When a single sprite must appear at different depths simultaneously.
**Example from codebase:**
```typescript
// src/isoFurnitureRenderer.ts — sliceMultiTileRenderable()
slices.push({
  tileX: centerTileX,
  tileY: d - centerTileX,  // depth-sorting position
  tileZ: z,
  draw: (ctx) => {
    ctx.save();
    // clipped draw of the full renderable
    ctx.restore();
  },
});
```

#### Pattern 2: Layer Z-value Partitioning (from `createNitroFurnitureRenderable`)
**What:** Layers are already separated by their z-value from `getLayerZValues()` for within-sprite draw order.
**Extension for this phase:** Instead of sorting within one draw call, partition layers into two separate `Renderable` objects based on z-sign.

```typescript
// Current: single renderable sorts layers by z, draws them all
layers.sort((a, b) => a.z - b.z);
for (const layer of layers) drawNitroFrame(ctx, layer.frame, ...);

// New: partition layers into seat (z <= 0) and backrest (z > 0)
const seatLayers    = layers.filter(l => l.z <= 0);
const backreestLayers = layers.filter(l => l.z > 0);
// Return two Renderables with different depth positions
```

#### Pattern 3: Camera-Origin Wrapping (from `createFurnitureRenderables`)
**What:** After creating renderables, their `draw` functions are wrapped with `ctx.translate(cameraOrigin.x, cameraOrigin.y)`.
**Importance:** Any new renderables returned by `createNitroChairRenderables` must also receive this wrapping at the call site.

```typescript
// src/isoTileRenderer.ts — createFurnitureRenderables()
const originalDraw = renderable.draw;
renderable.draw = (ctx) => {
  ctx.save();
  ctx.translate(cameraOrigin.x, cameraOrigin.y);
  originalDraw(ctx);
  ctx.restore();
};
```

### Depth Arithmetic — Confirmed Values

From `isoAvatarRenderer.ts` lines 594–598:
```typescript
tileX: spec.tileX + 0.6,  // Avatar depth bias
```

From `depthSort` in `isoTypes.ts`:
```typescript
const depthA = a.tileX + a.tileY + a.tileZ * 0.001;
```

Target sort order for chair at (X, Y):
| Renderable | tileX | tileY | Sort key |
|-----------|-------|-------|----------|
| Chair seat (layer 'a') | X | Y | X+Y |
| Avatar | X+0.6 | Y | X+Y+0.6 |
| Chair backrest (layer 'b', dirs 0/6) | X+0.8 | Y | X+Y+0.8 |

For directions 2/4 (z=-100 for layer 'b'), backrest has z <= 0 → goes into seat group → renders before avatar. Correct: in those views the backrest is at the back.

### hc_chr.json Layer Analysis

Confirmed from `/assets/habbo/furniture/hc_chr.json`:
- `visualization.layerCount: 2` (layers 'a' and 'b'; indices 0 and 1)
- `visualization.directions."0"."1".z: "100"` → layer b (index 1) is front in dir 0
- `visualization.directions."2"."1".z: "-100"` → layer b is back in dir 2
- `visualization.directions."4"."1".z: "-100"` → layer b is back in dir 4
- `visualization.directions."6"."1".z: "100"` → layer b is front in dir 6

Note: `getLayerZValues()` receives the **actual direction** (0, 2, 4, 6), not `baseDir`. Confirmed from existing code at line 447: `getLayerZValues(metadata, spec.direction)`. This is correct because the z-values are direction-dependent.

### Single-Layer Chair Fallback

From the existing PLAN.md analysis: chairs with `layerCount === 1` (or no layers with z > 0) have no meaningful front/back distinction. For these, `createNitroChairRenderables` should return `[renderable]` — a single Renderable — matching the current single-output path. No splitting needed.

### Anti-Patterns to Avoid
- **Checking `baseDir` for z-values:** `getLayerZValues` must receive `spec.direction` (actual direction), not `getBaseDirection(spec.direction)`. The visualization metadata uses actual directions (0, 2, 4, 6), not mirrored base directions.
- **Applying camera origin inside the new function:** Camera origin wrapping belongs at the `createFurnitureRenderables` call site, not inside `createNitroChairRenderables`.
- **Modifying `isoTypes.ts` depthSort:** The sort formula is correct as-is; only tileX values on the Renderable need to change.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Layer z-values per direction | Custom parsing | `getLayerZValues()` already exists | Already handles all edge cases |
| Frame lookup with source refs | Custom resolver | `resolveNitroFrame()` already exists | Handles source: aliasing |
| Sprite flip | Custom transform | `drawNitroFrame()` already exists | Handles XOR flip logic correctly |
| Chair type detection | Inline set check | `isChairType()` from furnitureRegistry | Already has CHAIR_IDS set |

---

## Common Pitfalls

### Pitfall 1: Forgetting Camera Origin Wrap for Backrest Renderable
**What goes wrong:** Backrest renderable draws at absolute coordinates instead of camera-relative, appears at wrong position.
**Why it happens:** `createNitroChairRenderables` returns raw renderables; caller must wrap them.
**How to avoid:** In `createFurnitureRenderables`, iterate over ALL returned renderables and apply the wrap. Use a helper or loop.
**Warning signs:** Backrest appears in top-left corner of canvas instead of over the chair.

### Pitfall 2: Using Wrong Direction for Z-Value Lookup
**What goes wrong:** `getLayerZValues(metadata, getBaseDirection(spec.direction))` — using base direction (0 or 2) instead of actual direction (0, 2, 4, 6).
**Why it happens:** `baseDir` is used for frame sprite lookup, but `z` values are keyed by actual direction in the metadata.
**How to avoid:** Pass `spec.direction` (not `baseDir`) to `getLayerZValues`. Confirmed correct in existing `createNitroFurnitureRenderable` implementation (line 447).
**Warning signs:** Dir 4/6 backrest renders in front when it should be behind (or vice versa).

### Pitfall 3: Multi-Tile Chair (club_sofa) Interacts with sliceMultiTileRenderable
**What goes wrong:** Applying layer splitting to multi-tile chairs conflicts with the slice system, causing double-depth manipulation.
**Why it happens:** `sliceMultiTileRenderable` also manipulates `tileX`/`tileY` for depth.
**How to avoid:** The PLAN.md guidance is correct — skip layer splitting for multi-tile chairs initially. `club_sofa` is in `multiTileFurniture`, not `furniture`, so it goes through a different code path. Single-tile chairs in the `furniture` array are the only target.
**Warning signs:** club_sofa renders with duplicate/missing slices or depth artifacts.

### Pitfall 4: Backrest Depth Offset Too Large
**What goes wrong:** Using `tileX + 1.0` for backrest pushes it behind avatars on adjacent tiles.
**Why it happens:** Avatar on tile (X+1, Y) has sort key X+1+Y; backrest at `tileX+1.0` has the same key.
**How to avoid:** Use `tileX + 0.8` (between avatar's 0.6 and 1.0 boundary). This is the value from the existing PLAN.md and is correct for 1×1 chairs.

### Pitfall 5: Empty Seat Layer Group
**What goes wrong:** All layers have z > 0 (no seat layers), seat renderable draws nothing but is still pushed to the list.
**Why it happens:** Unusual furniture data; unlikely but possible.
**How to avoid:** Only push a renderable if the corresponding layer group is non-empty.

---

## Code Examples

### New Function Structure
```typescript
// src/isoFurnitureRenderer.ts

/**
 * Create two renderables for a chair furniture item:
 * one for seat layers (behind avatar) and one for backrest layers (in front of avatar).
 *
 * Partitions layers by z-value from visualization.directions:
 *   z <= 0 → seat group (depth = tileX + tileY)
 *   z > 0  → backrest group (depth = tileX + 0.8 + tileY, in front of avatar's +0.6)
 *
 * Falls back to single renderable when no layers have z > 0 (no meaningful split).
 */
export function createNitroChairRenderables(
  spec: FurnitureSpec,
  spriteCache: SpriteCache,
  nitroAssetName: string,
): Renderable[] {
  if (!spriteCache.hasNitroAsset(nitroAssetName)) return [];

  const metadata = spriteCache.getNitroMetadata(nitroAssetName);
  if (!metadata) return [];

  const needsFlip = shouldMirrorSprite(spec.direction);
  const baseDir = getBaseDirection(spec.direction);
  const layerZValues = getLayerZValues(metadata, spec.direction); // Use actual direction, NOT baseDir

  const layerCount = metadata.visualization.layerCount || 1;
  const seatLayers: { frame: NitroSpriteFrame; z: number }[] = [];
  const backresetLayers: { frame: NitroSpriteFrame; z: number }[] = [];

  for (let i = 0; i < layerCount; i++) {
    const layerLetter = String.fromCharCode(97 + i); // 'a', 'b', ...
    const frameName = `${nitroAssetName}_64_${layerLetter}_${baseDir}_0`;
    const frame = resolveNitroFrame(spriteCache, nitroAssetName, frameName);
    if (!frame) continue;
    const z = layerZValues.get(i) ?? 0;
    if (z > 0) {
      backresetLayers.push({ frame, z });
    } else {
      seatLayers.push({ frame, z });
    }
  }

  // No z > 0 layers: no meaningful split, return single renderable
  if (backresetLayers.length === 0) {
    return [createNitroFurnitureRenderable(spec, spriteCache, nitroAssetName)!];
  }

  const renderables: Renderable[] = [];

  // Seat renderable (behind avatar)
  if (seatLayers.length > 0) {
    seatLayers.sort((a, b) => a.z - b.z);
    renderables.push({
      tileX: spec.tileX,
      tileY: spec.tileY,
      tileZ: spec.tileZ,
      draw: (ctx) => {
        const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);
        for (const layer of seatLayers) {
          drawNitroFrame(ctx, layer.frame, screen.x, screen.y, needsFlip);
        }
      },
    });
  }

  // Backrest renderable (in front of avatar, which has tileX+0.6)
  backresetLayers.sort((a, b) => a.z - b.z);
  renderables.push({
    tileX: spec.tileX + 0.8, // Sort after avatar (+0.6)
    tileY: spec.tileY,
    tileZ: spec.tileZ,
    draw: (ctx) => {
      const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);
      for (const layer of backresetLayers) {
        drawNitroFrame(ctx, layer.frame, screen.x, screen.y, needsFlip);
      }
    },
  });

  return renderables;
}
```

### Updated Call Site in `createFurnitureRenderables`
```typescript
// src/isoTileRenderer.ts — createFurnitureRenderables()

for (const furni of furniture) {
  const nitroName = resolveAssetName(furni.name);

  // Chair-type furniture: split into seat + backrest renderables
  if (isChairType(furni.name) && spriteCache.hasNitroAsset(nitroName)) {
    const chairRenderables = createNitroChairRenderables(furni, spriteCache, nitroName);
    for (const r of chairRenderables) {
      const origDraw = r.draw;
      r.draw = (ctx) => {
        ctx.save();
        ctx.translate(cameraOrigin.x, cameraOrigin.y);
        origDraw(ctx);
        ctx.restore();
      };
      renderables.push(r);
    }
    continue; // Skip the standard single-renderable path
  }

  // Non-chair: existing single-renderable path
  let renderable = spriteCache.hasNitroAsset(nitroName)
    ? createNitroFurnitureRenderable(furni, spriteCache, nitroName)
    : null;
  // ... existing code unchanged
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All chair layers in one Renderable | Chair split into seat + backrest Renderables | Phase 11 | Avatar sorts between chair layers |

---

## Open Questions

1. **Should `isChairType` also check the Nitro metadata for z > 0 layers?**
   - What we know: `isChairType()` uses a hardcoded set in `furnitureRegistry.ts`. Not all chairs in the set necessarily have z > 0 layers (e.g., `greek_c19_chair` has `layerCount: 1`).
   - What's unclear: Whether any chair type in CHAIR_IDS has unexpected metadata.
   - Recommendation: The fallback inside `createNitroChairRenderables` (return single renderable when no backrest layers) handles this gracefully. No change to `isChairType` needed.

2. **club_sofa (multi-tile chair) — skip or implement?**
   - What we know: `club_sofa` goes through `multiTileFurniture` → `sliceMultiTileRenderable`. Layer splitting within slices would require a deeper refactor.
   - Recommendation: Skip for this phase (acceptable visual; noted in PLAN.md as "or: skip layer splitting for multi-tile chairs initially").

3. **Should the placeholder (non-Nitro) chair path also split?**
   - What we know: Placeholder furniture (`createFurnitureRenderable`) renders only layer 'a'. No backrest layer exists.
   - Recommendation: No change needed; placeholder chairs have no backrest data.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/isoFurnitureRenderer.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| (Phase 11 functional) | `createNitroChairRenderables` returns 2 renderables for dir 0 | unit | `npx vitest run tests/isoFurnitureRenderer.test.ts` | Wave 0 gap |
| (Phase 11 functional) | Returns 1 renderable (no split) for single-layer chair | unit | `npx vitest run tests/isoFurnitureRenderer.test.ts` | Wave 0 gap |
| (Phase 11 functional) | Seat renderable has tileX = spec.tileX (no bias) | unit | `npx vitest run tests/isoFurnitureRenderer.test.ts` | Wave 0 gap |
| (Phase 11 functional) | Backrest renderable has tileX = spec.tileX + 0.8 | unit | `npx vitest run tests/isoFurnitureRenderer.test.ts` | Wave 0 gap |
| (Phase 11 functional) | Dir 2 chair: both layers in seat group (z=-100), no backrest split | unit | `npx vitest run tests/isoFurnitureRenderer.test.ts` | Wave 0 gap |
| (Phase 11 functional) | Non-chair furniture unchanged (still 1 renderable) | unit | `npx vitest run tests/isoFurnitureRenderer.test.ts` | Existing tests cover |
| (Phase 11 functional) | Full suite passes with no regressions | regression | `npx vitest run` | Existing |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/isoFurnitureRenderer.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/isoFurnitureRenderer.test.ts` needs new `describe('createNitroChairRenderables')` block covering the 5 test cases above.

---

## Sources

### Primary (HIGH confidence)
- `/src/isoFurnitureRenderer.ts` — Full source: `getLayerZValues`, `resolveNitroFrame`, `drawNitroFrame`, `createNitroFurnitureRenderable`, `sliceMultiTileRenderable`
- `/src/isoTileRenderer.ts` — `createFurnitureRenderables` call site; camera-origin wrapping pattern
- `/src/isoAvatarRenderer.ts` — Avatar `tileX + 0.6` bias confirmed at lines 594–598
- `/src/isoTypes.ts` — `depthSort` formula: `tileX + tileY + tileZ * 0.001`
- `/src/furnitureRegistry.ts` — `isChairType()`, `CHAIR_IDS` set
- `/assets/habbo/furniture/hc_chr.json` — Layer count 2, z-values per direction confirmed
- `.planning/phases/11-chair-layer-splitting/PLAN.md` — Existing manual plan with depth arithmetic

### Secondary (MEDIUM confidence)
- None needed — all critical information is directly in the codebase.

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — No new libraries; existing Canvas 2D and Vitest
- Architecture: HIGH — Confirmed patterns from existing code (`sliceMultiTileRenderable`, `getLayerZValues`, camera-origin wrapping)
- Pitfalls: HIGH — Derived from actual code paths and confirmed data values (z=-100/100 from hc_chr.json)

**Research date:** 2026-03-05
**Valid until:** Stable — no external dependencies; valid as long as asset format and depthSort formula remain unchanged
