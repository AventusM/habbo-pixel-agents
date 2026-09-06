# S03: Chair Layer Splitting

**Goal:** Split chair furniture into separate seat and backrest renderables at different depth values so a sitting avatar sorts between them — seat renders behind the avatar (depth X+Y), backrest renders in front (depth X+Y+0.
**Demo:** Split chair furniture into separate seat and backrest renderables at different depth values so a sitting avatar sorts between them — seat renders behind the avatar (depth X+Y), backrest renders in front (depth X+Y+0.

## Must-Haves


## Tasks

- [x] **T01: 11-chair-layer-splitting 01**
  - Split chair furniture into separate seat and backrest renderables at different depth values so a sitting avatar sorts between them — seat renders behind the avatar (depth X+Y), backrest renders in front (depth X+Y+0.8, past the avatar's +0.6 bias).

Purpose: When avatars sit on chairs, the backrest should visually overlap the avatar's torso, creating the authentic "sitting in a chair" appearance. Currently the entire chair renders behind the avatar because of the +0.6 depth bias.

Output: `createNitroChairRenderables()` function in isoFurnitureRenderer.ts, updated call site in isoTileRenderer.ts, unit tests covering all splitting/fallback cases.

## Files Likely Touched

- `src/isoFurnitureRenderer.ts`
- `src/isoTileRenderer.ts`
- `tests/isoFurnitureRenderer.test.ts`
