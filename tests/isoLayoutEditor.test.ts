// tests/isoLayoutEditor.test.ts
// Unit tests for layout editor mouse-to-tile conversion

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getHoveredTile,
  drawHoverHighlight,
  toggleTileWalkability,
  setTileColor,
  gridToHeightmap,
} from '../src/isoLayoutEditor.js';
import type { TileGrid, HsbColor } from '../src/isoTypes.js';
import { parseHeightmap } from '../src/isoTypes.js';

describe('getHoveredTile', () => {
  // Mock React.MouseEvent factory
  function createMouseEvent(
    clientX: number,
    clientY: number,
    canvasWidth: number = 800,
    canvasHeight: number = 600,
    rectLeft: number = 0,
    rectTop: number = 0,
    rectWidth: number = 800,
    rectHeight: number = 600,
  ): React.MouseEvent<HTMLCanvasElement> {
    const canvas = {
      width: canvasWidth,
      height: canvasHeight,
      getBoundingClientRect: () => ({
        left: rectLeft,
        top: rectTop,
        width: rectWidth,
        height: rectHeight,
        right: rectLeft + rectWidth,
        bottom: rectTop + rectHeight,
        x: rectLeft,
        y: rectTop,
        toJSON: () => ({}),
      }),
    } as HTMLCanvasElement;

    return {
      clientX,
      clientY,
      currentTarget: canvas,
    } as React.MouseEvent<HTMLCanvasElement>;
  }

  it('converts center of canvas to tile coordinates', () => {
    // Canvas center at 400,300 with camera origin at 400,300
    const event = createMouseEvent(400, 300);
    const cameraOrigin = { x: 400, y: 300 };

    const result = getHoveredTile(event, cameraOrigin);

    // At camera origin (0,0 in world space), screenToTile returns (0,0)
    expect(result).toEqual({ tileX: 0, tileY: 0 });
  });

  it('handles canvas scaling with devicePixelRatio', () => {
    // Canvas with 2x DPR: physical 1600x1200, CSS 800x600
    // Mouse at CSS 200,150 → physical 400,300
    const event = createMouseEvent(200, 150, 1600, 1200, 0, 0, 800, 600);
    const cameraOrigin = { x: 400, y: 300 };

    const result = getHoveredTile(event, cameraOrigin);

    // Mouse at physical 400,300, camera at 400,300 → world (0,0) → tile (0,0)
    expect(result).toEqual({ tileX: 0, tileY: 0 });
  });

  it('adjusts for camera origin offset', () => {
    // Mouse at 432,316 in physical pixels
    // Camera origin at 400,300
    // World coords: (32, 16)
    // screenToTile(32, 16) = { x: 32/64 + 16/32, y: 16/32 - 32/64 } = { x: 1.0, y: 0 }
    const event = createMouseEvent(432, 316);
    const cameraOrigin = { x: 400, y: 300 };

    const result = getHoveredTile(event, cameraOrigin);

    expect(result).toEqual({ tileX: 1, tileY: 0 });
  });

  it('returns null for negative coordinates', () => {
    // Mouse at 368,284 with camera at 400,300
    // World coords: (-32, -16)
    // screenToTile(-32, -16) = { x: -0.5, y: -0.5 }
    // floor → (-1, -1) → null (outside grid)
    const event = createMouseEvent(368, 284);
    const cameraOrigin = { x: 400, y: 300 };

    const result = getHoveredTile(event, cameraOrigin);

    expect(result).toBeNull();
  });

  it('correctly identifies tile (0,0)', () => {
    // Mouse exactly at camera origin
    const event = createMouseEvent(400, 300);
    const cameraOrigin = { x: 400, y: 300 };

    const result = getHoveredTile(event, cameraOrigin);

    expect(result).toEqual({ tileX: 0, tileY: 0 });
  });

  it('converts multiple tile positions correctly', () => {
    const cameraOrigin = { x: 400, y: 300 };

    // Tile (2, 0): screenX = (2-0)*32 = 64, screenY = (2+0)*16 = 32
    // Mouse at 400+64, 300+32 = 464, 332
    const event1 = createMouseEvent(464, 332);
    expect(getHoveredTile(event1, cameraOrigin)).toEqual({ tileX: 2, tileY: 0 });

    // Tile (0, 2): screenX = (0-2)*32 = -64, screenY = (0+2)*16 = 32
    // Mouse at 400-64, 300+32 = 336, 332
    const event2 = createMouseEvent(336, 332);
    expect(getHoveredTile(event2, cameraOrigin)).toEqual({ tileX: 0, tileY: 2 });

    // Tile (1, 1): screenX = (1-1)*32 = 0, screenY = (1+1)*16 = 32
    // Mouse at 400+0, 300+32 = 400, 332
    const event3 = createMouseEvent(400, 332);
    expect(getHoveredTile(event3, cameraOrigin)).toEqual({ tileX: 1, tileY: 1 });
  });
});

describe('drawHoverHighlight', () => {
  let ctx: CanvasRenderingContext2D;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    // Create offscreen canvas for testing
    canvas = new OffscreenCanvas(800, 600) as unknown as HTMLCanvasElement;
    ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  });

  it('does not crash when called with valid tile coordinates', () => {
    expect(() => {
      drawHoverHighlight(ctx, 0, 0, 0, { x: 400, y: 300 });
    }).not.toThrow();
  });

  it('sets strokeStyle to yellow with 80% opacity', () => {
    drawHoverHighlight(ctx, 0, 0, 0, { x: 400, y: 300 });

    // Check that strokeStyle was set to yellow
    expect(ctx.strokeStyle).toBe('rgba(255, 255, 100, 0.8)');
  });

  it('calls stroke method to draw outline', () => {
    let strokeCalled = false;
    ctx.stroke = () => {
      strokeCalled = true;
    };

    drawHoverHighlight(ctx, 0, 0, 0, { x: 400, y: 300 });

    expect(strokeCalled).toBe(true);
  });

  it('handles different tile Z heights correctly', () => {
    // Smoke test for Z=5 (should offset Y coordinate)
    expect(() => {
      drawHoverHighlight(ctx, 2, 2, 5, { x: 400, y: 300 });
    }).not.toThrow();
  });
});

describe('editor operations', () => {
  it('toggleTileWalkability: walkable → void → walkable round-trip', () => {
    const grid = parseHeightmap('0\n1\n2');

    // Initial state: tile (0,0) is walkable with height 0
    expect(grid.tiles[0][0]).toEqual({ height: 0 });

    // Toggle to void
    toggleTileWalkability(grid, 0, 0);
    expect(grid.tiles[0][0]).toBeNull();

    // Toggle back to walkable (height 0)
    toggleTileWalkability(grid, 0, 0);
    expect(grid.tiles[0][0]).toEqual({ height: 0 });
  });

  it('setTileColor: color persists in map with correct key format', () => {
    const tileColorMap = new Map<string, HsbColor>();
    const color: HsbColor = { h: 120, s: 50, b: 75 };

    setTileColor(tileColorMap, 3, 5, color);

    expect(tileColorMap.get('3,5')).toEqual(color);
    expect(tileColorMap.size).toBe(1);
  });

  it('setTileColor: overwrites existing color for same tile', () => {
    const tileColorMap = new Map<string, HsbColor>();
    const color1: HsbColor = { h: 120, s: 50, b: 75 };
    const color2: HsbColor = { h: 240, s: 80, b: 60 };

    setTileColor(tileColorMap, 2, 3, color1);
    setTileColor(tileColorMap, 2, 3, color2);

    expect(tileColorMap.get('2,3')).toEqual(color2);
    expect(tileColorMap.size).toBe(1);
  });

  it('gridToHeightmap: serializes grid back to Habbo heightmap format correctly', () => {
    const originalHeightmap = '012\n345\n678';
    const grid = parseHeightmap(originalHeightmap);

    const serialized = gridToHeightmap(grid);

    expect(serialized).toBe(originalHeightmap);
  });

  it('gridToHeightmap: handles void tiles with x character', () => {
    const grid = parseHeightmap('0x2\nx1x\n2x0');

    const serialized = gridToHeightmap(grid);

    expect(serialized).toBe('0x2\nx1x\n2x0');
  });

  it('toggleTileWalkability: handles out-of-bounds gracefully', () => {
    const grid = parseHeightmap('000\n111');

    // Should not crash or modify grid
    expect(() => {
      toggleTileWalkability(grid, -1, 0);
      toggleTileWalkability(grid, 0, -1);
      toggleTileWalkability(grid, 100, 0);
      toggleTileWalkability(grid, 0, 100);
    }).not.toThrow();

    // Grid unchanged
    expect(grid.tiles[0][0]).toEqual({ height: 0 });
  });
});
