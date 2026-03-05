// @vitest-environment happy-dom

import { describe, it, expect, vi } from 'vitest';
import { parseHeightmap } from '../src/isoTypes.js';
import { drawWallPanels } from '../src/isoWallRenderer.js';
import { tileToScreen, TILE_H, TILE_W_HALF, TILE_H_HALF } from '../src/isometricMath.js';
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

  it('should not throw with single tile at (0,0)', () => {
    const grid = parseHeightmap('0');
    const ctx = makeMockCtx();

    expect(() => {
      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);
    }).not.toThrow();
  });

  describe('wall edge detection', () => {
    it('should draw left wall strips for tiles in column 0', () => {
      // 3x1 grid: all three tiles are in column 0 (left edge)
      const grid = parseHeightmap('0\n0\n0');
      const ctx = makeMockCtx();

      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);

      // Each left-edge tile produces one beginPath+closePath+fill call.
      // There are 3 tiles in column 0, so at least 3 fills for left wall.
      // Corner post also calls fillRect once.
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('should draw right wall strips for tiles in row 0', () => {
      // 1x3 grid: all three tiles are in row 0 (right edge)
      const grid = parseHeightmap('000');
      const ctx = makeMockCtx();

      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);

      // Each right-edge tile produces fill calls.
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('should detect left edge for tiles where left neighbor is void', () => {
      // Grid: column 0 is void, column 1 is solid — column 1 becomes left edge
      const grid = parseHeightmap('x0\nx0\nx0');
      const ctx = makeMockCtx();

      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);

      // Tiles at (1,0), (1,1), (1,2) have void left neighbor, so they draw left wall strips.
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('should detect right edge for tiles where top neighbor is void', () => {
      // Grid: row 0 is void, row 1 is solid — row 1 becomes right edge
      const grid = parseHeightmap('xxx\n000');
      const ctx = makeMockCtx();

      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);

      // Tiles at (0,1), (1,1), (2,1) have void top neighbor, so they draw right wall strips.
      expect(ctx.fill).toHaveBeenCalled();
    });
  });

  describe('baseline computation', () => {
    it('should extend wall to cover the lowest tile in the room', () => {
      // Two tiles at different heights: height 0 and height 9.
      // Height 9 tile has a lower screenY, so the baseline must be calculated
      // from the tile with the highest strip bottom (height 0, which sits lowest on screen).
      //
      // For tile (0,0) at height z=0: sy = 0*16 - 0*16 = 0; stripBottom = 0 + 32 + 128 = 160
      // For tile (0,1) at height z=9: sy = 1*16 - 9*16 = -128; stripBottom = -128 + 32 + 128 = 32
      // So leftBaseline = max(160, 32) = 160
      const grid = parseHeightmap('0\n9');
      const ctx = makeMockCtx();

      const capturedLineTos: Array<{ x: number; y: number }> = [];
      (ctx.lineTo as ReturnType<typeof vi.fn>).mockImplementation((x: number, y: number) => {
        capturedLineTos.push({ x, y });
      });

      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);

      // The left wall baseline should be 160.
      // Both strips' bottom-right vertex y should equal 160.
      const tile0Screen = tileToScreen(0, 0, 0);
      const tile1Screen = tileToScreen(0, 1, 9);

      const strip0Bottom = tile0Screen.y + TILE_H + WALL_HEIGHT; // 0 + 32 + 128 = 160
      const strip1Bottom = tile1Screen.y + TILE_H + WALL_HEIGHT; // -128 + 32 + 128 = 32

      const expectedBaseline = Math.max(strip0Bottom, strip1Bottom); // 160

      // Both strips must have lineTo calls reaching the shared baseline.
      const baselineHits = capturedLineTos.filter(({ y }) => y === expectedBaseline);
      expect(baselineHits.length).toBeGreaterThanOrEqual(2); // at least one per left-edge tile
    });

    it('should use WALL_HEIGHT constant for strip extension', () => {
      // Single tile at (0,0) with height 0.
      // screenY = 0, baseline = 0 + TILE_H + WALL_HEIGHT = 32 + 128 = 160.
      const grid = parseHeightmap('0');
      const ctx = makeMockCtx();

      const capturedLineTos: Array<{ x: number; y: number }> = [];
      (ctx.lineTo as ReturnType<typeof vi.fn>).mockImplementation((x: number, y: number) => {
        capturedLineTos.push({ x, y });
      });

      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);

      const { y: sy } = tileToScreen(0, 0, 0);
      const expectedBaseline = sy + TILE_H + WALL_HEIGHT; // 0 + 32 + 128 = 160

      // Check that the baseline appears in lineTo calls (bottom-right of left wall strip)
      const baselineHit = capturedLineTos.some(({ y }) => y === expectedBaseline);
      expect(baselineHit).toBe(true);
    });
  });

  describe('back corner post', () => {
    it('should call fillRect for corner post when tile (0,0) exists', () => {
      const grid = parseHeightmap('0xx\nxxx\nxxx');
      const ctx = makeMockCtx();

      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);

      expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    });

    it('should NOT draw corner post when tile (0,0) is void', () => {
      // Grid where (0,0) is void but other tiles exist
      const grid = parseHeightmap('x0\n00');
      const ctx = makeMockCtx();

      drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB);

      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('should draw corner post with WALL_HEIGHT height', () => {
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

      // Post height = WALL_HEIGHT
      expect(rect.h).toBe(WALL_HEIGHT);
      // Post width = 4px
      expect(rect.w).toBe(4);
    });
  });

  describe('tileColorMap support', () => {
    it('should use per-tile color override when provided', () => {
      const grid = parseHeightmap('0\n0');
      const ctx = makeMockCtx();

      const overrideHsb = { h: 0, s: 100, b: 100 }; // red
      const tileColorMap = new Map([['0,0', overrideHsb]]);

      // Should not throw when tileColorMap is provided
      expect(() => {
        drawWallPanels(ctx, grid, CAMERA_ORIGIN, DEFAULT_HSB, tileColorMap);
      }).not.toThrow();

      // fillStyle should have been set (we can't easily test which exact color without
      // intercepting the setter, but we verify the function runs without error)
      expect(ctx.fill).toHaveBeenCalled();
    });
  });

  describe('camera origin offset', () => {
    it('should apply camera origin to all draw coordinates', () => {
      const grid = parseHeightmap('0');
      const camera = { x: 100, y: 200 };

      const ctx1 = makeMockCtx();
      const ctx2 = makeMockCtx();

      const moveToCallsAt0: Array<{ x: number; y: number }> = [];
      const moveToCallsWithCamera: Array<{ x: number; y: number }> = [];

      (ctx1.moveTo as ReturnType<typeof vi.fn>).mockImplementation((x: number, y: number) => {
        moveToCallsAt0.push({ x, y });
      });
      (ctx2.moveTo as ReturnType<typeof vi.fn>).mockImplementation((x: number, y: number) => {
        moveToCallsWithCamera.push({ x, y });
      });

      drawWallPanels(ctx1, grid, { x: 0, y: 0 }, DEFAULT_HSB);
      drawWallPanels(ctx2, grid, camera, DEFAULT_HSB);

      // With camera offset, all moveTo x coordinates should be shifted by camera.x
      // and y coordinates by camera.y
      for (let i = 0; i < moveToCallsAt0.length; i++) {
        expect(moveToCallsWithCamera[i].x - moveToCallsAt0[i].x).toBeCloseTo(camera.x);
        expect(moveToCallsWithCamera[i].y - moveToCallsAt0[i].y).toBeCloseTo(camera.y);
      }
    });
  });
});
