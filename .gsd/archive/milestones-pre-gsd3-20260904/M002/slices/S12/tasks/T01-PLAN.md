# T01: 17.2-fix-walking-animation-clipping-and-layer-artifacts 01

**Slice:** S12 — **Milestone:** M002

## Description

Fix two walking animation bugs in the avatar renderer: (1) chest/shirt sprite not tracking body walk-frame bounce, causing skin pixels to bleed through clothing, and (2) potential doubled-hand artifact in flipped directions due to hand/sleeve offset misalignment.

Purpose: Walking avatars currently show visual glitches that break the Habbo aesthetic fidelity.
Output: Corrected avatar renderer with regression tests.

## Must-Haves

- [ ] "Chest/shirt sprite tracks body bounce during walk animation with no skin pixel bleed-through"
- [ ] "Head and hair parts track body bounce during walk animation"
- [ ] "No doubled-hand artifact visible in flipped directions (4, 5, 6)"
- [ ] "Idle and sit rendering remain visually unchanged (zero delta applied)"

## Files

- `src/isoAvatarRenderer.ts`
- `tests/isoAvatarRenderer.test.ts`
