---
id: T01
parent: S13
milestone: M002
provides:
  - selectAvatar() wired into left-click handler for avatar movement targeting
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 1min
verification_result: passed
completed_at: 2026-03-08
blocker_discovered: false
---
# T01: 17.3-fix-move-logic-to-respect-selected-avatar 01

**# Phase 17.3 Plan 01: Fix Move Logic to Respect Selected Avatar Summary**

## What Happened

# Phase 17.3 Plan 01: Fix Move Logic to Respect Selected Avatar Summary

**Left-click avatar calls selectAvatar() and syncs isSelected flag so right-click movement targets the user-chosen avatar**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-08T19:17:45Z
- **Completed:** 2026-03-08T19:18:32Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Wired selectAvatar(clickedAvatar.id) into left-click handler before popup/builder logic
- Synced isSelected boolean across all avatars so only the clicked one is true
- Right-click movement now correctly uses the selected avatar instead of nearest

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire selectAvatar into left-click handler** - `33f47e0` (fix)

## Files Created/Modified
- `src/RoomCanvas.tsx` - Added selectAvatar() call and isSelected sync in handleClick avatar branch

## Decisions Made
- Selection set before sit/stand and popup logic so all click paths have correct selectedAvatarId

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Avatar selection and movement targeting fully functional
- No blockers for future work

---
*Phase: 17.3-fix-move-logic-to-respect-selected-avatar*
*Completed: 2026-03-08*
