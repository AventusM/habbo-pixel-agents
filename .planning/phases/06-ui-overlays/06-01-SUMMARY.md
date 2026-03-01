---
phase: 06-ui-overlays
plan: 01
subsystem: ui
tags: [canvas2d, speech-bubble, word-wrap, animation]

# Dependency graph
requires:
  - phase: 05-avatar-system
    provides: Avatar rendering with AvatarSpec interface and position tracking
  - phase: 01-coordinate-foundation
    provides: tileToScreen coordinate conversion for bubble anchoring
provides:
  - Speech bubble renderer with Canvas 2D roundRect and word wrapping
  - Waiting animation (cycling dots at 500ms intervals)
  - RoomCanvas integration rendering bubbles above avatars
affects: [06-ui-overlays, 07-agent-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [canvas-2d-roundrect, word-boundary-wrapping, pixel-perfect-flooring]

key-files:
  created:
    - src/isoBubbleRenderer.ts
    - tests/isoBubbleRenderer.test.ts
  modified:
    - src/RoomCanvas.tsx

key-decisions:
  - "Use Canvas 2D native roundRect() API (not manual arc paths)"
  - "Word wrapping splits at spaces only (no mid-word breaks)"
  - "Single long words allowed to overflow (no truncation)"
  - "Math.floor() all text coordinates to avoid sub-pixel blur"
  - "Waiting animation cycles 1-3 dots based on currentTimeMs % 1500"

patterns-established:
  - "UI overlays render after depth-sorted avatars (always on top)"
  - "Camera origin offset applied via ctx.translate before overlay rendering"
  - "ctx.font set before measureText for accurate width calculation"

requirements-completed: [UI-01, UI-02, UI-03]

# Metrics
duration: 4min
completed: 2026-03-01
---

# Phase 06-01: Speech Bubble Renderer Summary

**Speech bubble renderer with Canvas 2D roundRect, word wrapping at spaces, and waiting animation cycling 1-3 dots every 500ms**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-01T17:29:20Z
- **Completed:** 2026-03-01T17:33:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Implemented isoBubbleRenderer.ts with wrapText and drawSpeechBubble exports
- All 9 unit tests passing (word wrap, waiting animation, positioning, pixel-perfect rendering)
- Integrated speech bubbles into RoomCanvas frame loop rendering after avatars
- Demo text shows avatar ID and state, idle avatars display animated waiting bubble

## Task Commits

Each task was committed atomically:

1. **Task 1: Create speech bubble renderer** - `15ae4cb` (feat)
2. **Task 2: Integrate speech bubbles into RoomCanvas** - `0039627` (feat)

## Files Created/Modified
- `src/isoBubbleRenderer.ts` - Speech bubble rendering with roundRect, word wrapping, and waiting animation
- `tests/isoBubbleRenderer.test.ts` - 9 unit tests for word wrap logic and rendering behavior
- `src/RoomCanvas.tsx` - Speech bubble rendering loop after parent-child lines

## Decisions Made
- Used Canvas 2D native roundRect() API instead of manual arc/curve paths (simpler, widely supported since April 2023)
- Word wrapping splits at word boundaries (spaces) only, never mid-word
- Single long words allowed to overflow maxWidth (no truncation for readability)
- All text coordinates use Math.floor() to avoid sub-pixel blur
- Waiting animation formula: '.'.repeat(Math.floor((currentTimeMs % 1500) / 500) + 1) produces 1-3 dots cycling every 500ms

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Speech bubbles render correctly above avatars with white background and black border
- Waiting animation confirmed cycling (idle avatars show "...")
- Ready for Plan 06-02 (name tags) to render before speech bubbles
- Font currently falls back to system font - Plan 06-03 will bundle Press Start 2P for authentic pixel rendering

---
*Phase: 06-ui-overlays*
*Completed: 2026-03-01*
