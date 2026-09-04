# T01: 01-coordinate-foundation 01

**Slice:** S01 — **Milestone:** M001

## Description

Bootstrap the Node/TypeScript/Vitest infrastructure and implement the pure isometric math module with a passing unit test suite that is the hard gate for all subsequent rendering phases.

Purpose: Every rendering phase (2-7) calls `tileToScreen`, `screenToTile`, and `getDirection`. These functions must be correct and proven correct before any render code is written. The test suite is the Phase 1 gate — Phase 2 cannot begin until `npm test` exits 0.

Output:
- `package.json` — project manifest with `"type": "module"` and test scripts
- `tsconfig.json` — strict TypeScript config targeting ESNext/ESM, includes both src and tests directories
- `vitest.config.ts` — Vitest config with explicit `environment: 'node'`
- `src/isometricMath.ts` — pure isometric math, zero renderer imports
- `tests/isometricMath.test.ts` — 10+ assertion pairs, all passing

## Must-Haves

- [ ] "`tileToScreen(1, 0, 0)` returns `{x: 32, y: 16}` (Habbo diamond convention, not mirrored)"
- [ ] "`tileToScreen(0, 0, 1)` returns `{x: 0, y: -16}` (z-offset raises tile upward on screen)"
- [ ] "`screenToTile(tileToScreen(tx, ty, 0))` returns approximately `{x: tx, y: ty}` for integer tile coords (round-trip accuracy)"
- [ ] "`getDirection(0, 0, 1, 0)` returns 2 (SE) and all 8 BFS deltas return correct Habbo 0-7 direction"
- [ ] "`npm test` exits 0 with at least 10 assertion pairs all passing in plain Node (no browser globals)"
- [ ] "`src/isometricMath.ts` has zero imports from DOM, Canvas, React, or any renderer module"

## Files

- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `src/isometricMath.ts`
- `tests/isometricMath.test.ts`
