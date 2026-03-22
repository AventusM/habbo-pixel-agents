// src/isoWallRenderer.ts
// Room perimeter wall renderer.
// Draws continuous wall panels rising ABOVE the floor along left and right edges,
// plus a back corner post where the two walls meet.
// Walls are drawn BEFORE floor tiles so they appear behind the floor.

import {
  TILE_W_HALF,
  TILE_H_HALF,
  WALL_HEIGHT,
  tileToScreen,
} from './isometricMath.js';
import type { TileGrid, HsbColor } from './isoTypes.js';
import { tileColors } from './isoTypes.js';

/**
 * Draw continuous wall panels rising above the floor along left and right edges,
 * plus a back corner post at tile (0,0).
 *
 * Each wall traces the outer edge of the floor, then extends WALL_HEIGHT
 * UPWARD (negative Y) to form the room enclosure behind the floor.
 *
 * Must be called BEFORE drawing floor tiles so walls appear behind.
 */
export function drawWallPanels(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  grid: TileGrid,
  cameraOrigin: { x: number; y: number },
  hsb: HsbColor,
  tileColorMap?: Map<string, HsbColor>,
): void {
  const tileHsb = (tileColorMap && tileColorMap.get('0,0')) || hsb;

  // --- LEFT WALL (rises above the left edge of the floor) ---
  const leftEdge: Array<{ tx: number; ty: number; height: number }> = [];
  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      const tile = grid.tiles[ty][tx];
      if (tile == null) continue;
      if (tx === 0 || grid.tiles[ty][tx - 1] == null) {
        leftEdge.push({ tx, ty, height: tile.height });
        break;
      }
    }
  }

  if (leftEdge.length > 0) {
    const { left } = tileColors(tileHsb);
    const bottomPoints: Array<{ x: number; y: number }> = [];

    // Start at back corner: top vertex of first left-edge tile
    const first = leftEdge[0];
    const { x: fsx, y: fsy } = tileToScreen(first.tx, first.ty, first.height);
    bottomPoints.push({
      x: fsx + cameraOrigin.x,
      y: fsy + cameraOrigin.y,
    });

    // Left vertex of each tile along the left edge
    for (const { tx, ty, height } of leftEdge) {
      const { x: sx, y: sy } = tileToScreen(tx, ty, height);
      bottomPoints.push({
        x: sx + cameraOrigin.x - TILE_W_HALF,
        y: sy + cameraOrigin.y + TILE_H_HALF,
      });
    }

    // Draw polygon: bottom edge forward, top edge (shifted up) backward
    ctx.beginPath();
    ctx.moveTo(bottomPoints[0].x, bottomPoints[0].y);
    for (let i = 1; i < bottomPoints.length; i++) {
      ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
    }
    for (let i = bottomPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y - WALL_HEIGHT);
    }
    ctx.closePath();
    ctx.fillStyle = left;
    ctx.fill();
  }

  // --- RIGHT WALL (rises above the right/top edge of the floor) ---
  const rightEdge: Array<{ tx: number; ty: number; height: number }> = [];
  for (let tx = 0; tx < grid.width; tx++) {
    for (let ty = 0; ty < grid.height; ty++) {
      const tile = grid.tiles[ty][tx];
      if (tile == null) continue;
      if (ty === 0 || grid.tiles[ty - 1]?.[tx] == null) {
        rightEdge.push({ tx, ty, height: tile.height });
        break;
      }
    }
  }

  if (rightEdge.length > 0) {
    const { right } = tileColors(tileHsb);
    const bottomPoints: Array<{ x: number; y: number }> = [];

    // Start at back corner: top vertex of first right-edge tile
    const first = rightEdge[0];
    const { x: fsx, y: fsy } = tileToScreen(first.tx, first.ty, first.height);
    bottomPoints.push({
      x: fsx + cameraOrigin.x,
      y: fsy + cameraOrigin.y,
    });

    // Right vertex of each tile along the right edge
    for (const { tx, ty, height } of rightEdge) {
      const { x: sx, y: sy } = tileToScreen(tx, ty, height);
      bottomPoints.push({
        x: sx + cameraOrigin.x + TILE_W_HALF,
        y: sy + cameraOrigin.y + TILE_H_HALF,
      });
    }

    ctx.beginPath();
    ctx.moveTo(bottomPoints[0].x, bottomPoints[0].y);
    for (let i = 1; i < bottomPoints.length; i++) {
      ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
    }
    for (let i = bottomPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y - WALL_HEIGHT);
    }
    ctx.closePath();
    ctx.fillStyle = right;
    ctx.fill();
  }
  // --- BACK CORNER POST ---
  const cornerTile = grid.tiles[0]?.[0];
  if (cornerTile != null) {
    const { x: sx, y: sy } = tileToScreen(0, 0, cornerTile.height);
    const screenX = sx + cameraOrigin.x;
    const screenY = sy + cameraOrigin.y;

    const cornerHsb = (tileColorMap && tileColorMap.get('0,0')) || hsb;
    const { left } = tileColors(cornerHsb);

    // Post rises UPWARD from tile top vertex
    ctx.fillStyle = left;
    ctx.fillRect(screenX - 2, screenY - WALL_HEIGHT, 4, WALL_HEIGHT);
  }
}

/**
 * Draw wall thickness edges — bottom-face strip and border lines.
 *
 * Must be called AFTER floor tiles so the edges render on top.
 *
 * Each wall gets:
 * - A bottom-face strip along the floor junction (the underside of the wall
 *   "ledge" — visible where wall meets floor). This is offset inward toward
 *   the room.
 * - A darker border line along the bottom edge of the wall panel.
 * - A lighter border line along the top edge (ceiling line).
 */
export function drawWallEdges(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  grid: TileGrid,
  cameraOrigin: { x: number; y: number },
  hsb: HsbColor,
  tileColorMap?: Map<string, HsbColor>,
): void {
  const DEPTH = 6;
  const tileHsb = (tileColorMap && tileColorMap.get('0,0')) || hsb;
  const colors = tileColors(tileHsb);

  // --- LEFT WALL bottom-face + borders ---
  const leftEdge: Array<{ tx: number; ty: number; height: number }> = [];
  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      const tile = grid.tiles[ty][tx];
      if (tile == null) continue;
      if (tx === 0 || grid.tiles[ty][tx - 1] == null) {
        leftEdge.push({ tx, ty, height: tile.height });
        break;
      }
    }
  }

  if (leftEdge.length > 0) {
    const pts: Array<{ x: number; y: number }> = [];
    const first = leftEdge[0];
    const { x: fsx, y: fsy } = tileToScreen(first.tx, first.ty, first.height);
    pts.push({ x: fsx + cameraOrigin.x, y: fsy + cameraOrigin.y });
    for (const { tx, ty, height } of leftEdge) {
      const { x: sx, y: sy } = tileToScreen(tx, ty, height);
      pts.push({ x: sx + cameraOrigin.x - TILE_W_HALF, y: sy + cameraOrigin.y + TILE_H_HALF });
    }

    // Bottom-face strip: offset inward (right+up in iso) from wall bottom edge
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      ctx[i === 0 ? 'moveTo' : 'lineTo'](pts[i].x, pts[i].y);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      ctx.lineTo(pts[i].x + DEPTH, pts[i].y - DEPTH / 2);
    }
    ctx.closePath();
    ctx.fillStyle = colors.right; // darkest shade for underside
    ctx.fill();

    // Border line along bottom edge
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = colors.right;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Border line along top edge (ceiling)
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y - WALL_HEIGHT);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y - WALL_HEIGHT);
    }
    ctx.strokeStyle = colors.right;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // --- RIGHT WALL bottom-face + borders ---
  const rightEdge: Array<{ tx: number; ty: number; height: number }> = [];
  for (let tx = 0; tx < grid.width; tx++) {
    for (let ty = 0; ty < grid.height; ty++) {
      const tile = grid.tiles[ty][tx];
      if (tile == null) continue;
      if (ty === 0 || grid.tiles[ty - 1]?.[tx] == null) {
        rightEdge.push({ tx, ty, height: tile.height });
        break;
      }
    }
  }

  if (rightEdge.length > 0) {
    const pts: Array<{ x: number; y: number }> = [];
    const first = rightEdge[0];
    const { x: fsx, y: fsy } = tileToScreen(first.tx, first.ty, first.height);
    pts.push({ x: fsx + cameraOrigin.x, y: fsy + cameraOrigin.y });
    for (const { tx, ty, height } of rightEdge) {
      const { x: sx, y: sy } = tileToScreen(tx, ty, height);
      pts.push({ x: sx + cameraOrigin.x + TILE_W_HALF, y: sy + cameraOrigin.y + TILE_H_HALF });
    }

    // Bottom-face strip: offset inward (left+up in iso) from wall bottom edge
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      ctx[i === 0 ? 'moveTo' : 'lineTo'](pts[i].x, pts[i].y);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      ctx.lineTo(pts[i].x - DEPTH, pts[i].y - DEPTH / 2);
    }
    ctx.closePath();
    ctx.fillStyle = colors.left; // medium shade for underside
    ctx.fill();

    // Border line along bottom edge
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = colors.left;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Border line along top edge (ceiling)
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y - WALL_HEIGHT);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y - WALL_HEIGHT);
    }
    ctx.strokeStyle = colors.left;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}
