---
phase: 16-agent-factory-workflow
plan: 06
subsystem: room-rendering
tags: [canvas2d, section-manager, teleport-effect, agent-spawning, room-layout]

requires:
  - phase: 16-agent-factory-workflow plan 02
    provides: Room layout engine with section grid templates
  - phase: 16-agent-factory-workflow plan 04
    provides: Teleport flash effect and section furniture placement
  - phase: 16-agent-factory-workflow plan 05
    provides: Classification-integrated agent tracking with team assignment
provides:
  - SectionManager for agent-to-section tracking with tile lookups
  - Template-based room layout replacing DEMO_HEIGHTMAP
  - Section-aware spawn at teleport booths with flash effects
  - Walk-to-booth despawn flow with teleport flash
  - Section furniture populated into render pipeline
affects: [16-07, 16-08, 16-09, room-rendering]

tech-stack:
  added: []
  patterns: [section-manager-pattern, walk-to-booth-despawn, template-based-layout]

key-files:
  created:
    - src/sectionManager.ts
  modified:
    - src/webview.tsx
    - src/RoomCanvas.tsx
    - src/avatarManager.ts

key-decisions:
  - "Lazy SectionManager initialization from global floorTemplate"
  - "Walk-to-booth despawn with 500ms delay for teleport flash effect"
  - "Section furniture populated into render state from template on canvas init"

patterns-established:
  - "SectionManager as central agent-to-section mapping service"
  - "spawnAvatarAt for predetermined tile placement"
  - "despawningAgentsRef set to prevent idle wander interference during despawn walk"

requirements-completed: [AF-15, AF-16, AF-17]

duration: 3min
completed: 2026-03-08
---

# Phase 16 Plan 06: Room Layout Integration and Teleport Spawning Summary

**SectionManager wiring template layout into live rendering with section-aware agent spawning at teleport booths, walk-to-booth despawn flow, and teleport flash effects (390 tests passing)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-08T13:12:06Z
- **Completed:** 2026-03-08T13:15:23Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created SectionManager tracking agents per section with spawn/desk/idle tile lookups
- Replaced DEMO_HEIGHTMAP with generateFloorTemplate('small') template-based layout
- Agents spawn at their team's teleport booth tile with radial gradient flash effect
- Walk-to-booth despawn: agents pathfind to booth, flash effect plays, then removed after 500ms
- Section-aware desk lookup replaces hardcoded DESK_TILES array
- Section furniture from all 4 zones populated into the render pipeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SectionManager and wire layout into webview** - `079e49b` (feat)
2. **Task 2: Section-aware spawning, despawning, and teleport effects in RoomCanvas** - `dd1a504` (feat)

## Files Created/Modified
- `src/sectionManager.ts` - SectionManager class with agent assignment, spawn/desk/idle tile lookups
- `src/webview.tsx` - Template-based layout replacing DEMO_HEIGHTMAP, template size change listener
- `src/RoomCanvas.tsx` - Section-aware spawn/despawn, teleport effects in frame loop, section furniture init
- `src/avatarManager.ts` - spawnAvatarAt method for predetermined tile placement

## Decisions Made
- Lazy SectionManager initialization from global floorTemplate (set in webview.tsx, read in RoomCanvas)
- Walk-to-booth despawn uses 500ms setTimeout after teleport flash creation for smooth animation
- Section furniture from template sections pushed into render state furniture array on canvas init
- despawningAgentsRef prevents idle wander and status updates from interfering with booth walk

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Section-aware agent lifecycle complete: spawn at booth, work at section desks, despawn via booth
- SectionManager ready for orchestration panel consumption (Plan 07-08)
- Template size configurable via extension message for future settings UI

---
*Phase: 16-agent-factory-workflow*
*Completed: 2026-03-08*

## Self-Check: PASSED
