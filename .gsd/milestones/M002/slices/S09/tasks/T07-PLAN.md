# T07: 16-agent-factory-workflow 07

**Slice:** S09 — **Milestone:** M002

## Description

Add role-based outfit presets and role-specific idle behaviors so agents visually match their team and behave appropriately when idle.

Purpose: Visual and behavioral differentiation makes agents recognizable. Planners look and act different from coders.
Output: Role outfit presets in avatarOutfitConfig, role-specific idle behavior in IdleWanderManager.

## Must-Haves

- [ ] "Each team role has a distinct default outfit preset"
- [ ] "Agents assigned to a team get the correct role-based outfit on spawn"
- [ ] "Coders sit at desks when idle, Planners pace near conference tables, Researchers browse bookshelves"

## Files

- `src/avatarOutfitConfig.ts`
- `src/idleWander.ts`
- `src/RoomCanvas.tsx`
