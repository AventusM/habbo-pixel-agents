# T01: 03-asset-pipeline 01

**Slice:** S03 — **Milestone:** M001

## Description

Build the sprite cache abstraction that loads PNG atlases as GPU-accelerated ImageBitmap objects and provides frame lookup API for furniture/avatar rendering.

Purpose: Establish the runtime layer between raw PNG assets and the renderer before building asset extraction pipeline — this allows sprite rendering code to be written against stable cache API regardless of asset source.

Output: Tested sprite cache module ready for Phase 4 furniture renderer integration.

## Must-Haves

- [ ] "ImageBitmap objects exist in cache for loaded atlases"
- [ ] "Frame lookup by name returns correct atlas region coordinates"
- [ ] "Failed image loads are handled gracefully without crashing"

## Files

- `src/isoSpriteCache.ts`
- `tests/isoSpriteCache.test.ts`
- `tests/setup.ts`
