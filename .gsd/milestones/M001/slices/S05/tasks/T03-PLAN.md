# T03: 05-avatar-system 03

**Slice:** S05 — **Milestone:** M001

## Description

Integrate avatar rendering with BFS pathfinding by converting tile paths to screen positions, setting avatar direction based on movement deltas, and drawing parent/child relationship lines.

Purpose: Make avatars walk along logical tile paths with correct facing direction and visualize agent hierarchy relationships.

Output: Avatars moving along BFS paths with automatic direction updates and parent/child lines connecting related avatars.

## Must-Haves

- [ ] "Avatar screen positions computed via tileToScreen(tileX, tileY, tileZ)"
- [ ] "BFS pathfinding unchanged - only position conversion modified"
- [ ] "Parent/child lines drawn from foot position to foot position"
- [ ] "Avatar direction set by getDirection(fromX, fromY, toX, toY) on path steps"

## Files

- `src/isoAgentBehavior.ts`
- `src/RoomCanvas.tsx`
- `tests/isoAgentBehavior.test.ts`
