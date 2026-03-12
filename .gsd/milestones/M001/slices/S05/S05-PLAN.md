# S05: Avatar System

**Goal:** Create avatar renderer with 8-direction support, 3-4 layer sprite composition, and 6 palette variants using placeholder sprites for visual validation.
**Demo:** Create avatar renderer with 8-direction support, 3-4 layer sprite composition, and 6 palette variants using placeholder sprites for visual validation.

## Must-Haves


## Tasks

- [x] **T01: 05-avatar-system 01**
  - Create avatar renderer with 8-direction support, 3-4 layer sprite composition, and 6 palette variants using placeholder sprites for visual validation.

Purpose: Enable rendering of Habbo-style characters facing all 8 directions with distinct palette variants, establishing the foundation for walk cycles and animations in Plan 02.

Output: Avatar renderer module with placeholder sprite atlas demonstrating 8-direction rendering and 6-variant system.
- [x] **T02: 05-avatar-system 02** `est:6min`
  - Implement walk cycle animation (4 frames at 250ms intervals), idle state with random blinks (3-frame overlay every 5-8 seconds), and Matrix-style spawn/despawn effects.

Purpose: Make avatars feel alive with smooth walk animations, subtle idle behaviors, and dramatic appearance/disappearance effects.

Output: Animated avatars with walk cycles, idle blinks, and cascading spawn/despawn effects fully integrated into the render loop.
- [x] **T03: 05-avatar-system 03** `est:3min`
  - Integrate avatar rendering with BFS pathfinding by converting tile paths to screen positions, setting avatar direction based on movement deltas, and drawing parent/child relationship lines.

Purpose: Make avatars walk along logical tile paths with correct facing direction and visualize agent hierarchy relationships.

Output: Avatars moving along BFS paths with automatic direction updates and parent/child lines connecting related avatars.

## Files Likely Touched

- `src/isoAvatarRenderer.ts`
- `tests/isoAvatarRenderer.test.ts`
- `scripts/generate-avatar-placeholders.sh`
- `assets/spritesheets/avatar_atlas.png`
- `assets/spritesheets/avatar_atlas.json`
- `src/isoAvatarRenderer.ts`
- `scripts/generate-avatar-placeholders.sh`
- `assets/spritesheets/avatar_atlas.png`
- `assets/spritesheets/avatar_atlas.json`
- `tests/isoAvatarRenderer.test.ts`
- `src/isoAgentBehavior.ts`
- `src/RoomCanvas.tsx`
- `tests/isoAgentBehavior.test.ts`
