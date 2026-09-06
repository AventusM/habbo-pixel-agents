# T01: 17.1-stray-pixel-diagnostic-fix-and-right-click-movement 01

**Slice:** S11 — **Milestone:** M002

## Description

Diagnose and fix the stray pixel artifact that appears near avatars at direction 2 (facing camera).

Purpose: The clearRect fix from 17-02 addressed tint canvas residuals but the pixel persists. Static analysis shows all 13 sprite positions render within expected bounds. The root cause is likely a stray pixel baked into the face spritesheet PNG or a canvas compositing edge case. A diagnostic script + enhanced debug logging will identify the exact source.

Output: Clean avatar rendering with no stray pixels at any direction.

## Must-Haves

- [ ] "Stray pixel near avatar is identified and eliminated"
- [ ] "Face rendering can be toggled off for diagnostic purposes"
- [ ] "Spritesheet PNG verified clean or cleaned of stray pixels"

## Files

- `src/isoAvatarRenderer.ts`
- `src/avatarBuilderPreview.ts`
- `scripts/check-spritesheet-stray-pixels.mjs`
