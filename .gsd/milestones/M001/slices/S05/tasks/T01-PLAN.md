# T01: 05-avatar-system 01

**Slice:** S05 — **Milestone:** M001

## Description

Create avatar renderer with 8-direction support, 3-4 layer sprite composition, and 6 palette variants using placeholder sprites for visual validation.

Purpose: Enable rendering of Habbo-style characters facing all 8 directions with distinct palette variants, establishing the foundation for walk cycles and animations in Plan 02.

Output: Avatar renderer module with placeholder sprite atlas demonstrating 8-direction rendering and 6-variant system.

## Must-Haves

- [ ] "Avatar sprites render in 8 facing directions"
- [ ] "6 palette variants produce visually distinct characters"
- [ ] "Sprite composition uses 3-4 layers (body, clothing, head, hair)"

## Files

- `src/isoAvatarRenderer.ts`
- `tests/isoAvatarRenderer.test.ts`
- `scripts/generate-avatar-placeholders.sh`
- `assets/spritesheets/avatar_atlas.png`
- `assets/spritesheets/avatar_atlas.json`
