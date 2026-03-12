# S01: Coordinate Foundation

**Goal:** Bootstrap the Node/TypeScript/Vitest infrastructure and implement the pure isometric math module with a passing unit test suite that is the hard gate for all subsequent rendering phases.
**Demo:** Bootstrap the Node/TypeScript/Vitest infrastructure and implement the pure isometric math module with a passing unit test suite that is the hard gate for all subsequent rendering phases.

## Must-Haves


## Tasks

- [x] **T01: 01-coordinate-foundation 01** `est:5min`
  - Bootstrap the Node/TypeScript/Vitest infrastructure and implement the pure isometric math module with a passing unit test suite that is the hard gate for all subsequent rendering phases.

Purpose: Every rendering phase (2-7) calls `tileToScreen`, `screenToTile`, and `getDirection`. These functions must be correct and proven correct before any render code is written. The test suite is the Phase 1 gate — Phase 2 cannot begin until `npm test` exits 0.

Output:
- `package.json` — project manifest with `"type": "module"` and test scripts
- `tsconfig.json` — strict TypeScript config targeting ESNext/ESM, includes both src and tests directories
- `vitest.config.ts` — Vitest config with explicit `environment: 'node'`
- `src/isometricMath.ts` — pure isometric math, zero renderer imports
- `tests/isometricMath.test.ts` — 10+ assertion pairs, all passing

## Files Likely Touched

- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `src/isometricMath.ts`
- `tests/isometricMath.test.ts`
