# S03: Asset Pipeline

**Goal:** Build the sprite cache abstraction that loads PNG atlases as GPU-accelerated ImageBitmap objects and provides frame lookup API for furniture/avatar rendering.
**Demo:** Build the sprite cache abstraction that loads PNG atlases as GPU-accelerated ImageBitmap objects and provides frame lookup API for furniture/avatar rendering.

## Must-Haves


## Tasks

- [x] **T01: 03-asset-pipeline 01**
  - Build the sprite cache abstraction that loads PNG atlases as GPU-accelerated ImageBitmap objects and provides frame lookup API for furniture/avatar rendering.

Purpose: Establish the runtime layer between raw PNG assets and the renderer before building asset extraction pipeline — this allows sprite rendering code to be written against stable cache API regardless of asset source.

Output: Tested sprite cache module ready for Phase 4 furniture renderer integration.
- [x] **T02: 03-asset-pipeline 02**
  - Configure dual esbuild bundling (extension host + webview), establish build-time asset pipeline scaffolding, and ensure extracted Sulake assets never reach the git repository.

Purpose: Separate Node.js extension code from browser webview code to prevent Node.js built-ins leaking into browser bundle; prepare infrastructure for asset extraction without implementing .nitro parsing (deferred per research recommendation).

Output: Clean build system ready for asset integration in later plans.
- [x] **T03: 03-asset-pipeline 03**
  - Wire the VS Code webview asset serving pipeline — copy sprite assets to dist/webview-assets/ during build, generate webview URIs in extension host, update CSP for image loading, and validate chair atlas loads in browser.

Purpose: Complete the asset pipeline integration so sprite cache (Plan 03-01) can load real atlases from the webview; validate end-to-end flow before furniture rendering in Phase 4.

Output: Working asset pipeline with chair atlas loading as proof-of-concept.
- [ ] **T04: 03-asset-pipeline 04**
  - Build the .nitro binary extraction script for full control over asset pipeline — parsing BigEndian file format, inflating zlib-compressed data, and writing PNG/JSON atlases to disk.

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

## Files Likely Touched

- `src/isoSpriteCache.ts`
- `tests/isoSpriteCache.test.ts`
- `tests/setup.ts`
- `package.json`
- `.gitignore`
- `esbuild.config.mjs`
- `src/extension.ts`
- `src/webview.tsx`
- `esbuild.config.mjs`
- `src/scripts/extractNitro.ts`
- `tests/extractNitro.test.ts`
- `package.json`
