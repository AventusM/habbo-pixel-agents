# S04: Furniture Rendering

**Goal:** Validate furniture asset availability and implement single-tile furniture rendering with the chair as the first working example.
**Demo:** Validate furniture asset availability and implement single-tile furniture rendering with the chair as the first working example.

## Must-Haves


## Tasks

- [x] **T01: 04-furniture-rendering 01**
  - Validate furniture asset availability and implement single-tile furniture rendering with the chair as the first working example.

Purpose: Establish the furniture rendering pipeline (sprite lookup → anchor offset → drawImage) and validate all 8 required furniture types exist in the asset source before implementing multi-tile or batch rendering.

Output: Working chair rendering in all 4 directions, integrated into depth-sort pipeline, with asset validation checklist confirming all 8 furniture types are available.
- [x] **T02: 04-furniture-rendering 02**
  - Implement multi-tile furniture rendering with correct depth sorting so desks and other large furniture render correctly relative to avatars and tiles.

Purpose: Fix the multi-tile occlusion bug where avatars standing behind furniture edges incorrectly appear in front. Use max-coordinate sort key pattern from research to ensure correct depth ordering.

Output: Working desk rendering with validated depth sorting — avatars on adjacent tiles appear correctly in front of or behind the desk.
- [x] **T03: 04-furniture-rendering 03**
  - Integrate furniture rendering into the webview render loop and validate all 8 furniture types render correctly with proper depth ordering and direction rotation.

Purpose: Complete the furniture rendering pipeline by wiring furniture renderables into the existing room render loop and visually confirming all 8 required furniture types work as expected.

Output: Working furniture rendering in VS Code webview with all 8 types visible, depth-sorted with room geometry, and visually validated against Habbo v14 reference.

## Files Likely Touched

- `src/isoFurnitureRenderer.ts`
- `tests/isoFurnitureRenderer.test.ts`
- `assets/spritesheets/furniture_atlas.json`
- `assets/spritesheets/furniture_atlas.png`
- `src/isoFurnitureRenderer.ts`
- `tests/isoFurnitureRenderer.test.ts`
- `src/webview.tsx`
- `src/extension.ts`
