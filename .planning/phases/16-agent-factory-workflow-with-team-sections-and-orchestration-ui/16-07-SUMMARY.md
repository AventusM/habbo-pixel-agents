---
phase: 16-agent-factory-workflow
plan: 07
subsystem: ui
tags: [avatar, outfit, idle-behavior, team-section, habbo]

# Dependency graph
requires:
  - phase: 16-05
    provides: "Agent classification pipeline with team assignments"
  - phase: 14-avatar-builder-ui
    provides: "OutfitConfig types, catalog, default presets"
provides:
  - "ROLE_OUTFIT_PRESETS for 4 team sections"
  - "getRolePreset() with variant skin cycling"
  - "RoleIdleBehavior type and role-specific idle logic"
  - "Section-aware idle wandering with SectionManager integration"
affects: [16-08, 16-09]

# Tech tracking
tech-stack:
  added: []
  patterns: [role-based-outfit-mapping, section-aware-idle-behavior]

key-files:
  created: []
  modified:
    - src/avatarOutfitConfig.ts
    - src/idleWander.ts
    - src/RoomCanvas.tsx

key-decisions:
  - "ROLE_OUTFIT_PRESETS uses existing catalog setIds with distinct color schemes per team"
  - "Core Dev idle behavior: preferentially sit at desk chairs via SectionManager.getDeskTile()"
  - "Planning idle behavior: pace with 8-12s pauses (longer than default 4-10s)"
  - "Infrastructure/Support use default wander behavior within section bounds"

patterns-established:
  - "Role-to-behavior mapping: getIdleBehaviorForTeam() centralizes team->behavior logic"
  - "SectionManager as optional tick() parameter for backward compatibility"

requirements-completed: [AF-18, AF-19]

# Metrics
duration: 3min
completed: 2026-03-08
---

# Phase 16 Plan 07: Role Outfits and Idle Behaviors Summary

**Role-based outfit presets with team-specific idle behaviors: coders sit at desks, planners pace between positions, others wander within section bounds**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-08T13:17:16Z
- **Completed:** 2026-03-08T13:20:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- ROLE_OUTFIT_PRESETS with visually distinct outfits per TeamSection (planning/cardigan+navy, core-dev/tshirt+green, infra/sleeved+earth, support/schoolshirt+gray)
- getRolePreset() cycles through skin palette for variant-based variety within teams
- Role-specific idle behaviors: Core Dev agents preferentially sit at desk chairs, Planning agents pace with longer 8-12s pauses, others wander
- SectionManager integration in tick() for section-aware tile targeting

## Task Commits

Each task was committed atomically:

1. **Task 1: Create role-based outfit presets** - `62a36d5` (feat)
2. **Task 2: Implement role-specific idle behaviors** - `1d27727` (feat)

## Files Created/Modified
- `src/avatarOutfitConfig.ts` - ROLE_OUTFIT_PRESETS, ROLE_ACCESSORY_PRESETS, getRolePreset()
- `src/idleWander.ts` - RoleIdleBehavior type, setAgentRole(), getIdleTargetForRole(), findChairAtTile()
- `src/RoomCanvas.tsx` - Wire setAgentRole on agentCreated, pass sectionManager to tick()

## Decisions Made
- Used existing catalog setIds from avatarOutfitConfig.ts (no new cortex-assets needed)
- Core Dev agents get highest chair-seeking probability via sit-at-desk behavior
- Planning agents get longer pause delay (8-12s vs 4-10s default) for deliberate pacing feel
- ROLE_ACCESSORY_PRESETS defined as empty arrays for future extension without blocking

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Role outfits and idle behaviors ready for Plan 08 (orchestration panel UI)
- All 390 existing tests continue to pass

---
*Phase: 16-agent-factory-workflow*
*Completed: 2026-03-08*
