# Phase 17.2: Fix Walking Animation Clipping and Layer Artifacts - Research

**Researched:** 2026-03-07
**Domain:** Canvas 2D avatar composition, Habbo figure sprite system
**Confidence:** HIGH

## Summary

The walking animation has two visual bugs: (1) body skin pixels clipping through clothing layers, and (2) a "two left hands" artifact in certain directions. Both stem from the same root cause: offset mismatches between walk-frame sprites and std-frame sprites when different body parts use different animation actions.

During walk state, `bd` (body), `lh`/`rh` (hands), `lg` (legs), `sh` (shoes), `ls`/`rs` (sleeves) all use `h_wlk_*` frames with per-frame offsets that shift position. But `ch` (chest/shirt) has NO walk frames and always uses `h_std_*`. The walk-frame body sprite shifts by 2-5 pixels relative to the static chest sprite, causing skin to peek through. Similarly, the `lh` bare hand sprite (from hh_human_body, 5x27px) swings independently of the `ls` clothed sleeve sprite (from Shirt, 5x10px), and in flipped directions the visual layering can produce doubled-hand artifacts.

**Primary recommendation:** The fix requires ensuring that during walk animation, the chest sprite (`ch`) uses a position-corrected offset that tracks the body sprite's walk-frame shift, and that the hand/sleeve layer ordering is validated for all 8 directions including flipped directions 4, 5, 6.

## Architecture Patterns

### Current Avatar Composition Flow

```
createNitroAvatarRenderable(spec, spriteCache)
  -> getRenderOrder(mappedDir)     // 13 parts in back-to-front order
  -> for each part:
     -> buildFrameKey(part, state, direction, frame, variant, figureParts)
        -> mapBodyDirection(direction) -> { dir, flip }
        -> action = walk parts use "wlk", others use "std"
     -> spriteCache.getNitroFrame(asset, frameKey)
     -> effectiveFlip = flip XOR frame.flipH
     -> drawTintedBodyPart(ctx, frame, screenX, screenY, effectiveFlip, color)
```

### Bug 1: Body-Chest Offset Mismatch During Walk

**Root cause analysis (HIGH confidence):**

The `ch` (chest/shirt) part is NOT in `WALK_PARTS`, so `buildFrameKey` always produces `h_std_ch_*` keys. Meanwhile `bd` (body) IS in `WALK_PARTS` and uses `h_wlk_bd_*` keys during walk.

Measured offset differences from cortex-assets (direction 2, setId 1):
- `h_std_bd_1_2_0`: offset (-22, 50), size 25x57
- `h_wlk_bd_1_2_0`: offset (-22, 52) -- Y+2px
- `h_wlk_bd_1_2_1`: offset (-23, 51) -- X-1px, Y+1px
- `h_wlk_bd_1_2_2`: offset (-23, 52) -- X-1px, Y+2px
- `h_wlk_bd_1_2_3`: offset (-17, 51), size 36x57 -- X+5px, Y+1px, width+11px!

The `h_std_ch_2050_2_0`: offset (-20, 48) stays constant while the body bounces. This creates 1-5px gaps where skin pixels show through the shirt.

**Fix approach:** Add `ch` to `WALK_PARTS` so it looks for `h_wlk_ch_*` frames. If those frames don't exist in the clothing asset (most shirts don't have walk frames for `ch`), the existing fallback logic at line 678-683 already falls back to `h_std`. BUT the fallback doesn't address the offset mismatch.

Better approach: When rendering `ch` during walk state, compute the offset delta between the current walk-frame `bd` sprite and the std-frame `bd` sprite, then apply that same delta to the `ch` sprite position. This keeps the chest locked to the body's walk bounce.

### Bug 2: "Two Left Hands" Artifact

**Root cause analysis (MEDIUM confidence):**

In flipped directions (4, 5, 6), `mapBodyDirection` returns `flip: true`. The XOR `flip !== frame.flipH` determines the effective flip. The render order swaps which hand is "behind":

- `RENDER_ORDER_LEFT_BEHIND` (dirs 2, 3): lh/ls drawn BEFORE body, rh/rs drawn AFTER
- `RENDER_ORDER_RIGHT_BEHIND` (dirs 0, 1, 7): rh/rs drawn BEFORE body, lh/ls drawn AFTER

For direction 4 (mapped to dir 2 + flip), `getRenderOrder(2)` returns LEFT_BEHIND. But when flipped, what was visually the "left hand" becomes the "right hand" on screen. The render order might draw both `lh` (bare hand skin) and `ls` (sleeve) at positions that produce a doubled appearance because:

1. `lh` from hh_human_body has walk offsets that swing the entire arm
2. `ls` from Shirt has different walk offsets for the sleeve portion
3. When flipped, the X-coordinate calculation `2 * regX - dx - frame.w` may misalign relative to the un-flipped hand

The `lh` sprite (5x27px) is the full arm with hand. The `ls` sprite (5x10px) is just the sleeve upper portion. In std pose they overlap correctly (sleeve covers upper arm). During walk, different offset shifts cause them to separate visually.

### Fix Strategy

**Approach A: Offset correction (recommended)**

1. For non-walk parts (`ch`, `hd`, `hr`, `hrb`) during walk state, compute the body walk-frame offset delta and apply it so these parts track with the body bounce:
   ```
   bodyStdOffset = getNitroFrame("hh_human_body", "h_std_bd_1_{dir}_0")
   bodyWalkOffset = getNitroFrame("hh_human_body", "h_wlk_bd_1_{dir}_{frame}")
   deltaX = bodyWalkOffset.offsetX - bodyStdOffset.offsetX
   deltaY = bodyWalkOffset.offsetY - bodyStdOffset.offsetY
   // Apply delta to ch, hd, hr, hrb screen positions
   ```

2. For hand/sleeve misalignment, ensure `ls` offset tracks `lh` walk frame delta in the same way:
   ```
   lhStdOffset = getNitroFrame("hh_human_body", "h_std_lh_1_{dir}_0")
   lhWalkOffset = getNitroFrame("hh_human_body", "h_wlk_lh_1_{dir}_{frame}")
   // ls already has its own walk frames, but compare if they move in sync
   ```

**Approach B: Per-frame sprite offset adjustment table**

Precompute offset deltas for each walk frame and apply globally to all non-walk parts. Simpler code but less flexible.

### Parts Classification

| Part | Walk Frames? | Asset Source | Notes |
|------|-------------|-------------|-------|
| bd | YES (hh_human_body) | hh_human_body | Body bounces 1-5px during walk |
| lh | YES (hh_human_body) | hh_human_body | Left arm/hand swings |
| rh | YES (hh_human_body) | hh_human_body | Right arm/hand swings |
| lg | YES (clothing) | Trousers_* | Legs have walk frames |
| sh | YES (clothing) | Shoes_* | Shoes have walk frames |
| ls | YES (clothing) | Shirt_* | Left sleeve has walk frames |
| rs | YES (clothing) | Shirt_* | Right sleeve has walk frames |
| ch | NO | Shirt_* | Chest stays static -- BUG SOURCE |
| hd | NO | hh_human_body | Head stays static |
| hr | NO | Hair_* | Hair stays static |
| hrb | NO | Hair_* | Hair back stays static |
| ey | NO | hh_human_face | Eyes stay static |
| fc | NO | hh_human_face | Mouth stays static |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Walk offset tracking | Manual offset table per direction | Compute delta from bd std vs bd wlk frames at runtime | Covers all directions and frame combos automatically |
| Layer order per direction | Static arrays for all 8 dirs | Two arrays + getRenderOrder() (already exists) | Flip doesn't change z-order, only visual side |

## Common Pitfalls

### Pitfall 1: Applying body delta to ALL non-walk parts indiscriminately
**What goes wrong:** Head, hair, and face parts have their own registration point relative to the body. Applying the full body delta might over-correct for parts that should remain stable relative to the neck.
**How to avoid:** Test the body delta correction on `ch` first (most visible bug). Then evaluate `hd`/`hr`/`hrb` -- they may need a smaller delta or no delta at all (head bob during walk is a separate concern in Habbo).

### Pitfall 2: Forgetting flip when computing offset delta
**What goes wrong:** For flipped directions (4, 5, 6), the delta X must be negated because the sprite is mirrored.
**How to avoid:** Always compute delta in pre-flip space, then let the existing flip logic in `drawTintedBodyPart` handle the coordinate transformation.

### Pitfall 3: Breaking idle/sit rendering while fixing walk
**What goes wrong:** Offset delta is zero for idle/sit (both use std frames), but if the delta computation path doesn't gracefully handle non-walk states, it could introduce NaN or zero-division.
**How to avoid:** Guard the delta computation: only compute when `stateForFrame === "walk"` and body walk frame exists. Otherwise delta is (0, 0).

### Pitfall 4: Sleeve walk frames not synchronized with hand walk frames
**What goes wrong:** `ls` walk frame 2 may not visually align with `lh` walk frame 2 because they come from different assets (Shirt vs hh_human_body) with independently authored offsets.
**How to avoid:** This is a cortex-assets content issue, not a renderer issue. If misalignment persists after render fixes, it's acceptable -- the sleeve covers only the upper arm portion and slight misalignment is normal in classic Habbo.

## Code Examples

### Computing body walk-frame delta
```typescript
// Source: analysis of cortex-assets offset data
function getBodyWalkDelta(
  spriteCache: SpriteCache,
  direction: number,
  frame: number,
  figureParts: Record<PartType, { asset: string; setId: number }>,
): { dx: number; dy: number } {
  const { dir } = mapBodyDirection(direction);
  const bodyAsset = figureParts['bd'].asset;
  const bodySetId = figureParts['bd'].setId;

  const stdKey = `h_std_bd_${bodySetId}_${dir}_0`;
  const wlkKey = `h_wlk_bd_${bodySetId}_${dir}_${frame}`;

  const stdFrame = spriteCache.getNitroFrame(bodyAsset, stdKey);
  const wlkFrame = spriteCache.getNitroFrame(bodyAsset, wlkKey);

  if (!stdFrame || !wlkFrame) return { dx: 0, dy: 0 };

  return {
    dx: wlkFrame.offsetX - stdFrame.offsetX,
    dy: wlkFrame.offsetY - stdFrame.offsetY,
  };
}
```

### Applying delta to non-walk parts in drawTintedBodyPart
```typescript
// Inside the render loop, for parts not in WALK_PARTS during walk state:
if (stateForFrame === 'walk' && !WALK_PARTS.has(part)) {
  const delta = getBodyWalkDelta(spriteCache, spec.direction, spec.frame, figureParts);
  // Adjust frame offset to track body bounce
  // Create a modified frame object with adjusted offsets
  frame = { ...frame, offsetX: frame.offsetX + delta.dx, offsetY: frame.offsetY + delta.dy };
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/isoAvatarRenderer.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-17.2-01 | ch offset tracks bd walk bounce | unit | `npx vitest run tests/isoAvatarRenderer.test.ts -x` | Partial (file exists, new tests needed) |
| BUG-17.2-02 | No "two hands" in flipped directions | unit | `npx vitest run tests/isoAvatarRenderer.test.ts -x` | Partial |
| BUG-17.2-03 | Idle/sit rendering unchanged | unit | `npx vitest run tests/isoAvatarRenderer.test.ts -x` | Exists |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/isoAvatarRenderer.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before verify

### Wave 0 Gaps
- [ ] New test: body walk-frame delta computation returns expected offset differences
- [ ] New test: ch offset is adjusted during walk state by body delta
- [ ] New test: non-walk parts produce identical output in idle state (regression guard)
- [ ] New test: flipped directions (4,5,6) do not produce doubled hand visual positions

## Open Questions

1. **Head bob during walk**
   - What we know: `hd`, `hr`, `hrb` use std frames during walk. Classic Habbo has subtle head bob.
   - What's unclear: Whether applying the body delta to head parts looks correct or over-exaggerated.
   - Recommendation: Apply delta to `ch` only in first pass. Add `hd`/`hr`/`hrb` in a second pass if needed, potentially with a dampened delta (e.g., 50% of body delta).

2. **Sleeve-hand sync across all clothing items**
   - What we know: Shirt_M_Tshirt_Plain has `ls`/`rs` walk frames. Other shirts may differ.
   - What's unclear: Whether ALL clothing items with sleeves have correctly aligned walk frames.
   - Recommendation: Fix the renderer-side issue first. Content-side misalignment across different shirts is acceptable cosmetic imperfection.

## Sources

### Primary (HIGH confidence)
- Direct analysis of `assets/habbo/figures/hh_human_body.json` - walk frame offsets verified
- Direct analysis of `assets/habbo/figures/Shirt_M_Tshirt_Plain.json` - ch/ls/rs frame data
- Source code: `src/isoAvatarRenderer.ts` lines 283-293 (WALK_PARTS), 563-587 (buildFrameKey), 593-738 (createNitroAvatarRenderable)

### Secondary (MEDIUM confidence)
- Habbo client reference: cortex-assets figure format conventions (based on established project knowledge in MEMORY.md)

## Metadata

**Confidence breakdown:**
- Root cause diagnosis: HIGH - offset data directly measured from asset files
- Fix approach: HIGH - offset delta correction is straightforward Canvas 2D math
- "Two left hands" diagnosis: MEDIUM - likely caused by render order + flip interaction, needs visual verification
- Head bob decision: LOW - aesthetic judgment, needs visual testing

**Research date:** 2026-03-07
**Valid until:** Indefinite (bug fix for existing codebase)