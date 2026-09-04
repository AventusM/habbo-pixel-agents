# T01: 11-chair-layer-splitting 01

**Slice:** S03 — **Milestone:** M002

## Description

Split chair furniture into separate seat and backrest renderables at different depth values so a sitting avatar sorts between them — seat renders behind the avatar (depth X+Y), backrest renders in front (depth X+Y+0.8, past the avatar's +0.6 bias).

Purpose: When avatars sit on chairs, the backrest should visually overlap the avatar's torso, creating the authentic "sitting in a chair" appearance. Currently the entire chair renders behind the avatar because of the +0.6 depth bias.

Output: `createNitroChairRenderables()` function in isoFurnitureRenderer.ts, updated call site in isoTileRenderer.ts, unit tests covering all splitting/fallback cases.

## Must-Haves

- [ ] "createNitroChairRenderables returns 2 renderables for hc_chr dir 0 (seat at tileX, backrest at tileX+0.8)"
- [ ] "createNitroChairRenderables returns 1 renderable (no split) when all layers have z <= 0 (e.g. dir 2)"
- [ ] "createNitroChairRenderables returns 1 renderable for single-layer chairs (layerCount 1)"
- [ ] "Non-chair furniture still produces exactly 1 renderable (no regression)"
- [ ] "createFurnitureRenderables wraps all chair renderables with camera-origin translate"
- [ ] "Multi-tile chairs (club_sofa) are NOT split — they go through existing multi-tile path unchanged"

## Files

- `src/isoFurnitureRenderer.ts`
- `src/isoTileRenderer.ts`
- `tests/isoFurnitureRenderer.test.ts`
