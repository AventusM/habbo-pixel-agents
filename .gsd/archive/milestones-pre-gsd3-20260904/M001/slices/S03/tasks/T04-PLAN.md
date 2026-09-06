# T04: 03-asset-pipeline 04

**Slice:** S03 — **Milestone:** M001

## Description

Build the .nitro binary extraction script for full control over asset pipeline — parsing BigEndian file format, inflating zlib-compressed data, and writing PNG/JSON atlases to disk.

Purpose: DEFERRED TO POST-V1 per research recommendation. Research (03-RESEARCH.md) strongly recommends using pre-extracted assets from sphynxkitten/nitro-assets for v1 to reduce risk and accelerate furniture rendering. Plans 03-01, 03-02, 03-03 are sufficient for Phase 3 completion.

Output: This plan is not executed during Phase 3. File preserved for post-v1 implementation if full asset independence is desired.

**DEFERRED STATUS:**
- Requirements ASSET-01 and ASSET-07 removed from Phase 3 roadmap
- Phase 3 completes successfully using pre-extracted assets
- This plan can be implemented post-v1 if needed for:
  1. Full asset control without dependency on sphynxkitten/nitro-assets
  2. Custom asset modifications requiring re-extraction
  3. Asset updates from new Habbo releases

**DO NOT EXECUTE THIS PLAN DURING PHASE 3**

## Must-Haves

- [ ] ".nitro binary files can be parsed without errors"
- [ ] "Extracted PNGs match source bundles visually"
- [ ] "Extracted JSONs have valid Texture Packer hash format"
- [ ] "Build-time extraction runs before esbuild bundling"

## Files

- `src/scripts/extractNitro.ts`
- `tests/extractNitro.test.ts`
- `package.json`
