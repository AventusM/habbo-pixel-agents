# T01: 07-layout-editor-integration 01

**Slice:** S07 — **Milestone:** M001

## Description

Implement core mouse-to-tile conversion logic for the layout editor using the inverse isometric formula with z=0 assumption (Strategy B from Phase 1 research).

Purpose: Enable accurate tile selection and hover highlighting so users can interact with the isometric grid using their mouse.
Output: Pure TypeScript module with tested coordinate conversion functions and hover rendering.

## Must-Haves

- [ ] "User can hover over a tile and see which grid cell the mouse is over"
- [ ] "Hover highlight appears at the correct isometric tile position"
- [ ] "Mouse clicks on tiles select the correct tile coordinates"

## Files

- `src/isoLayoutEditor.ts`
- `tests/isoLayoutEditor.test.ts`
