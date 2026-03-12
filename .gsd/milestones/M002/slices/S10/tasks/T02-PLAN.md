# T02: 17-bugfixes-and-wishlist 02

**Slice:** S10 — **Milestone:** M002

## Description

Fix stray pixel particle appearing when avatars face sideways directions, and ensure face features (eyes, mouth) are visually correct at all rendered angles.

Purpose: After Phase 14.1 added face rendering, a small pixel/particle appears approximately one tile away from the avatar at diagonal directions (1, 3, 5). Additionally, face detail at side angles may be insufficient or mispositioned. These bugs make face rendering visually distracting rather than enhancing avatar appearance.

Output: Modified face rendering logic in `isoAvatarRenderer.ts` that eliminates stray pixels and correctly positions face sprites at all directions, with matching fixes in `avatarBuilderPreview.ts`.

## Must-Haves

- [ ] "No stray pixel/particle appears when avatars face diagonal directions (1, 3, 5)"
- [ ] "Face features (eyes, mouth) are visually present and correctly positioned at all visible directions (mapped dirs 1, 2, 3 and their mirrored equivalents 4, 5)"
- [ ] "Face sprites align with the head sprite at every rendered direction — no offset drift"
- [ ] "Blink animation (eyb action) does not produce stray pixels at any direction"
- [ ] "Preview renderer in avatarBuilderPreview.ts stays consistent with main renderer changes"

## Files

- `src/isoAvatarRenderer.ts`
- `src/avatarBuilderPreview.ts`
- `tests/isoAvatarRenderer.test.ts`
