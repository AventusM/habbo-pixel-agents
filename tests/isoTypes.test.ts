// tests/isoTypes.test.ts
// Unit tests for isometric type utilities (heightmap parser, colour conversion, depth sort)
// Runs in Node environment (no DOM) — confirms renderer-independent pure logic

import { describe, it, expect } from 'vitest';
import {
  parseHeightmap,
  hsbToHsl,
  tileColors,
  depthSort,
  type TileGrid,
  type HsbColor,
  type Renderable,
} from '../src/isoTypes.js';

describe('parseHeightmap', () => {
  it('parses digit "0" as walkable ground tile height 0', () => {
    const grid = parseHeightmap('0');
    expect(grid.width).toBe(1);
    expect(grid.height).toBe(1);
    expect(grid.tiles[0][0]).toEqual({ height: 0 });
  });

  it('parses digit "9" as walkable max height tile', () => {
    const grid = parseHeightmap('9');
    expect(grid.width).toBe(1);
    expect(grid.height).toBe(1);
    expect(grid.tiles[0][0]).toEqual({ height: 9 });
  });

  it('parses "x" as void (null)', () => {
    const grid = parseHeightmap('x');
    expect(grid.width).toBe(1);
    expect(grid.height).toBe(1);
    expect(grid.tiles[0][0]).toBe(null);
  });

  it('parses "X" (uppercase) as void (null)', () => {
    const grid = parseHeightmap('X');
    expect(grid.width).toBe(1);
    expect(grid.height).toBe(1);
    expect(grid.tiles[0][0]).toBe(null);
  });

  it('parses unknown chars as void (null)', () => {
    const grid = parseHeightmap('?');
    expect(grid.width).toBe(1);
    expect(grid.height).toBe(1);
    expect(grid.tiles[0][0]).toBe(null);
  });

  it('parses multi-row heightmap with newlines', () => {
    const grid = parseHeightmap('012\n345\n678');
    expect(grid.width).toBe(3);
    expect(grid.height).toBe(3);
    expect(grid.tiles[0][0]).toEqual({ height: 0 });
    expect(grid.tiles[0][2]).toEqual({ height: 2 });
    expect(grid.tiles[1][1]).toEqual({ height: 4 });
    expect(grid.tiles[2][2]).toEqual({ height: 8 });
  });

  it('parses multi-row heightmap with \\r\\n (Windows line endings)', () => {
    const grid = parseHeightmap('01\r\n23');
    expect(grid.width).toBe(2);
    expect(grid.height).toBe(2);
    expect(grid.tiles[0][0]).toEqual({ height: 0 });
    expect(grid.tiles[1][1]).toEqual({ height: 3 });
  });

  it('handles uneven row widths by padding short rows with null', () => {
    const grid = parseHeightmap('012\n3\n456');
    expect(grid.width).toBe(3); // max row length
    expect(grid.height).toBe(3);
    expect(grid.tiles[0][0]).toEqual({ height: 0 });
    expect(grid.tiles[1][0]).toEqual({ height: 3 });
    expect(grid.tiles[1][1]).toBe(null); // padded
    expect(grid.tiles[1][2]).toBe(null); // padded
    expect(grid.tiles[2][2]).toEqual({ height: 6 });
  });

  it('parses mixed heightmap with digits and voids', () => {
    const grid = parseHeightmap('0x2\nxxx\n567');
    expect(grid.width).toBe(3);
    expect(grid.height).toBe(3);
    expect(grid.tiles[0][0]).toEqual({ height: 0 });
    expect(grid.tiles[0][1]).toBe(null);
    expect(grid.tiles[0][2]).toEqual({ height: 2 });
    expect(grid.tiles[1][0]).toBe(null);
    expect(grid.tiles[1][1]).toBe(null);
    expect(grid.tiles[1][2]).toBe(null);
    expect(grid.tiles[2][0]).toEqual({ height: 5 });
  });
});

describe('hsbToHsl', () => {
  it('converts white (h=0, s=0, b=100) to hsl(0, 0, 100)', () => {
    const hsl = hsbToHsl({ h: 0, s: 0, b: 100 });
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBe(100);
  });

  it('converts full-saturation green (h=120, s=100, b=100) to hsl(120, 100, 50)', () => {
    const hsl = hsbToHsl({ h: 120, s: 100, b: 100 });
    expect(hsl.h).toBe(120);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBe(50);
  });

  it('converts mid-tone red (h=0, s=50, b=50) to hsl with correct lightness', () => {
    const hsl = hsbToHsl({ h: 0, s: 50, b: 50 });
    expect(hsl.h).toBe(0);
    // Mid-tone conversion formula: l = b * (2 - s/100) / 2
    // l = 50 * (2 - 0.5) / 2 = 50 * 1.5 / 2 = 37.5 → 38 (rounded)
    expect(hsl.l).toBe(38);
    // sHsl = (b - l) / Math.min(l, 100 - l)
    // sHsl = (50 - 38) / 38 = 12/38 ≈ 0.316 → 32%
    expect(hsl.s).toBeGreaterThanOrEqual(30);
    expect(hsl.s).toBeLessThanOrEqual(35);
  });

  it('converts black (h=0, s=0, b=0) to hsl(0, 0, 0)', () => {
    const hsl = hsbToHsl({ h: 0, s: 0, b: 0 });
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBe(0);
  });

  it('handles full-saturation blue (h=240, s=100, b=100)', () => {
    const hsl = hsbToHsl({ h: 240, s: 100, b: 100 });
    expect(hsl.h).toBe(240);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBe(50);
  });
});

describe('tileColors', () => {
  it('returns three HSL color strings (top, left, right)', () => {
    const colors = tileColors({ h: 120, s: 50, b: 60 });
    expect(colors).toHaveProperty('top');
    expect(colors).toHaveProperty('left');
    expect(colors).toHaveProperty('right');
    expect(colors.top).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    expect(colors.left).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    expect(colors.right).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
  });

  it('makes left face 10% darker than top face', () => {
    const colors = tileColors({ h: 0, s: 0, b: 100 }); // white
    // white: hsl(0, 0%, 100%)
    // left should be: hsl(0, 0%, 90%)
    expect(colors.top).toBe('hsl(0, 0%, 100%)');
    expect(colors.left).toBe('hsl(0, 0%, 90%)');
  });

  it('makes right face 20% darker than top face', () => {
    const colors = tileColors({ h: 0, s: 0, b: 100 }); // white
    // right should be: hsl(0, 0%, 80%)
    expect(colors.right).toBe('hsl(0, 0%, 80%)');
  });

  it('clamps left face lightness at 0% when base is dim', () => {
    const colors = tileColors({ h: 0, s: 0, b: 5 }); // very dark
    // base: l ≈ 5%, left would be -5% → clamped to 0%
    expect(colors.left).toBe('hsl(0, 0%, 0%)');
  });

  it('clamps right face lightness at 0% when base is dim', () => {
    const colors = tileColors({ h: 0, s: 0, b: 15 }); // dim
    // base: l = 15%, right would be -5% → clamped to 0%
    expect(colors.right).toBe('hsl(0, 0%, 0%)');
  });

  it('preserves hue and saturation across all three faces', () => {
    const colors = tileColors({ h: 240, s: 80, b: 60 });
    // All three faces should have h=240, s varies (check they all start with "hsl(240,")
    expect(colors.top).toMatch(/^hsl\(240, \d+%, \d+%\)$/);
    expect(colors.left).toMatch(/^hsl\(240, \d+%, \d+%\)$/);
    expect(colors.right).toMatch(/^hsl\(240, \d+%, \d+%\)$/);
  });
});

describe('depthSort', () => {
  it('sorts renderables in ascending tileX+tileY+tileZ*0.001 order (back-to-front)', () => {
    const renderables: Renderable[] = [
      { tileX: 2, tileY: 2, tileZ: 0, draw: () => {} }, // sort key: 4.000
      { tileX: 0, tileY: 0, tileZ: 0, draw: () => {} }, // sort key: 0.000
      { tileX: 1, tileY: 1, tileZ: 0, draw: () => {} }, // sort key: 2.000
    ];
    const sorted = depthSort(renderables);
    expect(sorted[0].tileX).toBe(0);
    expect(sorted[0].tileY).toBe(0);
    expect(sorted[1].tileX).toBe(1);
    expect(sorted[1].tileY).toBe(1);
    expect(sorted[2].tileX).toBe(2);
    expect(sorted[2].tileY).toBe(2);
  });

  it('handles stair tiles (high Z) correctly — Z does NOT override X+Y position', () => {
    const renderables: Renderable[] = [
      { tileX: 1, tileY: 1, tileZ: 9, draw: () => {} }, // sort key: 2.009
      { tileX: 2, tileY: 2, tileZ: 0, draw: () => {} }, // sort key: 4.000
    ];
    const sorted = depthSort(renderables);
    // Stair tile (1,1,9) should render BEFORE (2,2,0) — back-to-front
    expect(sorted[0].tileX).toBe(1);
    expect(sorted[0].tileY).toBe(1);
    expect(sorted[0].tileZ).toBe(9);
    expect(sorted[1].tileX).toBe(2);
    expect(sorted[1].tileY).toBe(2);
  });

  it('at same depth, sorts by tileX (higher tileX = more to camera-right = on top)', () => {
    const renderables: Renderable[] = [
      { tileX: 1, tileY: 0, tileZ: 0, draw: () => {} }, // depth 1, tileX 1
      { tileX: 0, tileY: 1, tileZ: 0, draw: () => {} }, // depth 1, tileX 0
    ];
    const sorted = depthSort(renderables);
    // Lower tileX draws first (behind), higher tileX draws later (in front)
    expect(sorted[0].tileX).toBe(0);
    expect(sorted[0].tileY).toBe(1);
    expect(sorted[1].tileX).toBe(1);
    expect(sorted[1].tileY).toBe(0);
  });

  it('handles empty array', () => {
    const sorted = depthSort([]);
    expect(sorted).toEqual([]);
  });

  it('handles single renderable', () => {
    const renderables: Renderable[] = [
      { tileX: 5, tileY: 3, tileZ: 2, draw: () => {} },
    ];
    const sorted = depthSort(renderables);
    expect(sorted).toEqual(renderables);
  });
});
