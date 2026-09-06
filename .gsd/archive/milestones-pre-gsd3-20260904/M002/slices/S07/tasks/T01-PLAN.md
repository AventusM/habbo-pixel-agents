# T01: 14.1-avatar-facial-features 01

**Slice:** S07 — **Milestone:** M002

## Description

Add eyes and mouth to avatar head rendering by integrating the `hh_human_face` cortex-asset into the existing 11-layer figure composition, making it a 13-layer system. Eyes use the existing blinkFrame animation system for visible blinks. Face sprites only render on front/side-facing directions (1, 2, 3 and mirrors 4, 5).

Purpose: Avatars currently render as blank ovals -- adding face features gives each avatar personality and makes the Habbo aesthetic authentic.
Output: Updated renderer with face layers, updated preview, new unit tests, face asset in download pipeline.

## Must-Haves

- [ ] "Avatars display eyes and mouth when facing directions 1, 2, 3, 4, 5 (front/side)"
- [ ] "Avatars show blank head (no face) when facing directions 0, 6, 7 (back of head)"
- [ ] "Eye blink animation is visible -- eyes close momentarily every 5-8 seconds"
- [ ] "Eyes retain their pixel detail (not tinted with skin color)"
- [ ] "Mouth is tinted to match avatar skin tone"
- [ ] "Avatar builder preview shows face features"
- [ ] "Face renders correctly on flipped directions (4, 5)"

## Files

- `scripts/download-habbo-assets.mjs`
- `src/avatarOutfitConfig.ts`
- `src/isoAvatarRenderer.ts`
- `src/avatarBuilderPreview.ts`
- `src/AvatarBuilderModal.tsx`
- `tests/isoAvatarRenderer.test.ts`
