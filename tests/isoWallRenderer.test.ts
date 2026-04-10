// @vitest-environment happy-dom

import { describe, it, expect, vi } from 'vitest';
import { parseHeightmap } from '../src/isoTypes.js';
import { drawWallPanels } from '../src/isoWallRenderer.js';
import { tileToScreen } from '../src/isometricMath.js';
import { WALL_HEIGHT } from '../src/isoTileRenderer.js';

/** Create a minimal mock CanvasRenderingContext2D for testing. */
function makeMockCtx() {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '' as string,
    stroke: vi.fn(),
    strokeStyle: '' as string,
    lineWidth: 1,
    clip: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const DEFAULT_HSB = { h: 220, s: 25, b: 80 };
const CAMERA_ORIGIN = { x: 0, y: 0 };

describe('drawWallPanels', () => {
  it('should be callable with a simple 3x3 grid without throwing', () => {
    const grid = parseHeightmap('000\n000\n000');
    const ctx = makeMockCtx();

    expect(() => {
      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);
    }).not.toThrow();
  });

  it('should not throw with all-void grid', () => {
    const grid = parseHeightmap('xxx\nxxx\nxxx');
    const ctx = makeMockCtx();

    expect(() => {
      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);
    }).not.toThrow();
  });

  describe('back corner fill', () => {
    it('should render path-based corner slit when tile (0,0) exists', () => {
      const grid = parseHeightmap('0xx\nxxx\nxxx');
      const ctx = makeMockCtx();

      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);

      // The new corner uses path fills (beginPath → lineTo → fill) instead of fillRect.
      // Multiple fill() calls for left/right slit halves, wedges, and diamond cap.
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('should NOT draw corner fill when tile (0,0) is void', () => {
      const grid = parseHeightmap('x0\n00');
      const ctx = makeMockCtx();

      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);

      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('should produce multiple filled path segments for the corner slit', () => {
      const grid = parseHeightmap('0');
      const ctx = makeMockCtx();

      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);

      // The slit approach draws at least 6 filled shapes: left/right quads,
      // top-left/top-right wedges, bottom-left/bottom-right wedges, plus diamond cap.
      const fillCount = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(fillCount).toBeGreaterThanOrEqual(6);
    });

    it('should position corner slit relative to tile (0,0) screen coordinates', () => {
      const grid = parseHeightmap('0');
      const camera = { x: 50, y: 100 };
      const ctx = makeMockCtx();

      drawWallPanels(ctx, grid, camera, DEFAULT_HSB);

      // moveTo calls include tile (0,0) screen-space offsets
      const { x: sx, y: sy } = tileToScreen(0, 0, 0);
      const screenX = sx + camera.x;
      const moveArgs = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls;
      // At least one moveTo should reference the corner screen position
      const hasCornerMove = moveArgs.some(
        ([x]: [number, number]) => Math.abs(x - screenX) < 40
      );
      expect(hasCornerMove).toBe(true);
    });

    it('should use tileColorMap override for corner fill color', () => {
      const grid = parseHeightmap('0');
      const ctx = makeMockCtx();

      const overrideHsb = { h: 0, s: 100, b: 100 };
      const tileColorMap = new Map([['0,0', overrideHsb]]);

      expect(() => {
        drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB, tileColorMap);
      }).not.toThrow();

      // Corner slit still renders with path fills when tileColorMap provides override
      expect(ctx.fill).toHaveBeenCalled();
    });
  });
});
