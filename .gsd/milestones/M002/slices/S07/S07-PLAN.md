# S07: Avatar Facial Features Add Eyes And Mouth To Avatar Head Rendering

**Goal:** Add eyes and mouth to avatar head rendering by integrating the `hh_human_face` cortex-asset into the existing 11-layer figure composition, making it a 13-layer system.
**Demo:** Add eyes and mouth to avatar head rendering by integrating the `hh_human_face` cortex-asset into the existing 11-layer figure composition, making it a 13-layer system.

## Must-Haves


## Tasks

- [x] **T01: 14.1-avatar-facial-features 01** `est:4min`
  - Add eyes and mouth to avatar head rendering by integrating the `hh_human_face` cortex-asset into the existing 11-layer figure composition, making it a 13-layer system. Eyes use the existing blinkFrame animation system for visible blinks. Face sprites only render on front/side-facing directions (1, 2, 3 and mirrors 4, 5).

Purpose: Avatars currently render as blank ovals -- adding face features gives each avatar personality and makes the Habbo aesthetic authentic.
Output: Updated renderer with face layers, updated preview, new unit tests, face asset in download pipeline.

## Files Likely Touched

- `scripts/download-habbo-assets.mjs`
- `src/avatarOutfitConfig.ts`
- `src/isoAvatarRenderer.ts`
- `src/avatarBuilderPreview.ts`
- `src/AvatarBuilderModal.tsx`
- `tests/isoAvatarRenderer.test.ts`
