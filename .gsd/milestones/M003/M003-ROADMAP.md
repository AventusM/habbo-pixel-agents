# M003: PixelLab Furniture Replacement

**Vision:** Replace copyrighted Habbo furniture sprites with AI-generated PixelLab equivalents, starting with hc_lmp as proof-of-concept.

## Success Criteria

- PixelLab oil lamp renders in-room at correct tile position and depth
- Warm glow overlay still activates when section has active agents
- No regressions in other furniture rendering

## Key Risks / Unknowns

- Offset calibration for 44×44 static image vs multi-layer original — needs empirical tuning

## Verification Classes

- Contract verification: Nitro JSON validates against NitroAssetData schema, PNG loads without error
- Integration verification: lamp renders in running Extension Development Host room
- Operational verification: none
- UAT / human verification: visual inspection that lamp looks correct on tile

## Milestone Definition of Done

This milestone is complete only when all are true:

- hc_lmp replaced with PixelLab oil lamp in dist assets
- Lamp renders correctly in a running room
- Glow overlay still works
- No console errors from asset loading

## Slices

- [x] **S01: Replace hc_lmp With PixelLab Oil Lamp** `risk:low` `depends:[]`
  > After this: The PixelLab oil lamp renders in the room wherever hc_lmp appeared, with working glow overlay, verified in Extension Development Host.
