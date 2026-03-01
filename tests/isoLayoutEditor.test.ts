// tests/isoLayoutEditor.test.ts
// Unit tests for layout editor mouse-to-tile conversion

import { describe, it, expect, beforeEach } from 'vitest';
import { getHoveredTile, drawHoverHighlight } from '../src/isoLayoutEditor.js';

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
