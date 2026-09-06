# M001: RetroDiffusion as Primary Pixel-Art Source

**Vision:** Make RetroDiffusion the primary source of truth for generated pixel-art assets (characters first), replacing the currently-unavailable PixelLab pipeline. Plan first - evaluate capabilities, cost, style fit, and design the generation->pack->render pipeline - then implement it separately: adapt the packing scripts to RD output format, generate and pack a real character, and wire it into the renderer (absorbing the pending legacy M007/S02 "wire into renderer & calibrate" scope).

## Success Criteria

- A recorded adopt/reject decision for RetroDiffusion as primary pixel-art source, backed by capability + cost evidence
- A documented pipeline design (generation -> packing -> manifest -> renderer)
- One character generated via RetroDiffusion, packed, and rendering in the room with correct walk/idle at calibrated scale
- Legacy M007/S02 scope (wire into renderer & calibrate) closed under the new pipeline

## Slices

- [ ] **S01: Plan: RetroDiffusion as primary pixel-art source** `risk:low` `depends:[]`
  > After this: A decision record in GSD DECISIONS plus a short pipeline design note: which RD styles/sizes to use for characters, expected cost per character set, and the flow RD output -> assets/ -> renderer.

- [ ] **S02: Implement: RD generation -> pack -> render pipeline** `risk:medium` `depends:[S01]`
  > After this: A new character spritesheet (e.g. habbo_inspiration_new successor) generated with RetroDiffusion, packed via the updated script, and the avatar walking in the Habbo room at the correct scale.

## Boundary Map

| In scope | Out of scope |
|---|---|
| RetroDiffusion as primary source for character sprites (generation -> packing -> renderer) | Migrating existing furniture pipeline off PixelLab naming |
| Adaptation of pack-pixellab-sprites.mjs (or successor) to RD output format | Regenerating already-packed furniture assets |
| Legacy M007/S02 renderer calibration for non-48px frames | New avatar features beyond walk/idle |
| Decision record + pipeline design doc | Bulk regeneration of all legacy characters (follow-up) |
<!-- gsd:state-version=2:0 -->
