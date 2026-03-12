# S12: Fix Walking Animation Clipping And Layer Artifacts

**Goal:** Fix two walking animation bugs in the avatar renderer: (1) chest/shirt sprite not tracking body walk-frame bounce, causing skin pixels to bleed through clothing, and (2) potential doubled-hand artifact in flipped directions due to hand/sleeve offset misalignment.
**Demo:** Fix two walking animation bugs in the avatar renderer: (1) chest/shirt sprite not tracking body walk-frame bounce, causing skin pixels to bleed through clothing, and (2) potential doubled-hand artifact in flipped directions due to hand/sleeve offset misalignment.

## Must-Haves


## Tasks

- [x] **T01: 17.2-fix-walking-animation-clipping-and-layer-artifacts 01** `est:2min`
  - Fix two walking animation bugs in the avatar renderer: (1) chest/shirt sprite not tracking body walk-frame bounce, causing skin pixels to bleed through clothing, and (2) potential doubled-hand artifact in flipped directions due to hand/sleeve offset misalignment.

Purpose: Walking avatars currently show visual glitches that break the Habbo aesthetic fidelity.
Output: Corrected avatar renderer with regression tests.

## Files Likely Touched

- `src/isoAvatarRenderer.ts`
- `tests/isoAvatarRenderer.test.ts`
