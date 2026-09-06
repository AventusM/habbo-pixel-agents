---
phase: 11-chair-layer-splitting
verified: 2026-03-05T21:07:00Z
status: human_needed
score: 6/6 must-haves verified
re_verification: false
human_verification:
  - test: "Sit avatar on hc_chr at direction 0"
    expected: "Chair backrest visually overlaps the avatar's torso (renders in front of the sitting avatar)"
    why_human: "Cannot verify visual z-ordering correctness programmatically — requires rendering the scene and inspecting pixel overlap"
  - test: "Sit avatar on hc_chr at direction 2"
    expected: "Backrest renders behind the avatar (z=-100 in dir 2 metadata — single renderable, no split)"
    why_human: "Direction-dependent split correctness requires visual inspection of the rendered output"
  - test: "Stand (non-sitting) avatar near hc_chr"
    expected: "No visual regression — chair renders normally with standard depth bias, avatar sorts correctly without chair splitting artifacts"
    why_human: "Edge case behavior requires visual inspection"
---

# Phase 11: Chair Layer Splitting Verification Report

**Phase Goal:** Split chair furniture into separate seat and backrest renderables at different depth values so that a sitting avatar sorts between them — backrest renders in front of avatar, seat renders behind.
**Verified:** 2026-03-05T21:07:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `createNitroChairRenderables` returns 2 renderables for hc_chr dir 0 (seat at tileX, backrest at tileX+0.8) | VERIFIED | Test "dir 0 chair with backrest layer returns 2 renderables" passes; seat renderable has `tileX === 3`, backrest has `tileX === 3.8`; implementation at lines 533-608 of `src/isoFurnitureRenderer.ts` partitions by `z > 0` and assigns `tileX: spec.tileX + 0.8` to backrest |
| 2 | `createNitroChairRenderables` returns 1 renderable (no split) when all layers have z <= 0 (e.g. dir 2) | VERIFIED | Test "dir 2 chair with all z <= 0 returns 1 renderable (no split)" passes; fallback at line 570-573 delegates to `createNitroFurnitureRenderable` when `backrestLayers.length === 0` |
| 3 | `createNitroChairRenderables` returns 1 renderable for single-layer chairs (layerCount 1) | VERIFIED | Test "single-layer chair (layerCount 1, no z > 0) returns 1 renderable" passes; single-layer chairs have no z > 0 layers so fallback path is taken |
| 4 | Non-chair furniture still produces exactly 1 renderable (no regression) | VERIFIED | `createFurnitureRenderables` in `isoTileRenderer.ts` lines 236-249 gates on `isChairType(furni.name)` before entering the chair path; non-chair items take the unchanged path at lines 252-268; full suite 249/249 pass confirms no regressions |
| 5 | `createFurnitureRenderables` wraps all chair renderables with camera-origin translate | VERIFIED | Lines 238-247 of `isoTileRenderer.ts` iterate every renderable returned by `createNitroChairRenderables` and wrap each with `ctx.save()` / `ctx.translate(cameraOrigin.x, cameraOrigin.y)` / `origDraw(ctx)` / `ctx.restore()` |
| 6 | Multi-tile chairs (club_sofa) are NOT split — they go through existing multi-tile path unchanged | VERIFIED | The chair gate at line 236 applies only inside the `for (const furni of furniture)` loop; club_sofa is handled by the separate `for (const furni of multiTileFurniture)` loop at lines 271-293, which is entirely unmodified |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/isoFurnitureRenderer.ts` | VERIFIED | Exists, substantive (713 lines), exports `createNitroChairRenderables` at line 533 |
| `src/isoTileRenderer.ts` | VERIFIED | Exists, substantive (366 lines), imports `createNitroChairRenderables` at line 19 and `isChairType` at line 25, wires them at line 236 |
| `tests/isoFurnitureRenderer.test.ts` | VERIFIED | Exists, substantive (709 lines), imports `createNitroChairRenderables` at line 8, contains full `describe('createNitroChairRenderables')` block at line 540 with 9 tests |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `createNitroChairRenderables` | `isoFurnitureRenderer.ts` export | `export function` keyword | WIRED | Line 533: `export function createNitroChairRenderables(` |
| `createFurnitureRenderables` in `isoTileRenderer.ts` | `createNitroChairRenderables` | import + call at `isChairType` gate | WIRED | Line 19 imports it; line 237 calls it inside `if (isChairType(furni.name) && spriteCache.hasNitroAsset(nitroName))` |
| `isChairType` | `furnitureRegistry.ts` | import + call | WIRED | Line 25 imports `isChairType` from `./furnitureRegistry.js`; line 236 calls it as the gate condition; `furnitureRegistry.ts` defines `isChairType` at line 148 using `CHAIR_IDS` set containing `'hc_chr'`, `'exe_chair'`, etc. |

### Requirements Coverage

No requirement IDs were declared in the PLAN frontmatter (`requirements: []`). No orphaned requirements found in REQUIREMENTS.md mapping to phase 11.

### Anti-Patterns Found

No blockers or warnings found. The implementation:
- Has no TODO/FIXME/placeholder comments in the new code
- Has no empty implementations (`return null` / `return []` only appear as intentional fallbacks with accompanying logic)
- Has no stub handlers

### Human Verification Required

#### 1. Backrest Visually in Front of Sitting Avatar (dir 0)

**Test:** Place an avatar sitting on `hc_chr` at direction 0. Observe the avatar and chair relationship.
**Expected:** The chair backrest (upper layer) visually overlaps the avatar's torso — the avatar appears to sit "inside" the chair with the backrest showing in front of the body.
**Why human:** Canvas pixel z-ordering correctness requires rendering the scene with real assets and inspecting whether the backrest pixels composite on top of the avatar torso pixels.

#### 2. Backrest Behind Avatar at Direction 2

**Test:** Place an avatar sitting on `hc_chr` at direction 2. Observe the chair/avatar relationship.
**Expected:** The backrest renders behind the avatar (direction 2 has z=-100, so no split occurs — single renderable at base depth, avatar at depth+0.6 renders in front).
**Why human:** Same reason — requires visual inspection of the rendered output.

#### 3. No Standing Avatar Regressions

**Test:** Place a non-sitting avatar near `hc_chr` without sitting.
**Expected:** Chair renders at its normal depth, avatar sorts correctly using the standard +0.6 bias, no visual artifacts from the chair split affecting non-sitting avatars.
**Why human:** Visual edge case cannot be verified without rendering.

### Gaps Summary

No gaps found. All 6 must-have truths are verified against the actual codebase. The implementation exactly matches the plan specification:

- `createNitroChairRenderables` is correctly exported and implements the z-partition logic
- The depth bias of +0.8 for the backrest exceeds the avatar's +0.6 bias, guaranteeing correct sort order
- The fallback to `createNitroFurnitureRenderable` correctly handles dir 2, dir 4, and single-layer chairs
- The call site in `isoTileRenderer.ts` correctly gates on `isChairType`, wraps all returned renderables with camera-origin translate, and skips non-chair furniture and multi-tile furniture
- All 9 new unit tests plus 240 regression tests pass (249 total, 0 failures)

---

_Verified: 2026-03-05T21:07:00Z_
_Verifier: Claude (gsd-verifier)_
