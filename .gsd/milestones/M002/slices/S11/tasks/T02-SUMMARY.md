---
id: T02
parent: S11
milestone: M002
provides:
  - "Right-click movement via onContextMenu handler"
  - "Left-click simplified to avatar selection and builder only"
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 1min
verification_result: passed
completed_at: 2026-03-07
blocker_discovered: false
---
# T02: 17.1-stray-pixel-diagnostic-fix-and-right-click-movement 02

**# Phase 17.1 Plan 02: Right-Click Movement Summary**

## What Happened

# Phase 17.1 Plan 02: Right-Click Movement Summary

**Right-click avatar movement via onContextMenu handler with left-click simplified to selection-only**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-07T16:52:06Z
- **Completed:** 2026-03-07T16:53:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created handleContextMenu handler with chair-sit and walkable-tile movement logic
- Simplified handleClick to only handle: sticky notes, editor modes, avatar click (builder/stand), and deselect
- Added onContextMenu to canvas element with browser context menu suppression
- All 321 existing tests continue to pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add right-click movement handler and simplify left-click** - `450cd1d` (feat)

## Files Created/Modified
- `src/RoomCanvas.tsx` - Added handleContextMenu for right-click movement; removed movement logic from handleClick

## Decisions Made
- Right-click movement separates the select and move actions into different click types, eliminating the confusing dual-purpose left-click
- Editor modes (paint, color, furniture) are excluded from right-click handling since they only use left-click
- Browser context menu is suppressed via event.preventDefault() on the canvas element

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Right-click movement fully functional
- Left-click cleanly separated for avatar selection and builder panel
- No blockers for future phases

---
*Phase: 17.1-stray-pixel-diagnostic-fix-and-right-click-movement*
*Completed: 2026-03-07*
