---
phase: 17-bugfixes-and-wishlist
plan: "02"
subsystem: rendering
tags: [canvas, tinting, face-rendering, avatar, pixel-artifacts]

# Dependency graph
requires:
  - phase: 14.1-avatar-facial-features
    provides: Face rendering (ey/fc parts) in avatar renderer
provides:
  - Stray pixel elimination via full tint canvas clear
  - Direction mapping test coverage for buildFrameKey
affects: [avatar-rendering, avatar-builder]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared offscreen canvas must clear full dimensions, not just current frame size"

key-files:
  created: []
  modified:
    - src/isoAvatarRenderer.ts
    - src/avatarBuilderPreview.ts
    - tests/isoAvatarRenderer.test.ts

key-decisions:
  - "clearRect must use full tint canvas dimensions (_tintCanvas.width/height) to prevent residual pixel leak from prior larger sprites"

patterns-established:
  - "Shared canvas clear pattern: always clear full canvas dimensions, not per-frame dimensions"

requirements-completed: [Ongoing]

# Metrics
duration: 2min
completed: 2026-03-07
---

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
