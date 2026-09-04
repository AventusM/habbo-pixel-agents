# S13: Wall 3D Depth — Corner Slit Polish

**Goal:** Room walls keep the constructed 3D read with cleaner corner treatment — the back corner uses a split-slit approach matching adjacent wall colors instead of a monolithic post.
**Demo:** Opening localhost:3000 shows walls with a cleaner back-corner seam where each half matches its adjacent wall color.

## Must-Haves

- Build passes, all wall renderer tests pass, corner renders as a color-split slit matching adjacent walls.

## Proof Level

- This slice proves: integration

## Integration Closure

Visual polish only — no new APIs, no data model changes.

## Verification

- None.

## Tasks

- [x] **T01: Wall corner slit polish and test update** `est:30m`
  Replace the old fillRect-based back corner post with a path-based slit approach that splits the exposed corner front into two halves matching their adjacent wall colors. Update wall renderer tests to assert the new path-based rendering instead of fillRect calls.
  - Files: `src/isoWallRenderer.ts`, `tests/isoWallRenderer.test.ts`
  - Verify: node esbuild.config.mjs web && npx vitest run tests/isoWallRenderer.test.ts

## Files Likely Touched

- src/isoWallRenderer.ts
- tests/isoWallRenderer.test.ts
