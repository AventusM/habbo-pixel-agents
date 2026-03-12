# T03: 04-furniture-rendering 03

**Slice:** S04 — **Milestone:** M001

## Description

Integrate furniture rendering into the webview render loop and validate all 8 furniture types render correctly with proper depth ordering and direction rotation.

Purpose: Complete the furniture rendering pipeline by wiring furniture renderables into the existing room render loop and visually confirming all 8 required furniture types work as expected.

Output: Working furniture rendering in VS Code webview with all 8 types visible, depth-sorted with room geometry, and visually validated against Habbo v14 reference.

## Must-Haves

- [ ] "All 8 furniture types render in webview without sprite errors"
- [ ] "Furniture direction rotation (0, 2, 4, 6) works for all types"
- [ ] "Furniture integrates into depth-sort pipeline with tiles and walls"
- [ ] "Visual rendering matches Habbo v14 reference screenshots"

## Files

- `src/webview.tsx`
- `src/extension.ts`
