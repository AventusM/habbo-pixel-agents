# S11: Stray Pixel Diagnostic Fix And Right Click Movement

**Goal:** Diagnose and fix the stray pixel artifact that appears near avatars at direction 2 (facing camera).
**Demo:** Diagnose and fix the stray pixel artifact that appears near avatars at direction 2 (facing camera).

## Must-Haves


## Tasks

- [x] **T01: 17.1-stray-pixel-diagnostic-fix-and-right-click-movement 01** `est:16min`
  - Diagnose and fix the stray pixel artifact that appears near avatars at direction 2 (facing camera).

Purpose: The clearRect fix from 17-02 addressed tint canvas residuals but the pixel persists. Static analysis shows all 13 sprite positions render within expected bounds. The root cause is likely a stray pixel baked into the face spritesheet PNG or a canvas compositing edge case. A diagnostic script + enhanced debug logging will identify the exact source.

Output: Clean avatar rendering with no stray pixels at any direction.
- [x] **T02: 17.1-stray-pixel-diagnostic-fix-and-right-click-movement 02** `est:1min`
  - Change the interaction model so left-click selects avatars and right-click moves them.

Purpose: Users want to left-click avatars to open the builder panel and right-click to move avatars. Currently left-click does both (select then move), which is confusing. Separating click types makes both actions single-click and non-conflicting.

Output: Modified `RoomCanvas.tsx` with right-click movement via `onContextMenu` handler.

## Files Likely Touched

- `src/isoAvatarRenderer.ts`
- `src/avatarBuilderPreview.ts`
- `scripts/check-spritesheet-stray-pixels.mjs`
- `src/RoomCanvas.tsx`
