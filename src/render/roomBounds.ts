// src/render/roomBounds.ts
// Room world-extent math shared by CanvasStage (buffer sizing + initial fit)
// and the layer pipeline (M003/S03).

import { tileToScreen, TILE_W_HALF, TILE_H, WALL_HEIGHT } from '../isometricMath.js';
import { clampZoom } from '../cameraController.js';
import type { TileGrid } from '../isoTypes.js';

/**
 * Zoom level that fits the whole room (floor + walls) into the viewport.
 * Uses the same bounding math as computeCameraOrigin; clamped ≤ 1 so desktop
 * layouts that already fit are unaffected. Returns ≥ clampZoom minimum.
 */
export function computeRoomBounds(grid: TileGrid): { roomW: number; roomH: number } {
  let minSx = Infinity, maxSx = -Infinity, minSy = Infinity, maxSy = -Infinity;
  let hasTiles = false;
  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      if (grid.tiles[ty][tx] == null) continue;
      hasTiles = true;
      const { x: sx, y: sy } = tileToScreen(tx, ty, 0);
      minSx = Math.min(minSx, sx - TILE_W_HALF);
      maxSx = Math.max(maxSx, sx + TILE_W_HALF);
      minSy = Math.min(minSy, sy);
      maxSy = Math.max(maxSy, sy + TILE_H);
    }
  }
  if (!hasTiles) return { roomW: 0, roomH: 0 };
  return { roomW: maxSx - minSx, roomH: (maxSy - minSy) + WALL_HEIGHT };
}

export function computeFitZoom(
  grid: TileGrid,
  viewportWidth: number,
  viewportHeight: number,
): number {
  const { roomW, roomH } = computeRoomBounds(grid);
  if (roomW === 0 || roomH === 0) return 1;
  return clampZoom(Math.min(1, viewportWidth / roomW, viewportHeight / roomH));
}
