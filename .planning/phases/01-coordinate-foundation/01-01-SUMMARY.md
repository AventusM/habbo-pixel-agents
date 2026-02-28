---
phase: 01-coordinate-foundation
plan: 01
subsystem: testing
tags: [typescript, vitest, isometric-math, esm, node]

# Dependency graph
requires: []
provides:
  - Pure isometric math module (tileToScreen, screenToTile, getDirection, TILE_W/H constants)
  - Vitest test infrastructure with Node environment and ESM support
  - TypeScript strict-mode project config (ESNext/bundler moduleResolution)
  - Proven coordinate formulas — Phase 1 gate cleared (npm test exits 0)
affects:
  - 02-tile-renderer
  - 03-room-layout
  - 04-avatar-layer
  - 05-object-layer
  - 06-pathfinding
  - 07-ui-overlay

# Tech tracking
tech-stack:
  added:
    - vitest 3.x (test runner, Node environment)
    - typescript 5.7.x (strict ESM compilation)
    - "@types/node 22.x"
  patterns:
    - ESM-first: type=module in package.json, .js extensions in imports, moduleResolution=bundler
    - TDD RED-GREEN: write failing tests first, confirm module-not-found, then implement
    - Pure math modules: no imports, no DOM, no renderer dependencies

key-files:
  created:
    - package.json
    - tsconfig.json
    - vitest.config.ts
    - src/isometricMath.ts
    - tests/isometricMath.test.ts
  modified: []

key-decisions:
  - "ESM import paths use .js extension even for .ts source files — Vitest resolves .js -> .ts transparently; required for Node ESM resolution"
  - "moduleResolution=bundler not node — esbuild target for Phase 3+ requires bundler resolution"
  - "environment: node in vitest.config.ts — enforces COORD-04 (no DOM imports can slip through)"
  - "rootDir=. not src in tsconfig — include spans both src/ and tests/ so typecheck covers test assertions"
  - "tileToScreen formula: screenX=(tileX-tileY)*32, screenY=(tileX+tileY)*16-tileZ*16 — matches Habbo v14 diamond convention"
  - "getDirection uses string key lookup map for 8 BFS deltas — O(1), readable, matches Habbo 0-7 clockwise-from-NE system"

patterns-established:
  - "Isometric formula: screenX=(tileX-tileY)*TILE_W_HALF, screenY=(tileX+tileY)*TILE_H_HALF-tileZ*TILE_H_HALF"
  - "screenToTile inverse: x=screenX/TILE_W+screenY/TILE_H, y=screenY/TILE_H-screenX/TILE_W (z=0 assumption)"
  - "Habbo directions 0-7 clockwise from NE: 0=NE,1=E,2=SE,3=S,4=SW,5=W,6=NW,7=N"
  - "All subsequent math modules must have zero import statements (pure functions, no renderer deps)"

requirements-completed: [COORD-01, COORD-02, COORD-03, COORD-04, BUILD-06]

# Metrics
duration: 5min
completed: 2026-02-28
---

# Phase 1 Plan 01: Coordinate Foundation Summary

**Node/TypeScript/Vitest infrastructure bootstrapped and isometric math proven with 24 passing assertions covering Habbo diamond projection, z-offset height, 8-direction BFS map, and round-trip accuracy to 10 decimal places**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-28T12:46:06Z
- **Completed:** 2026-02-28T12:47:55Z
- **Tasks:** 2
- **Files modified:** 5 created, 1 (package-lock.json)

## Accomplishments
- NPM project with ESM-first config (type=module, vitest 3.x, typescript 5.7.x)
- Pure isometric math module with zero imports — tileToScreen, screenToTile, getDirection, TILE_W/H constants
- 24 assertions all passing: constants (1), tileToScreen (9 cases), screenToTile round-trips (6), getDirection (8 BFS deltas)
- TypeScript typecheck clean with strict mode covering both src/ and tests/
- Phase gate cleared: npm test exits 0, Phase 2 can begin

## Task Commits

Each task was committed atomically:

1. **Task 1: Bootstrap project infrastructure** - `ef3a720` (chore)
2. **Task 2: Implement isometricMath.ts and write passing test suite** - `fbb1702` (feat)

## Files Created/Modified
- `package.json` - NPM manifest with type=module, vitest run/typecheck scripts
- `tsconfig.json` - Strict TypeScript, ESNext/bundler moduleResolution, includes src + tests
- `vitest.config.ts` - Vitest with environment: node, includes tests/**/*.test.ts
- `src/isometricMath.ts` - Pure isometric math module, zero imports
- `tests/isometricMath.test.ts` - 24-assertion test suite, all passing
- `package-lock.json` - Lockfile from npm install

## Decisions Made
- Used `.js` import extensions for ESM compatibility: `from '../src/isometricMath.js'` — Vitest resolves `.js` to `.ts` transparently; required by Node ESM spec
- `moduleResolution: bundler` over `node` — esbuild is the Phase 3+ bundler target; bundler resolution avoids future compatibility issues
- `environment: 'node'` in Vitest config — enforces COORD-04 constraint (no DOM imports can mask themselves)
- `rootDir: '.'` in tsconfig — necessary because include spans both `src/` and `tests/` directories
- `getDirection` uses string key lookup map `'dx,dy' -> direction` for the 8 BFS deltas — O(1), matches all Habbo 0-7 cases directly

## Deviations from Plan

None - plan executed exactly as written. TDD RED-GREEN confirmed: test suite failed with "Cannot find module" before implementation, all 24 assertions passed after implementation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Coordinate foundation proven and committed. Phase 2 (tile renderer) can import `tileToScreen` and `getDirection` from `src/isometricMath.ts`
- All eight Habbo BFS directions tested and confirmed correct
- Round-trip accuracy to 10 decimal places confirmed — safe for all rendering and pathfinding phases
- No blockers.

---
*Phase: 01-coordinate-foundation*
*Completed: 2026-02-28*
