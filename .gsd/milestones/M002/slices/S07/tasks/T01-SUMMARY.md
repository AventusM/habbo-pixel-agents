---
id: T01
parent: S07
milestone: M002
provides:
  - hh_human_face asset in download/convert pipeline
  - ey and fc part types in PartType union
  - Face rendering in room renderer with direction filtering and blink
  - Face rendering in avatar builder preview
  - 8 new unit tests for face rendering logic
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 4min
verification_result: passed
completed_at: 2026-03-07
blocker_discovered: false
---
# T01: 14.1-avatar-facial-features 01

**# Phase 14.1 Plan 01: Avatar Facial Features Summary**

## What Happened

# Phase 14.1 Plan 01: Avatar Facial Features Summary

**Eyes and mouth added to 13-layer avatar composition using hh_human_face cortex-asset with blink animation via eyb action and direction-filtered rendering**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T10:57:03Z
- **Completed:** 2026-03-07T11:01:53Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Downloaded and converted hh_human_face asset (295 frames: 264 eye sprites + 31 mouth sprites)
- Extended avatar composition from 11 to 13 layers with ey (eyes) and fc (mouth) between head and hair
- Wired existing blinkFrame animation system to eyb eye action for visible blinks every 5-8 seconds
- Face correctly hidden for back-facing directions (0, 7) and visible for front/side (1, 2, 3)
- Avatar builder preview shows face features on direction 2

## Task Commits

Each task was committed atomically:

1. **Task 1: Add hh_human_face to asset pipeline and extend PartType with ey/fc** - `8df8c61` (feat)
2. **Task 2: Wire face rendering into room renderer and preview with blink integration and tests** - `ab1c6b3` (feat)

## Files Created/Modified
- `scripts/download-habbo-assets.mjs` - Added hh_human_face to FIGURE_ITEMS download list
- `src/avatarOutfitConfig.ts` - Extended PartType with ey/fc, added to outfitToFigureParts and getRequiredAssets
- `src/isoAvatarRenderer.ts` - Face rendering in createNitroAvatarRenderable with direction filtering and blink, updated render orders, DEFAULT_FIGURE_PARTS, getPartColor, DEBUG_PART_COLORS
- `src/avatarBuilderPreview.ts` - Face rendering in renderAvatarPreview with hh_human_face asset lookup
- `tests/isoAvatarRenderer.test.ts` - 8 new face tests: frame keys, direction filtering, blink action, setId mapping, tint colors, PartType inclusion, getRequiredAssets
- `tests/avatarOutfitConfig.test.ts` - Updated existing tests for 13-part system (was 11)

## Decisions Made
- Eyes use white multiply identity (#FFFFFF) for tinting -- preserves pre-colored pupil/sclera pixel detail
- Mouth uses skin color tinting -- standard Habbo approach for face/mouth sprites
- Eye setId mapped from variant via `(variant % 11) + 1` for visual variety across 11 eye styles
- Face direction filtering uses the same mapBodyDirection result, just skips dirs 0 and 7

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing test assertion for getRequiredAssets count**
- **Found during:** Task 2 (test suite run)
- **Issue:** Existing test expected 4 unique assets but Task 1 added hh_human_face, making it 5
- **Fix:** Updated expected count from 4 to 5 and updated test description from "11 PartType entries" to "13 PartType entries"
- **Files modified:** tests/avatarOutfitConfig.test.ts
- **Verification:** Full test suite passes (317 tests)
- **Committed in:** ab1c6b3 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Test assertion update was a direct consequence of adding hh_human_face to getRequiredAssets. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Face rendering is complete and integrated into both room renderer and builder preview
- Expression system (sml, agr, srp, sad, spk) deferred -- currently defaults to std expression
- Eye style selection in builder deferred -- currently mapped from variant automatically
- Full test suite green: 317 tests passing across 20 test files

## Self-Check: PASSED

All 8 key files verified present. Both task commits (8df8c61, ab1c6b3) verified in git history.

---
*Phase: 14.1-avatar-facial-features*
*Completed: 2026-03-07*
