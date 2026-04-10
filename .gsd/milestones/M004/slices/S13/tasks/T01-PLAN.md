---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T01: Wall corner slit polish and test update

Replace the old fillRect-based back corner post with a path-based slit approach that splits the exposed corner front into two halves matching their adjacent wall colors. Update wall renderer tests to assert the new path-based rendering instead of fillRect calls.

## Inputs

- `src/isoWallRenderer.ts`
- `tests/isoWallRenderer.test.ts`

## Expected Output

- `src/isoWallRenderer.ts`
- `tests/isoWallRenderer.test.ts`

## Verification

node esbuild.config.mjs web && npx vitest run tests/isoWallRenderer.test.ts
