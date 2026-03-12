---
id: S10
parent: M002
milestone: M002
provides:
  - Stray pixel elimination via full tint canvas clear
  - Direction mapping test coverage for buildFrameKey
  - Non-blocking inline AvatarBuilderPanel at bottom-left of canvas
  - Canvas interaction preserved while avatar editor is open
requires: []
affects: []
key_files: []
key_decisions:
  - "clearRect must use full tint canvas dimensions (_tintCanvas.width/height) to prevent residual pixel leak from prior larger sprites"
  - "Inline panel at bottom-left (absolute positioned) instead of full-screen fixed overlay"
  - "Removed isBuilderOpenRef click-blocking guard to allow simultaneous canvas interaction"
  - "Preview canvas reduced from 120x180 to 80x120 for compact panel form factor"
  - "Backward-compatible re-export as AvatarBuilderModal to avoid breaking existing imports"
patterns_established:
  - "Shared canvas clear pattern: always clear full canvas dimensions, not per-frame dimensions"
  - "Inline panel pattern: absolute positioning with bottom/left anchoring for non-blocking tool panels"
observability_surfaces: []
drill_down_paths: []
duration: 2min
verification_result: passed
completed_at: 2026-03-07
blocker_discovered: false
---
# S10: Bugfixes And Wishlist

**# Phase 17 Plan 01: In Progress Notes Single-Wall Constraint Summary**

## What Happened

# Phase 17 Plan 01: In Progress Notes Single-Wall Constraint Summary

Confined In Progress sticky notes to the left wall only, removing cross-wall overflow that visually broke the spatial metaphor where right wall = completed work.

## What Was Built

The `drawKanbanNotes` function in `src/isoKanbanRenderer.ts` previously distributed In Progress cards across both the left and right walls when the left wall ran out of tile slots. This fix removes the right-wall overflow loop entirely and constrains all small In Progress notes to the left wall.

## Changes Made

### src/isoKanbanRenderer.ts

- Removed `rightSmallTiles` variable declaration (was `rightEdge` filtered to exclude mid tile)
- Changed `smallCapacity` from `(leftSmallTiles.length + rightSmallTiles.length) * 2` to `leftSmallTiles.length * 2`
- Removed the entire `for (const { tx, ty } of rightSmallTiles)` loop that drew In Progress notes on the right wall
- Retained `hasRightLarge` (still used by the Done note drawing logic above the small-notes section); suppressed unused-variable lint warning with `void hasRightLarge`

### tests/isoKanbanRenderer.test.ts

- Updated `respects capacity limit for In Progress notes on tiny grid`: changed expected count from 8 to 4 (2x2 grid: 2 left tiles × 2 slots = 4, right wall no longer used)
- Added new test `never places In Progress notes on the right wall`: provides 20 In Progress cards on a 5x5 grid and asserts all small hit areas have `wallSide: 'left'`, with zero right-wall small notes

## Verification

- `npx vitest run tests/isoKanbanRenderer.test.ts` — 16 tests pass (including updated + new test)
- `npx vitest run` — 277 tests pass, no regressions across all 19 test files
- Grep confirms `rightSmallTiles` has zero matches in `src/isoKanbanRenderer.ts`
- Grep confirms `leftSmallTiles.length * 2` is the sole capacity formula

## Deviations from Plan

None — plan executed exactly as written. The `void hasRightLarge` suppression was a minor implementation detail not explicitly in the plan but required to keep the variable (which the Done note logic relies on) without a lint warning.

## Self-Check: PASSED

- `src/isoKanbanRenderer.ts` — modified and verified
- `tests/isoKanbanRenderer.test.ts` — modified with updated + new test
- Commit `f30346e` — fix(17-01): constrain In Progress notes to left wall only
- All 277 tests pass

# Phase 17 Plan 02: Stray Pixel Fix Summary

**Fixed tint canvas residual pixel leak by clearing full canvas dimensions, added direction mapping and face rendering tests (321 tests passing)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T11:40:40Z
- **Completed:** 2026-03-07T11:43:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Eliminated stray pixel/particle that appeared when avatars faced diagonal directions (1, 3, 5) by fixing clearRect to use full tint canvas dimensions
- Applied matching fix in avatarBuilderPreview.ts for consistency
- Added 4 new tests for buildFrameKey direction mapping, variant cycling, and walk/non-walk action selection

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix tint canvas residual pixel leak** - `c7cf1d0` (fix)
2. **Task 2: Add meaningful test coverage for face rendering logic** - `7f40c80` (test)

## Files Created/Modified
- `src/isoAvatarRenderer.ts` - clearRect now uses _tintCanvas.width/height instead of frame.w/frame.h
- `src/avatarBuilderPreview.ts` - Same clearRect fix in drawTintedPart
- `tests/isoAvatarRenderer.test.ts` - 4 new tests for direction mapping, variant cycling, action selection

## Decisions Made
- clearRect must use full tint canvas dimensions to prevent residual pixel leak: the shared tint canvas (min 128x128) retained pixels from prior large sprites when small face sprites (e.g., 4x5 eyes) were drawn

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Merged phase 14.1 branch to access face rendering code**
- **Found during:** Task 1 (tint canvas fix)
- **Issue:** Phase 14.1 face rendering code (ey/fc parts, avatarBuilderPreview.ts) was on a separate branch not yet merged into phase 17
- **Fix:** Fast-forward merged gsd/phase-14.1 branch into gsd/phase-17 branch
- **Files modified:** 29 files (all phase 14/14.1 changes)
- **Verification:** All 321 tests pass after merge
- **Committed in:** Part of branch merge (fast-forward, no merge commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Branch merge was necessary prerequisite for applying the planned fixes. No scope creep.

## Issues Encountered
None beyond the branch merge.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Stray pixel fix is complete; face rendering should be visually clean at all directions
- Full test suite passing (321 tests across 20 files)
- Ready for plan 17-03

## Self-Check: PASSED

- All 3 modified files exist on disk
- Both task commits (c7cf1d0, 7f40c80) exist in git log
- clearRect fix confirmed in both renderer files
- All 321 tests passing

---
*Phase: 17-bugfixes-and-wishlist*
*Completed: 2026-03-07*

# Phase 17 Plan 03: Avatar Builder Inline Panel Summary

**Converted avatar builder from full-screen blocking modal to compact inline panel at bottom-left, enabling simultaneous canvas interaction**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T11:46:28Z
- **Completed:** 2026-03-07T11:48:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Avatar editor renders as a 220px-wide inline panel at bottom-left instead of a full-screen overlay
- Canvas clicks (move avatars, sit in chairs, open sticky notes) work while editor panel is open
- Preview canvas compacted from 120x180 to 80x120 with all controls stacked vertically
- All existing functionality preserved: preview, clothing, colors, gender toggle, wardrobe, save/cancel

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert AvatarBuilderModal to inline AvatarBuilderPanel** - `b089b68` (feat)
2. **Task 2: Integrate inline panel into RoomCanvas and remove click blocking** - `59c8bca` (feat)

## Files Created/Modified
- `src/AvatarBuilderModal.tsx` - Refactored from fixed overlay to absolute-positioned inline panel with vertical layout
- `src/avatarBuilderPreview.ts` - Reduced PREVIEW_WIDTH/HEIGHT from 120x180 to 80x120, adjusted screenY centering
- `src/RoomCanvas.tsx` - Updated import to AvatarBuilderPanel, removed click-blocking guard and unused isBuilderOpenRef

## Decisions Made
- Kept filename as `AvatarBuilderModal.tsx` with backward-compatible re-export to minimize import path changes
- Removed `isBuilderOpenRef` entirely since its only usage was the deleted click-blocking guard
- Panel uses `position: absolute; left: 10px; bottom: 10px` matching the LayoutEditorPanel convention at `top: 10px`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Avatar builder is now non-blocking, ready for further UX improvements
- Panel positioning convention established for future tool panels

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 17-bugfixes-and-wishlist*
*Completed: 2026-03-07*
