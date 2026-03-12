# T06: 16-agent-factory-workflow 06

**Slice:** S09 — **Milestone:** M002

## Description

Wire the room layout engine, section management, and teleport effects into the live rendering pipeline.

Purpose: This plan brings all Wave 1-2 foundation pieces together: the multi-section floor renders, agents spawn at teleport booths, and sections are functional. Includes the full spawn AND despawn teleport flow per CONTEXT.md decisions.
Output: Working multi-section room with section-aware agent spawning, despawning, and teleport effects.

## Must-Haves

- [ ] "Room renders with the 2x2 section layout template instead of DEMO_HEIGHTMAP"
- [ ] "Agents spawn at their assigned section's teleport booth tile"
- [ ] "Teleport flash effect plays on agent spawn"
- [ ] "Agents despawn by walking to teleport booth, playing flash effect, then being removed"
- [ ] "Section furniture renders correctly in all 4 zones"
- [ ] "Template size auto-selected or configurable via settings"

## Files

- `src/webview.tsx`
- `src/RoomCanvas.tsx`
- `src/avatarManager.ts`
- `src/sectionManager.ts`
