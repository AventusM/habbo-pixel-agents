# T02: 05-avatar-system 02

**Slice:** S05 — **Milestone:** M001

## Description

Implement walk cycle animation (4 frames at 250ms intervals), idle state with random blinks (3-frame overlay every 5-8 seconds), and Matrix-style spawn/despawn effects.

Purpose: Make avatars feel alive with smooth walk animations, subtle idle behaviors, and dramatic appearance/disappearance effects.

Output: Animated avatars with walk cycles, idle blinks, and cascading spawn/despawn effects fully integrated into the render loop.

## Must-Haves

- [ ] "Walk animation cycles through 4 frames at 250ms intervals"
- [ ] "Idle state shows single frame with 3-frame blink overlay"
- [ ] "Matrix spawn effect cascades downward on avatar appearance"
- [ ] "Despawn effect reverses cascade upward"

## Files

- `src/isoAvatarRenderer.ts`
- `scripts/generate-avatar-placeholders.sh`
- `assets/spritesheets/avatar_atlas.png`
- `assets/spritesheets/avatar_atlas.json`
- `tests/isoAvatarRenderer.test.ts`
