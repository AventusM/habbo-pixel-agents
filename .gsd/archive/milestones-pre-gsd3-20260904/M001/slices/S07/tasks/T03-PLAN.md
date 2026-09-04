# T03: 07-layout-editor-integration 03

**Slice:** S07 — **Milestone:** M001

## Description

Complete the layout editor with furniture placement, rotation, color picker UI, and save/load functionality.

Purpose: Provide a fully functional layout editor matching the original pixel-agents interface capabilities in isometric projection.
Output: Complete editor panel with all editing modes working and layout persistence.

## Must-Haves

- [ ] "User can place furniture at clicked tile position"
- [ ] "User can rotate placed furniture through 4 directions (0, 2, 4, 6)"
- [ ] "User can save layout to JSON and reload it"
- [ ] "Furniture placement validates bounds (multi-tile furniture doesn't extend into void)"

## Files

- `src/isoLayoutEditor.ts`
- `src/RoomCanvas.tsx`
- `src/LayoutEditorPanel.tsx`
- `tests/isoLayoutEditor.test.ts`
