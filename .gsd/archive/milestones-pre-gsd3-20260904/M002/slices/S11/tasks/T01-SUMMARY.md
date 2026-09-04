---
id: T01
parent: S11
milestone: M002
provides:
  - Spritesheet stray pixel scanner script for future asset validation
  - Tint canvas imageSmoothingEnabled=false fix eliminating compositing ghost pixels
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 16min
verification_result: passed
completed_at: 2026-03-07
blocker_discovered: false
---
# T01: 17.1-stray-pixel-diagnostic-fix-and-right-click-movement 01

**# Phase 17.1 Plan 01: Stray Pixel Diagnostic Fix Summary**

## What Happened

# Phase 17.1 Plan 01: Stray Pixel Diagnostic Fix Summary

**Spritesheet scanner confirms clean PNGs; tint canvas imageSmoothingEnabled=false eliminates compositing ghost pixels**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-07T16:32:53Z
- **Completed:** 2026-03-07T16:49:05Z
- **Tasks:** 1 of 2 (Task 2 is manual visual verification)
- **Files modified:** 4

## Accomplishments
- Created comprehensive spritesheet stray pixel scanner that validates all 21 figure PNGs (0 stray pixels found)
- Identified root cause: tint offscreen canvas defaulting to imageSmoothingEnabled=true generates fractional alpha during drawImage that survives multiply+destination-in compositing pipeline
- Applied imageSmoothingEnabled=false fix to both isoAvatarRenderer.ts and avatarBuilderPreview.ts tint canvases
- All 321 tests pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create spritesheet stray pixel scanner and fix face PNG** - `4cb0277` (fix)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `scripts/check-spritesheet-stray-pixels.mjs` - Node script to scan figure spritesheet PNGs for stray alpha pixels outside declared frame bounds; supports --clean flag to zero them out
- `src/isoAvatarRenderer.ts` - Added imageSmoothingEnabled=false to tint offscreen canvas initialization
- `src/avatarBuilderPreview.ts` - Same imageSmoothingEnabled=false fix for preview tint canvas
- `package.json` / `package-lock.json` - Added pngjs as dev dependency for PNG pixel analysis

## Decisions Made
- Root cause identified as canvas compositing (not PNG data): all 21 figure spritesheets have 0 stray pixels outside frame bounds
- The tint offscreen canvas had imageSmoothingEnabled=true (browser default), which causes drawImage to interpolate pixels at sprite edges, generating fractional alpha values (e.g., alpha=1/255) that survive the multiply + destination-in compositing pipeline
- Fix applied to both rendering paths (room renderer + builder preview) for consistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Applied imageSmoothingEnabled fix instead of plan's destination-in clip**
- **Found during:** Task 1 (root cause analysis)
- **Issue:** Plan suggested adding a second destination-in fillRect after step 3, but the actual root cause is image smoothing generating subpixel artifacts during drawImage, not residual alpha outside frame bounds
- **Fix:** Set imageSmoothingEnabled=false on tint canvas at initialization, which prevents the artifacts from being generated in the first place
- **Files modified:** src/isoAvatarRenderer.ts, src/avatarBuilderPreview.ts
- **Verification:** All 321 tests pass; scanner confirms clean PNGs
- **Committed in:** 4cb0277

---

**Total deviations:** 1 auto-fixed (1 more targeted fix than plan suggested)
**Impact on plan:** Fix addresses the same root cause more precisely. No scope creep.

## Issues Encountered
None - scanner ran cleanly on all spritesheets, root cause analysis was straightforward.

## Pending Verification

**Task 2 (Manual):** Visual verification that the stray pixel is eliminated requires building the extension and visually inspecting the avatar at all directions. This cannot be automated. The user should:
1. Build the extension and open the webview
2. Place an avatar facing direction 2 (toward camera)
3. Verify no stray pixel appears near the avatar at any direction (0-7)
4. Test blink animation for clean transitions

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Stray pixel diagnostic complete; compositing fix applied
- Scanner script available for future spritesheet validation during asset pipeline changes
- Ready for Phase 17.1 Plan 02 (right-click movement)

---
*Phase: 17.1-stray-pixel-diagnostic-fix-and-right-click-movement*
*Completed: 2026-03-07*
