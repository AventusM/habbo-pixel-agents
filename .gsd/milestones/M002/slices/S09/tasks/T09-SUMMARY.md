---
phase: 16-agent-factory-workflow
plan: 09
subsystem: ui
tags: [popup-cards, furniture-activity, auto-follow-camera, role-outfits, avatar-builder]

requires:
  - phase: 16-06
    provides: "SectionManager with agent-to-section tracking"
  - phase: 16-07
    provides: "ROLE_OUTFIT_PRESETS for team-specific outfits"
  - phase: 16-08
    provides: "MessageBridge and orchestration sidebar"
provides:
  - "Agent popup cards with team/role/status info on click"
  - "Activity-linked furniture overlays (monitor glow, lamp warmth)"
  - "Auto-follow camera tracking most active section"
  - "Role Outfits tab in Avatar Builder for team preset customization"
  - "jumpToSection message handling in room canvas"
affects: []

tech-stack:
  added: []
  patterns: [furniture-activity-overlay, popup-card-ui, auto-follow-lerp-camera]

key-files:
  created: []
  modified:
    - src/RoomCanvas.tsx
    - src/isoFurnitureRenderer.ts
    - src/AvatarBuilderModal.tsx
    - src/sectionManager.ts

key-decisions:
  - "Popup card auto-dismisses after 5 seconds; second click on same agent opens builder"
  - "Furniture activity overlay uses lighter composite operation for non-destructive glow"
  - "Auto-follow camera checks every 3 seconds with 10% per-frame lerp for smooth pan"
  - "Role Outfits tab preserves skin color when applying presets for visual continuity"
  - "Activity defined as agentTool events within last 10 seconds for furniture glow"

patterns-established:
  - "drawAgentPopup: team-colored header card with role/status at avatar head position"
  - "drawFurnitureActiveOverlay: per-type glow effects (lighter composite, radial gradient)"
  - "autoFollowRef with lerp target for smooth automated camera movement"

requirements-completed: [AF-20, AF-25, AF-26, AF-27, AF-28]

duration: 6min
completed: 2026-03-08
---

# Phase 16 Plan 09: Final Integration and Polish Summary

**Agent popup cards, activity-linked furniture glows, Role Outfits tab in Avatar Builder, and auto-follow camera completing the Phase 16 feature set**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-08T13:29:17Z
- **Completed:** 2026-03-08T13:35:20Z
- **Tasks:** 3 (2 auto + 1 auto-approved checkpoint)
- **Files modified:** 4

## Accomplishments
- Agent popup cards show team, role, and status when clicking avatars in the room canvas
- Monitor furniture (tv_flat) glows blue-white when section agents are active; lamps (hc_lmp) emit warm yellow radial gradient
- Avatar Builder gains Role Outfits tab with 4 team preset cards, apply/reset functionality
- Auto-follow camera smoothly pans to track the most active section every 3 seconds
- jumpToSection messages from sidebar properly navigate room camera to section center

## Task Commits

Each task was committed atomically:

1. **Task 1: Agent popup cards and activity-linked furniture** - `fd7d24e` (feat)
2. **Task 2: Avatar Builder role outfits tab (AF-20)** - `c51a508` (feat)
3. **Task 3: Visual verification** - Auto-approved (auto mode)

## Files Created/Modified
- `src/RoomCanvas.tsx` - Agent popup cards (drawAgentPopup), auto-follow camera with lerp, furniture activity overlays, jumpToSection/autoFollow message handling, agentClicked extension notification
- `src/isoFurnitureRenderer.ts` - FurnitureState interface, drawFurnitureActiveOverlay for tv_flat (lighter composite glow) and hc_lmp (radial gradient warmth)
- `src/AvatarBuilderModal.tsx` - Role Outfits tab with 4 team presets, apply/reset buttons, team highlight indicator, Clothing/Role Outfits tab switcher
- `src/sectionManager.ts` - getMostActiveSection(), updateActivity(), getSectionCenter(), getSectionState(), getAllSections()

## Decisions Made
- Popup card auto-dismisses after 5 seconds to avoid UI clutter; second click on same agent opens the builder for deeper customization
- Furniture activity overlay uses `globalCompositeOperation = 'lighter'` with low alpha for non-destructive additive glow that works on any background
- Auto-follow camera uses 10% per-frame lerp for smooth pan rather than instant jump, checked every 3 seconds
- Role Outfits tab preserves current skin color when applying team presets, maintaining avatar identity
- Activity threshold for furniture glow is 10 seconds since last agentTool event in that section

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 16 feature set complete: 4-section room layout, camera pan/zoom, orchestration sidebar, teleport spawning, role outfits, popup cards, furniture activity states
- All 399 tests passing
- Ready for Phase 16 completion and visual verification

---
*Phase: 16-agent-factory-workflow*
*Completed: 2026-03-08*

## Self-Check: PASSED
