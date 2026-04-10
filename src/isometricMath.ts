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
 * Wall height in pixels — 4 tile heights (128px).
 * Wall strips hang below tile edges by this amount.
 */
export const WALL_HEIGHT = 128;

/**
 * Floor slab thickness in pixels.
 * Draws darker side faces below front-facing tile edges for depth.
 */
export const FLOOR_THICKNESS = 6;

/**
 * Wall slab thickness in pixels.
 * Draws a visible top cap and front face on wall panels for 3D depth.
 */
export const WALL_THICKNESS = 10;

/**
 * Convert isometric tile coordinates to screen pixel coordinates.
 * Returns the TOP VERTEX of the tile rhombus (before camera offset).
 *
 * Formula: screenX = (tileX - tileY) * TILE_W_HALF
 *          screenY = (tileX + tileY) * TILE_H_HALF - tileZ * TILE_H_HALF
 *
 * @param tileX - Tile column (increases rightward in isometric view)
 * @param tileY - Tile row (increases leftward in isometric view)
 * @param tileZ - Height level 0-9 (each level raises tile by TILE_H_HALF px upward)
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
 * Returns floats — use Math.floor() for tile index picking.
 *
 * Inverse derivation (at z=0):
 *   x - y = screenX / TILE_W_HALF  and  x + y = screenY / TILE_H_HALF
 *   Simplified: x = screenX/TILE_W + screenY/TILE_H
 *               y = screenY/TILE_H - screenX/TILE_W
 *
 * @param screenX - Screen X coordinate (with camera offset already subtracted)
 * @param screenY - Screen Y coordinate (with camera offset already subtracted)
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
 * Return the Habbo direction (0-7) for a BFS step from (fromX,fromY) to (toX,toY).
 * Input deltas must each be -1, 0, or 1.
 *
 * Habbo direction system (clockwise from North-East):
 *   0=NE  1=E   2=SE  3=S
 *   4=SW  5=W   6=NW  7=N
 *
 * Default fallback: 2 (SE) for unrecognised delta — callers must ensure BFS step deltas.
 */
export function getDirection(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
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
