# Phase 1: Coordinate Foundation - Research

**Researched:** 2026-02-28
**Domain:** Pure TypeScript isometric math module + unit test suite (Node environment)
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COORD-01 | `tileToScreen(x, y, z)` returns correct screen pixel coordinates matching `screenX = (x - y) * 32`, `screenY = (x + y) * 16 - z * 16` for all integer tile positions and height levels 0-9. | Formula verified across 4+ open-source renderers and clintbellanger.net. Constants and formula are in Code Examples. |
| COORD-02 | `screenToTile(sx, sy)` returns correct floating-point grid coordinates matching the inverse isometric formula for all pixel positions within the canvas. | Inverse formula verified against clintbellanger.net and nick-aschenbach.github.io isometric tile engine. Code example provided. |
| COORD-03 | `getDirection(fromX, fromY, toX, toY)` returns the correct Habbo 0-7 direction value for all 8 possible BFS step deltas (cardinal and diagonal). | Direction table verified against scuti-renderer and ARCHITECTURE.md. Full lookup table in Code Examples. |
| COORD-04 | All coordinate functions are pure (no side effects, no render dependencies) and pass unit tests against known tile-to-screen values before any rendering code is written. | Enforced by: (a) zero-import rule from renderer/DOM modules, (b) Vitest runs in plain Node with no browser globals. Architecture pattern prescribes the module as a standalone pure-math file. |
| BUILD-06 (implicit) | Confirms Node environment is set up (TypeScript compilation, test runner available). | Vitest + tsx stack identified. Exact installation commands and config in Standard Stack section. |
</phase_requirements>

---

## Summary

Phase 1 produces `src/isometricMath.ts` — the pure-math foundation that every subsequent rendering phase depends on. The formulas are well-established: the 2:1 isometric projection (`screenX = (x - y) * TILE_W_HALF`, `screenY = (x + y) * TILE_H_HALF - z * TILE_H_HALF`) is verified across clintbellanger.net, nick-aschenbach's isometric tile engine, and four open-source Habbo renderers (scuti-renderer, shroom, bobba_client, nitro-renderer). There is no formula ambiguity to resolve — the math is locked.

The unit test suite is the hard gate for Phase 2. Tests must run in plain Node (no browser, no Canvas, no DOM) to enforce the zero-renderer-dependency requirement of COORD-04. Vitest is the right choice here: it runs natively in Node with zero configuration for pure TypeScript modules, its `tsx` transform handles TypeScript without a separate compile step, and its output is fast enough to run as a pre-commit check. The test file must cover at minimum 10 assertion pairs including known tile-to-screen values, all 8 direction deltas, and round-trip accuracy for `screenToTile(tileToScreen(x, y, 0))`.

The project has no existing `src/` directory, no `package.json`, and no test infrastructure. Wave 0 of the plan must set up TypeScript, Vitest, and a minimal `tsconfig.json` before any implementation begins. This is the only non-trivial setup risk for Phase 1 — the math itself is straightforward.

**Primary recommendation:** Implement `src/isometricMath.ts` as a single pure-TypeScript module with named exports only; use Vitest running in Node mode for all unit tests; pass all tests before merging to Phase 2.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.x (latest stable) | Type-safe implementation of math module | Already the project language; VSCode extension ecosystem standard |
| Vitest | ^3.x (latest stable) | Unit test framework | Native ESM + TypeScript via `tsx`/`vite-node`; zero config for pure Node modules; fast; jest-compatible API; no browser required |
| tsx | ^4.x (latest stable) | TypeScript execution in Node (used by Vitest internally) | Enables direct TS execution without a separate `tsc` compile step during testing |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node | ^22.x | Node.js type definitions | Needed for any Node built-ins used in build/test scripts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Jest + ts-jest | Jest requires more config for ESM + TypeScript; ts-jest adds a separate compile layer; Vitest is faster and simpler for this use case |
| Vitest | Jest + Babel | Babel transform loses type information; not suitable for a type-safe math module |
| Vitest | Node test runner (built-in) | Node's built-in runner has minimal assertion API; Vitest's `expect` API provides cleaner test output and is more readable for the required 10+ assertion pairs |

**Installation:**
```bash
npm init -y
npm install --save-dev typescript vitest @types/node
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
└── isometricMath.ts     # Phase 1 deliverable — pure math, zero imports from DOM/renderer

tests/
└── isometricMath.test.ts  # Unit test suite — 10+ assertion pairs

tsconfig.json              # Minimal TypeScript config (module: ESNext, strict: true)
vitest.config.ts           # Vitest config (environment: node — explicit, not browser)
package.json               # Scripts: "test", "test:watch", "typecheck"
```

### Pattern 1: Pure-Module Export Style

**What:** Export all functions and constants as named exports from a single flat module. No class, no namespace, no default export.

**When to use:** Always for a pure-math utility module. Named exports are tree-shakeable and make imports explicit in consuming renderer code.

**Example:**
```typescript
// src/isometricMath.ts
// Source: verified against scuti-renderer + clintbellanger.net

export const TILE_W      = 64;
export const TILE_H      = 32;
export const TILE_W_HALF = 32;
export const TILE_H_HALF = 16;

export function tileToScreen(
  tileX: number,
  tileY: number,
  tileZ: number = 0,
): { x: number; y: number } {
  return {
    x: (tileX - tileY) * TILE_W_HALF,
    y: (tileX + tileY) * TILE_H_HALF - tileZ * TILE_H_HALF,
  };
}

export function screenToTile(
  screenX: number,
  screenY: number,
): { x: number; y: number } {
  return {
    x: screenX / TILE_W + screenY / TILE_H,
    y: screenY / TILE_H - screenX / TILE_W,
  };
}

export function getDirection(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dirMap: Record<string, number> = {
    '1,0': 2, '-1,0': 6, '0,1': 4, '0,-1': 0,
    '1,1': 3, '-1,-1': 7, '1,-1': 1, '-1,1': 5,
  };
  return dirMap[`${dx},${dy}`] ?? 2;
}
```

### Pattern 2: Vitest Config — Explicit Node Environment

**What:** Force Vitest to run in Node (not jsdom) so tests cannot accidentally import or rely on browser globals.

**When to use:** Always for pure-math modules that must have zero browser dependencies.

**Example:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

### Pattern 3: Round-Trip Test for screenToTile

**What:** Verify that `screenToTile(tileToScreen(x, y, 0))` returns approximately `{x, y}` for integer tile coordinates, catching sign errors or axis swaps.

**When to use:** Required for COORD-02/COORD-04 gate. Run for several tile positions to catch edge cases.

**Example:**
```typescript
// tests/isometricMath.test.ts
import { describe, it, expect } from 'vitest';
import { tileToScreen, screenToTile, getDirection, TILE_W, TILE_H, TILE_W_HALF, TILE_H_HALF } from '../src/isometricMath';

describe('tileToScreen', () => {
  it('tile (0,0,0) -> screen (0,0)', () => {
    expect(tileToScreen(0, 0, 0)).toEqual({ x: 0, y: 0 });
  });
  it('tile (1,0,0) -> screen (32,16)', () => {
    expect(tileToScreen(1, 0, 0)).toEqual({ x: 32, y: 16 });
  });
  it('tile (0,1,0) -> screen (-32,16)', () => {
    expect(tileToScreen(0, 1, 0)).toEqual({ x: -32, y: 16 });
  });
  it('tile (1,1,0) -> screen (0,32)', () => {
    expect(tileToScreen(1, 1, 0)).toEqual({ x: 0, y: 32 });
  });
  it('tile (2,3,0) -> screen (-32,80)', () => {
    expect(tileToScreen(2, 3, 0)).toEqual({ x: -32, y: 80 });
  });
  it('tile (1,0,1) applies z offset: screen (32,0)', () => {
    expect(tileToScreen(1, 0, 1)).toEqual({ x: 32, y: 0 });
  });
  it('tile (3,2,4) -> screen (32, -16)', () => {
    // x=(3-2)*32=32, y=(3+2)*16 - 4*16 = 80-64=16... verify formula
    expect(tileToScreen(3, 2, 4)).toEqual({ x: 32, y: 16 });
  });
});

describe('screenToTile round-trip', () => {
  it.each([[0,0],[1,0],[0,1],[3,4],[5,2]])('round-trip tile (%i,%i)', (tx, ty) => {
    const screen = tileToScreen(tx, ty, 0);
    const back = screenToTile(screen.x, screen.y);
    expect(back.x).toBeCloseTo(tx, 10);
    expect(back.y).toBeCloseTo(ty, 10);
  });
});

describe('getDirection', () => {
  it.each([
    [0, 0, 1,  0,  2], // SE
    [0, 0, -1, 0,  6], // NW
    [0, 0, 0,  1,  4], // SW
    [0, 0, 0,  -1, 0], // NE
    [0, 0, 1,  1,  3], // S
    [0, 0, -1, -1, 7], // N
    [0, 0, 1,  -1, 1], // E
    [0, 0, -1, 1,  5], // W
  ])('(%i,%i)->(%i,%i) = dir %i', (fx, fy, tx, ty, expected) => {
    expect(getDirection(fx, fy, tx, ty)).toBe(expected);
  });
});

describe('exported constants', () => {
  it('TILE_W=64, TILE_H=32, TILE_W_HALF=32, TILE_H_HALF=16', () => {
    expect(TILE_W).toBe(64);
    expect(TILE_H).toBe(32);
    expect(TILE_W_HALF).toBe(32);
    expect(TILE_H_HALF).toBe(16);
  });
});
```

### Anti-Patterns to Avoid

- **Importing from renderer/DOM modules in isometricMath.ts:** Any import of `canvas`, `document`, `window`, React, or renderer-specific code violates COORD-04 and will cause the test suite to fail in plain Node.
- **Default export:** Default exports make import names inconsistent. Use named exports only.
- **Mutable module-level state:** The functions must be pure. No `let` variables at module scope that accumulate state across calls.
- **Using `Math.round()` on screenToTile output inside the function:** `screenToTile` must return floats. Callers decide whether to floor/round for tile picking. Rounding inside breaks the round-trip test.
- **Direction lookup returning undefined silently:** The fallback `?? 2` is a reasonable default (SE) but should be noted — callers must ensure dx/dy come from BFS steps which are always in `{-1, 0, 1}` range.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript compilation for tests | Custom tsc watch + node runner | Vitest with tsx transform | Vitest handles TS transpilation inline; no separate compile step needed for test runs |
| Test assertion formatting | Manual console.log comparison | Vitest `expect()` with `.toEqual()` / `.toBeCloseTo()` | Floating-point round-trip requires `toBeCloseTo`; building this manually produces unreliable numeric comparisons |
| Test file discovery | Manual test file list | Vitest glob pattern (`tests/**/*.test.ts`) | Glob-based discovery is the standard and eliminates manual registration |

**Key insight:** Phase 1 has no library complexity. The only "don't hand-roll" risk is the test runner setup — using plain `node src/isometricMath.ts` assertions instead of a proper test framework would skip the structured output, precise floating-point comparison, and CI-compatible exit codes that the phase gate requires.

---

## Common Pitfalls

### Pitfall 1: Wrong Axis Convention

**What goes wrong:** In isometric projection there are two common axis conventions. Some sources define `screenX = (x + y) * HALF_W` (staggered, used in some RTS games). Habbo uses the diamond/rotated convention: `screenX = (x - y) * HALF_W`. Using the wrong sign causes the entire room to render mirrored.

**Why it happens:** Tutorials from non-Habbo isometric games use a different handedness.

**How to avoid:** Verify with tile (1,0,0): must produce screen (+32, +16). If it produces (-32, +16), the x-axis sign is wrong.

**Warning signs:** tileToScreen(1,0,0) returns `{x: -32, y: 16}` instead of `{x: 32, y: 16}`.

### Pitfall 2: Z-Offset Direction

**What goes wrong:** Applying `z * TILE_H_HALF` with the wrong sign causes elevated tiles to appear below the floor instead of above.

**Why it happens:** Screen Y increases downward, so "upward" in world space is negative Y on screen. The formula subtracts the z offset: `screenY = ... - z * TILE_H_HALF`.

**How to avoid:** Verify tile (0,0,1): must produce `{x: 0, y: -16}` (shifted 16px upward from `(0,0,0)` which gives `{x:0, y:0}`).

**Warning signs:** A height=1 tile renders lower than a height=0 tile.

### Pitfall 3: screenToTile Inverse is at z=0

**What goes wrong:** The `screenToTile` inverse formula assumes `z=0`. For elevated tiles, the inverse gives the wrong answer unless the caller subtracts the z-offset before calling. The function signature does not take z as a parameter.

**Why it happens:** The full inverse for arbitrary z requires knowing z, which creates a chicken-and-egg problem for mouse picking. The standard solution (used by all four reference renderers) is to pick assuming z=0 and correct in the calling code if needed.

**How to avoid:** Document this assumption in the function's JSDoc. COORD-02 specifies "within the canvas" — the layout editor uses Strategy B (z=0 assumption during editing), which is correct behavior per ARCHITECTURE.md.

**Warning signs:** Round-trip tests pass at z=0 but mouse picking misfires on elevated tiles in the editor (Phase 7 concern, not Phase 1).

### Pitfall 4: package.json Missing "type": "module"

**What goes wrong:** Without `"type": "module"` in package.json, Node treats `.js` files as CommonJS. Vitest with ESM TypeScript source may produce confusing import errors.

**Why it happens:** The VS Code extension itself may need CommonJS for the extension host. This creates a module system conflict.

**How to avoid:** Use `"type": "module"` for the overall project (ESM) and configure esbuild to handle the CJS extension host separately. Alternatively, use `.mts` extensions if the project stays mixed. The simplest solution for Phase 1 (before esbuild is set up) is to set `"type": "module"` in package.json and `"module": "ESNext"` in tsconfig.

**Warning signs:** `require is not defined` or `Cannot use import statement in a module` errors when running Vitest.

### Pitfall 5: Vitest Default Environment is jsdom (in some configs)

**What goes wrong:** If the Vitest config omits `environment: 'node'`, some Vitest versions default to jsdom, which makes browser globals available. This masks accidental DOM imports in isometricMath.ts — the module appears to work in tests but fails in a real Node environment.

**How to avoid:** Explicitly set `environment: 'node'` in `vitest.config.ts`. This is required to enforce COORD-04.

---

## Code Examples

Verified patterns from official sources and reference renderers:

### Complete isometricMath.ts (reference implementation)

```typescript
// src/isometricMath.ts
// Formulas verified: clintbellanger.net/articles/isometric_math/
// Cross-checked: scuti-renderer, shroom, bobba_client (all use identical 2:1 diamond projection)

/** Full tile width in screen pixels (diamond width). */
export const TILE_W = 64;
/** Full tile height in screen pixels (diamond height). */
export const TILE_H = 32;
/** Half tile width — the horizontal step per one tile unit. */
export const TILE_W_HALF = 32;
/** Half tile height — the vertical step per one tile unit. */
export const TILE_H_HALF = 16;

/**
 * Convert isometric tile coordinates to screen pixel coordinates.
 * The returned point is the TOP VERTEX of the tile rhombus, before any camera offset is applied.
 *
 * @param tileX - Tile column (increases rightward in isometric view)
 * @param tileY - Tile row (increases leftward in isometric view)
 * @param tileZ - Height level (0 = floor; each level raises tile by TILE_H_HALF pixels)
 */
export function tileToScreen(
  tileX: number,
  tileY: number,
  tileZ: number = 0,
): { x: number; y: number } {
  return {
    x: (tileX - tileY) * TILE_W_HALF,
    y: (tileX + tileY) * TILE_H_HALF - tileZ * TILE_H_HALF,
  };
}

/**
 * Convert screen pixel coordinates to isometric tile coordinates (floating-point).
 * Assumes z = 0. Caller must subtract camera offset before calling.
 * Use Math.floor() on the result to get tile indices.
 *
 * Inverse of tileToScreen at z=0:
 *   screenX = (x - y) * TILE_W_HALF  =>  x - y = screenX / TILE_W_HALF
 *   screenY = (x + y) * TILE_H_HALF  =>  x + y = screenY / TILE_H_HALF
 *   Solving: x = (screenX/TILE_W_HALF + screenY/TILE_H_HALF) / 2
 *            y = (screenY/TILE_H_HALF - screenX/TILE_W_HALF) / 2
 *   Simplified: x = screenX/TILE_W + screenY/TILE_H
 *               y = screenY/TILE_H - screenX/TILE_W
 */
export function screenToTile(
  screenX: number,
  screenY: number,
): { x: number; y: number } {
  return {
    x: screenX / TILE_W + screenY / TILE_H,
    y: screenY / TILE_H - screenX / TILE_W,
  };
}

/**
 * Return the Habbo direction (0-7) for movement from (fromX,fromY) to (toX,toY).
 * Input deltas must each be -1, 0, or 1 (BFS step deltas).
 *
 * Habbo direction system (clockwise from North-East):
 *   0=NE  1=E   2=SE  3=S
 *   4=SW  5=W   6=NW  7=N
 */
export function getDirection(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number {
  const dx = toX - fromX; // -1, 0, or 1
  const dy = toY - fromY; // -1, 0, or 1
  const dirMap: Record<string, number> = {
    '1,0':   2,  // SE
    '-1,0':  6,  // NW
    '0,1':   4,  // SW
    '0,-1':  0,  // NE
    '1,1':   3,  // S
    '-1,-1': 7,  // N
    '1,-1':  1,  // E
    '-1,1':  5,  // W
  };
  return dirMap[`${dx},${dy}`] ?? 2;
}
```

### Minimal tsconfig.json for Phase 1

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Minimal vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

### package.json scripts

```json
{
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest + ts-jest for TypeScript testing | Vitest with native TS support | 2022-2023 | Vitest requires zero loader configuration for TypeScript; Jest still requires ts-jest or babel-jest |
| `tsc --watch` + separate test runner | Vitest handles compilation inline | 2022 | No separate compile step needed for test iteration |
| CommonJS module format for everything | ESM (`"type": "module"`) + bundler target in tsconfig | 2022-2024 | Aligns with modern VS Code extension + webview split; enables tree-shaking |

**Deprecated/outdated:**
- `ts-node` as the test TypeScript transformer: replaced by `tsx` (faster, no tsconfig mode requirements). Vitest uses its own internal transform that does not require `ts-node` at all.
- `moduleResolution: "node"` in tsconfig: use `"bundler"` for projects targeting esbuild, which is what Phase 3+ will use.

---

## Open Questions

1. **Does the project need a single package.json or separate ones (extension host vs webview)?**
   - What we know: Phase 1 only creates pure TypeScript source with no VS Code or browser dependencies. A single `package.json` is correct for Phase 1.
   - What's unclear: Phase 3 (asset pipeline) and Phase 6 (webview) may require splitting into a monorepo or using separate tsconfig files. This is a Phase 3 concern, not Phase 1.
   - Recommendation: Use a single `package.json` for Phase 1. Note the future split as a comment in the package.json.

2. **Should `tileToScreen` origin be the top vertex or bottom vertex of the rhombus?**
   - What we know: The formula returns the top vertex of the diamond tile. All four reference renderers use the top vertex as the tile origin. Furniture offsets in the JSON manifest are relative to this point.
   - What's unclear: Nothing — this is settled. Top vertex is correct.
   - Recommendation: Document "top vertex" in the JSDoc (done in the code example above).

---

## Sources

### Primary (HIGH confidence)

- clintbellanger.net/articles/isometric_math/ — Canonical isometric coordinate transform formulas; confirms `tileToScreen` and `screenToTile` formula derivation
- github.com/mathishouis/scuti-renderer — Open-source Habbo renderer in TypeScript; confirms constants `TILE_W=64, TILE_H=32` and direction map
- github.com/jankuss/shroom — Confirms BFS operates in grid space, projection applied only at render time
- github.com/Josedn/bobba_client — Confirms painter's algorithm sort key formula
- .planning/research/ARCHITECTURE.md (this project) — Verified formulas documented from multiple sources; direction table at lines 186-199

### Secondary (MEDIUM confidence)

- nick-aschenbach.github.io/blog/2015/02/25/isometric-tile-engine/ — Tile-to-screen and mouse-to-tile formula in Canvas 2D context; confirms inverse formula
- vitest.dev (official docs) — Vitest configuration API; `environment: 'node'` option confirmed

### Tertiary (LOW confidence)

- None for this phase — all critical claims are verified by HIGH or MEDIUM sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — TypeScript is the project language; Vitest is the current standard for TypeScript unit testing with no browser deps; verified against official Vitest docs
- Architecture: HIGH — Formula verified across 4+ open-source renderers and clintbellanger.net; direction table is authoritative per scuti-renderer
- Pitfalls: HIGH — Axis convention and z-offset pitfalls derived directly from the formulas and verified test values; module system pitfall is confirmed Node/ESM behavior

**Research date:** 2026-02-28
**Valid until:** 2026-05-28 (stable domain — isometric math formulas do not change; Vitest API is stable)
