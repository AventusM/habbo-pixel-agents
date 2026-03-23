// @vitest-environment happy-dom

import { describe, it, expect, beforeAll } from 'vitest';
import { parseHeightmap } from '../src/isoTypes.js';
import { depthSort } from '../src/isoTypes.js';
import type { Renderable } from '../src/isoTypes.js';
import { computeCameraOrigin, preRenderRoom } from '../src/isoTileRenderer.js';

// happy-dom's OffscreenCanvasRenderingContext2D lacks clip() — polyfill it for tests
beforeAll(() => {
  const oc = new OffscreenCanvas(1, 1);
  const ctx = oc.getContext('2d');
  if (ctx && typeof ctx.clip !== 'function') {
    (ctx as any).__proto__.clip = function () {};
  }
});

describe('isoTileRenderer', () => {
  describe('computeCameraOrigin', () => {
    it('should return numeric camera origin for 3x3 grid', () => {
      const grid = parseHeightmap('000\n000\n000');
      const origin = computeCameraOrigin(grid, 800, 600);

      // Should return valid numbers (not NaN)
      expect(origin.x).toBeTypeOf('number');
      expect(origin.y).toBeTypeOf('number');
      expect(Number.isNaN(origin.x)).toBe(false);
      expect(Number.isNaN(origin.y)).toBe(false);
    });

    it('should center room in 800x600 viewport (positive origin)', () => {
      const grid = parseHeightmap('000\n000\n000');
      const origin = computeCameraOrigin(grid, 800, 600);

      // For a small 3x3 room in an 800x600 viewport, origin should be positive
      // (room is smaller than viewport, so it's centered with positive offset)
      expect(origin.x).toBeGreaterThan(0);
      expect(origin.y).toBeGreaterThan(0);
    });

    it('should return {0,0} for grid with no non-void tiles', () => {
      const grid = parseHeightmap('xxx\nxxx\nxxx');
      const origin = computeCameraOrigin(grid, 800, 600);

      expect(origin.x).toBe(0);
      expect(origin.y).toBe(0);
    });
  });

  describe('preRenderRoom', () => {
    it('should return OffscreenCanvas with correct dimensions', () => {
      const grid = parseHeightmap('000\n000\n000');
      const origin = computeCameraOrigin(grid, 800, 600);
      const offscreen = preRenderRoom(grid, origin, 800, 600, 1);

      expect(offscreen).toBeInstanceOf(OffscreenCanvas);
      expect(offscreen.width).toBe(800);
      expect(offscreen.height).toBe(600);
    });

    it('should not throw with void tiles (checkerboard pattern)', () => {
      const grid = parseHeightmap('x0x\n0x0\nx0x');
      const origin = computeCameraOrigin(grid, 800, 600);

      expect(() => {
        preRenderRoom(grid, origin, 800, 600, 1);
      }).not.toThrow();
    });

    it('should handle empty grid without crashing', () => {
      const grid = parseHeightmap('');
      const origin = computeCameraOrigin(grid, 800, 600);

      expect(() => {
        preRenderRoom(grid, origin, 800, 600, 1);
      }).not.toThrow();
    });
  });

  describe('depthSort', () => {
    it('should sort renderables in back-to-front order', () => {
      // Create three test renderables at different positions
      const renderables: Renderable[] = [
        { tileX: 2, tileY: 0, tileZ: 0, draw: () => {} }, // sort key: 2.0
        { tileX: 0, tileY: 2, tileZ: 0, draw: () => {} }, // sort key: 2.0
        { tileX: 0, tileY: 0, tileZ: 5, draw: () => {} }, // sort key: 0.005
      ];

      const sorted = depthSort(renderables);

      // Expected order: [0,0,5], [0,2,0], [2,0,0]
      // (For same depth 2.0, higher tileX draws later)
      expect(sorted[0]).toMatchObject({ tileX: 0, tileY: 0, tileZ: 5 });
      expect(sorted[1]).toMatchObject({ tileX: 0, tileY: 2, tileZ: 0 });
      expect(sorted[2]).toMatchObject({ tileX: 2, tileY: 0, tileZ: 0 });
    });

    it('should handle empty array', () => {
      const sorted = depthSort([]);
      expect(sorted).toEqual([]);
    });

    it('should handle single renderable', () => {
      const renderables: Renderable[] = [
        { tileX: 1, tileY: 1, tileZ: 0, draw: () => {} },
      ];

      const sorted = depthSort(renderables);
      expect(sorted).toHaveLength(1);
      expect(sorted[0]).toMatchObject({ tileX: 1, tileY: 1, tileZ: 0 });
    });
  });
});
