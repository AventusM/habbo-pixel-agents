---
phase: 05-avatar-system
plan: 02
subsystem: rendering
tags: [canvas-2d, animation, sprites, rAF]

# Dependency graph
requires:
  - phase: 05-01
    provides: 8-direction avatar renderer with multi-layer composition and placeholder sprites
provides:
  - Walk cycle animation (4 frames at 250ms intervals)
  - Idle state with random blinks (3-frame overlay every 5-8 seconds)
  - Matrix-style spawn/despawn cascade effects
  - updateAvatarAnimation timing function
  - 184 placeholder sprites (idle, walk, blink)
affects: [05-03-pathfinding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Animation state stored in AvatarSpec (lastUpdateMs, nextBlinkMs, blinkFrame, spawnProgress)"
    - "updateAvatarAnimation called each rAF frame before rendering"
    - "Avatars render dynamically on main canvas, NOT pre-rendered to OffscreenCanvas"
    - "Spawn/despawn effects use ctx.save()/restore() with clip regions"

key-files:
  created:
    - assets/spritesheets/avatar_atlas.png (1536×1536px, 184 sprites)
    - assets/spritesheets/avatar_atlas.json (184 frame entries)
  modified:
    - src/isoAvatarRenderer.ts (animation timing logic + spawn clipping)
    - src/RoomCanvas.tsx (animation loop integration)
    - scripts/generate-avatar-placeholders.sh (walk cycles + blink overlays)
    - tests/isoAvatarRenderer.test.ts (8 animation tests)

key-decisions:
  - "Use else-if guard to prevent blink frame advancing twice on trigger frame"
  - "Test spawn progress before transition to idle (spawnProgress resets on state change)"
  - "Generate only variant 0 for minimal atlas (full 6 variants deferred to future)"
  - "Walk frames use horizontal offset (-3, -1, 1, 3 pixels) to simulate leg motion"

patterns-established:
  - "Animation timing via elapsed time delta (currentTimeMs - lastUpdateMs)"
  - "Random blink scheduling using Math.random() within min/max interval"
  - "Linear spawn progress over 1-second duration"
  - "Frame state determines sprite key suffix (idle_0 vs walk_0-3)"

requirements-completed: [AVAT-02, AVAT-03, AVAT-07]

# Metrics
duration: 6min
completed: 2026-03-01
---

# Phase 05 Plan 02: Animation and Effects Summary

**Walk cycle animation (4 FPS), idle blinks (5-8s intervals), and Matrix spawn effects with 184 placeholder sprites (idle, walk, blink overlays)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-28T23:22:17Z
- **Completed:** 2026-03-01T01:28:45Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Walk cycle animation advances frames 0->3 every 250ms (4 FPS)
- Idle state triggers random blinks every 5-8 seconds with 3-frame overlay
- Matrix spawn/despawn effects cascade via clip region clipping
- updateAvatarAnimation function handles all timing logic in-place mutation
- 184 placeholder sprites generated (32 idle + 128 walk + 24 blink)
- Animation loop integrated into RoomCanvas with updateAvatarAnimation called each frame
- Test avatars demonstrate spawn, walk, and idle states simultaneously

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend avatar renderer with walk cycle and idle blink animation logic** - `53d65d2` (feat)
2. **Task 2: Generate walk cycle and blink overlay placeholder sprites** - `93c729e` (feat)
3. **Task 3: Integrate animation loop into RoomCanvas with spawning demo** - `4250df6` (feat)

## Files Created/Modified
- `src/isoAvatarRenderer.ts` - Added animation timing constants, updateAvatarAnimation function, spawn/despawn clipping, blink overlay rendering
- `tests/isoAvatarRenderer.test.ts` - Added 8 animation timing tests (walk cycle, blink timing, spawn progress)
- `scripts/generate-avatar-placeholders.sh` - Extended to generate 4-frame walk cycles and 3-frame blink overlays (184 total sprites)
- `assets/spritesheets/avatar_atlas.png` - Regenerated 1536×1536px atlas with walk and blink sprites
- `assets/spritesheets/avatar_atlas.json` - Updated manifest with 184 frame entries
- `src/RoomCanvas.tsx` - Integrated updateAvatarAnimation in rAF loop, removed static avatar pre-rendering

## Decisions Made
- **Minimal variant set:** Generated only variant 0 (instead of all 6) to keep atlas manageable - full variants deferred to future iteration
- **Walk leg motion:** Used horizontal offset variation (-3, -1, 1, 3 pixels) to simulate leg motion in placeholder sprites
- **Spawn duration:** Set spawn effect duration to 1 second (arbitrary but visually pleasing)
- **Blink overlay rendering:** Blink frames rendered as separate overlay sprites after all layers, not integrated into layer composition

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed blink frame advancement race condition**
- **Found during:** Task 1 (Animation timing tests)
- **Issue:** When blink triggers, both trigger condition and frame advancement condition were true in same update, causing blinkFrame to jump from 0 to 2 instead of 1
- **Fix:** Changed second condition from `if` to `else if` to prevent both branches executing in same frame
- **Files modified:** src/isoAvatarRenderer.ts
- **Verification:** Test "idle triggers blink when nextBlinkMs is reached" passes, blinkFrame correctly set to 1
- **Committed in:** 53d65d2 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed spawn progress test expectations**
- **Found during:** Task 1 (Animation timing tests)
- **Issue:** Test expected spawnProgress to be 1.0 after transition to idle, but state transition resets spawnProgress to 0
- **Fix:** Updated test to check progress at 999ms (still spawning) instead of 1000ms (transitioned to idle)
- **Files modified:** tests/isoAvatarRenderer.test.ts
- **Verification:** Test "spawning progress increments toward 1.0" passes, correctly validates progress before transition
- **Committed in:** 53d65d2 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None - plan executed smoothly with only 2 minor bug fixes during test development.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Animation system complete and ready for pathfinding integration (Plan 03)
- Walk cycles animate smoothly at 4 FPS with no performance issues
- Idle blinks trigger randomly as expected
- Spawn effects cascade correctly from top to bottom
- All 14 animation tests passing, 105 total tests passing
- Ready for BFS pathfinding that will drive avatar movement and state transitions

## Self-Check: PASSED

All claims verified:
- ✓ assets/spritesheets/avatar_atlas.png exists
- ✓ assets/spritesheets/avatar_atlas.json exists
- ✓ Commit 53d65d2 exists (Task 1)
- ✓ Commit 93c729e exists (Task 2)
- ✓ Commit 4250df6 exists (Task 3)
- ✓ All 105 tests passing
- ✓ TypeScript type checking passes
- ✓ Build completes successfully

---
*Phase: 05-avatar-system*
*Completed: 2026-03-01*
