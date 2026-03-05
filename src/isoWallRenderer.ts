// src/isoWallRenderer.ts
// Full-height room perimeter wall panel renderer.
// Replaces per-tile wall strips with continuous panels that extend to a shared baseline,
// eliminating gaps between tiles at different heights.

import {
  TILE_W_HALF,
  TILE_H_HALF,
  TILE_H,
  tileToScreen,
} from './isometricMath.js';
import type { TileGrid, HsbColor } from './isoTypes.js';
import { tileColors } from './isoTypes.js';
import { WALL_HEIGHT } from './isoTileRenderer.js';

/**
 * Draw full-height wall panels along the left and right room perimeter edges,
 * plus a back corner post at tile (0,0).
 *
 * Wall drawing order: must be called BEFORE drawing floor tiles so walls appear
 * behind all floor tiles in the depth sort.
 *
 * Left wall panels: tiles where tx === 0 or left neighbor (tx-1) is void.
 * Right wall panels: tiles where ty === 0 or top neighbor (ty-1) is void.
 *
 * All strips for each wall side share a common baseline (the lowest strip bottom)
 * so there are no gaps between tiles at different heights.
 *
 * @param ctx - Canvas rendering context (OffscreenCanvas or regular)
 * @param grid - TileGrid to scan for wall edges
 * @param cameraOrigin - Camera offset to apply to all coordinates
 * @param hsb - Default HSB color for wall faces
 * @param tileColorMap - Optional per-tile color overrides keyed as "tx,ty"
 */
export function drawWallPanels(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  grid: TileGrid,
  cameraOrigin: { x: number; y: number },
  hsb: HsbColor,
  tileColorMap?: Map<string, HsbColor>,
): void {
  // --- Collect left-edge tiles (left wall) ---
  // Left wall: tiles where tx === 0 OR the tile to the left (tx-1) is void.
  const leftEdgeTiles: Array<{ tx: number; ty: number; tileZ: number; hsb: HsbColor }> = [];

  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      const tile = grid.tiles[ty][tx];
      if (tile == null) continue;

      const isLeftEdge = tx === 0 || grid.tiles[ty][tx - 1] == null;
      if (!isLeftEdge) continue;

      const tileKey = `${tx},${ty}`;
      const tileHsb = (tileColorMap && tileColorMap.get(tileKey)) || hsb;
      leftEdgeTiles.push({ tx, ty, tileZ: tile.height, hsb: tileHsb });
    }
  }

  // --- Collect right-edge tiles (right wall) ---
  // Right wall: tiles where ty === 0 OR the tile above (ty-1) is void.
  const rightEdgeTiles: Array<{ tx: number; ty: number; tileZ: number; hsb: HsbColor }> = [];

  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      const tile = grid.tiles[ty][tx];
      if (tile == null) continue;

      const isRightEdge = ty === 0 || grid.tiles[ty - 1]?.[tx] == null;
      if (!isRightEdge) continue;

      const tileKey = `${tx},${ty}`;
      const tileHsb = (tileColorMap && tileColorMap.get(tileKey)) || hsb;
      rightEdgeTiles.push({ tx, ty, tileZ: tile.height, hsb: tileHsb });
    }
  }

  // --- Compute shared baseline for left wall ---
  // The baseline is the maximum (sy + TILE_H) across all left-edge tiles,
  // then extended downward by WALL_HEIGHT so every strip reaches it.
  let leftBaseline = -Infinity;
  for (const { tx, ty, tileZ } of leftEdgeTiles) {
    const { y: sy } = tileToScreen(tx, ty, tileZ);
    const screenY = sy + cameraOrigin.y;
    const stripBottom = screenY + TILE_H + WALL_HEIGHT;
    if (stripBottom > leftBaseline) {
      leftBaseline = stripBottom;
    }
  }

  // --- Compute shared baseline for right wall ---
  let rightBaseline = -Infinity;
  for (const { tx, ty, tileZ } of rightEdgeTiles) {
    const { y: sy } = tileToScreen(tx, ty, tileZ);
    const screenY = sy + cameraOrigin.y;
    const stripBottom = screenY + TILE_H + WALL_HEIGHT;
    if (stripBottom > rightBaseline) {
      rightBaseline = stripBottom;
    }
  }

  // --- Draw left wall strips ---
  // Each strip is a parallelogram from the tile's left edge down to the shared baseline.
  // The parallelogram maintains the isometric shear angle (30-deg slant).
  //
  // Vertices (screen coordinates):
  //   Top-left:    (sx - TILE_W_HALF, sy + TILE_H_HALF)   — left vertex of floor rhombus
  //   Top-right:   (sx,               sy + TILE_H)         — bottom vertex of floor rhombus
  //   Bottom-right:(sx,               leftBaseline)
  //   Bottom-left: (sx - TILE_W_HALF, leftBaseline - TILE_H_HALF)
  for (const { tx, ty, tileZ, hsb: tileHsb } of leftEdgeTiles) {
    const { x: sx, y: sy } = tileToScreen(tx, ty, tileZ);
    const screenX = sx + cameraOrigin.x;
    const screenY = sy + cameraOrigin.y;

    const { left } = tileColors(tileHsb);

    ctx.beginPath();
    ctx.moveTo(screenX - TILE_W_HALF, screenY + TILE_H_HALF);        // top-left
    ctx.lineTo(screenX, screenY + TILE_H);                            // top-right
    ctx.lineTo(screenX, leftBaseline);                                // bottom-right
    ctx.lineTo(screenX - TILE_W_HALF, leftBaseline - TILE_H_HALF);   // bottom-left
    ctx.closePath();

    ctx.fillStyle = left;
    ctx.fill();
  }

  // --- Draw right wall strips ---
  // Each strip is a parallelogram from the tile's right edge down to the shared baseline.
  //
  // Vertices (screen coordinates):
  //   Top-left:    (sx,               sy + TILE_H)         — bottom vertex of floor rhombus
  //   Top-right:   (sx + TILE_W_HALF, sy + TILE_H_HALF)   — right vertex of floor rhombus
  //   Bottom-right:(sx + TILE_W_HALF, rightBaseline - TILE_H_HALF)
  //   Bottom-left: (sx,               rightBaseline)
  for (const { tx, ty, tileZ, hsb: tileHsb } of rightEdgeTiles) {
    const { x: sx, y: sy } = tileToScreen(tx, ty, tileZ);
    const screenX = sx + cameraOrigin.x;
    const screenY = sy + cameraOrigin.y;

    const { right } = tileColors(tileHsb);

    ctx.beginPath();
    ctx.moveTo(screenX, screenY + TILE_H);                             // top-left
    ctx.lineTo(screenX + TILE_W_HALF, screenY + TILE_H_HALF);         // top-right
    ctx.lineTo(screenX + TILE_W_HALF, rightBaseline - TILE_H_HALF);   // bottom-right
    ctx.lineTo(screenX, rightBaseline);                                // bottom-left
    ctx.closePath();

    ctx.fillStyle = right;
    ctx.fill();
  }

  // --- Draw back corner post at tile (0,0) ---
  // Thin vertical rectangle (4px wide) filling the junction between left and right walls.
  const cornerTile = grid.tiles[0]?.[0];
  if (cornerTile != null) {
    const tileZ = cornerTile.height;
    const { x: sx, y: sy } = tileToScreen(0, 0, tileZ);
    const screenX = sx + cameraOrigin.x;
    const screenY = sy + cameraOrigin.y;

    const tileKey = '0,0';
    const tileHsb = (tileColorMap && tileColorMap.get(tileKey)) || hsb;
    const { left } = tileColors(tileHsb);

    // Post starts at top of tile (sy) and extends down WALL_HEIGHT pixels
    const postTop = screenY;
    const postBottom = screenY + WALL_HEIGHT;
    const postX = screenX - 2; // 4px wide centered at tile top vertex

    ctx.fillStyle = left;
    ctx.fillRect(postX, postTop, 4, postBottom - postTop);
  }
}
