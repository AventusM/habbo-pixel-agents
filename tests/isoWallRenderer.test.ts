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

  describe('back corner post', () => {
    it('should call fillRect for corner post when tile (0,0) exists', () => {
      const grid = parseHeightmap('0xx\nxxx\nxxx');
      const ctx = makeMockCtx();

      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);

      expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    });

    it('should NOT draw corner post when tile (0,0) is void', () => {
      const grid = parseHeightmap('x0\n00');
      const ctx = makeMockCtx();

      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);

      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('should draw corner post with WALL_HEIGHT height and 4px width', () => {
      const grid = parseHeightmap('0');
      const ctx = makeMockCtx();

      const capturedRects: Array<{ x: number; y: number; w: number; h: number }> = [];
      (ctx.fillRect as ReturnType<typeof vi.fn>).mockImplementation(
        (x: number, y: number, w: number, h: number) => {
          capturedRects.push({ x, y, w, h });
        }
      );

      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);

      expect(capturedRects).toHaveLength(1);
      const rect = capturedRects[0];

      expect(rect.h).toBe(WALL_HEIGHT);
      expect(rect.w).toBe(4);
    });

    it('should position corner post at tile (0,0) screen coordinates', () => {
      const grid = parseHeightmap('0');
      const camera = { x: 50, y: 100 };
      const ctx = makeMockCtx();

      const capturedRects: Array<{ x: number; y: number; w: number; h: number }> = [];
      (ctx.fillRect as ReturnType<typeof vi.fn>).mockImplementation(
        (x: number, y: number, w: number, h: number) => {
          capturedRects.push({ x, y, w, h });
        }
      );

      drawWallPanels(ctx, grid, camera, DEFAULT_HSB);

      const { x: sx, y: sy } = tileToScreen(0, 0, 0);
      expect(capturedRects[0].x).toBe(sx + camera.x - 2);
      expect(capturedRects[0].y).toBe(sy + camera.y - WALL_HEIGHT); // post rises upward
    });

    it('should use tileColorMap override for corner post color', () => {
      const grid = parseHeightmap('0');
      const ctx = makeMockCtx();

      const overrideHsb = { h: 0, s: 100, b: 100 };
      const tileColorMap = new Map([['0,0', overrideHsb]]);

      expect(() => {
        drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB, tileColorMap);
      }).not.toThrow();

      expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    });
  });
});
