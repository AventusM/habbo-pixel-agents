// src/isoLayoutEditor.ts
// Layout editor mouse-to-tile conversion and hover highlight rendering
// Pure TypeScript module for interactive isometric grid editing

import {
  TILE_W_HALF,
  TILE_H_HALF,
  tileToScreen,
  screenToTile,
} from './isometricMath.js';
import type { HsbColor } from './isoTypes.js';

/**
 * Convert a React mouse event to isometric tile coordinates.
 * Uses inverse isometric transform with z=0 assumption (Strategy B).
 *
 * @param event - React mouse event from canvas element
 * @param cameraOrigin - Camera offset {x, y} to subtract from mouse position
 * @returns Tile coordinates {tileX, tileY} or null if outside grid
 */
export function getHoveredTile(
  event: React.MouseEvent<HTMLCanvasElement>,
  cameraOrigin: { x: number; y: number },
): { tileX: number; tileY: number } | null {
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();

  // Calculate scale factors for HiDPI canvas
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  // Get mouse position in physical pixels
  const mouseX = (event.clientX - rect.left) * scaleX;
  const mouseY = (event.clientY - rect.top) * scaleY;

  // Adjust for camera origin (subtract camera offset to get world coordinates)
  const adjX = mouseX - cameraOrigin.x;
  const adjY = mouseY - cameraOrigin.y;

  // Convert screen coordinates to tile coordinates (z=0 assumption)
  const { x, y } = screenToTile(adjX, adjY);

  // Floor to integer tile indices
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);

  // Return null if coordinates are negative (outside grid bounds)
  if (tileX < 0 || tileY < 0) {
    return null;
  }

  return { tileX, tileY };
}

/**
 * Draw a yellow rhombus outline at the specified tile position.
 * Used for hover highlighting in editor mode.
 *
 * @param ctx - Canvas 2D rendering context
 * @param tileX - Tile X coordinate
 * @param tileY - Tile Y coordinate
 * @param tileZ - Tile Z coordinate (height level)
 * @param cameraOrigin - Camera offset to add to screen position
 */
export function drawHoverHighlight(
  ctx: CanvasRenderingContext2D,
  tileX: number,
  tileY: number,
  tileZ: number,
  cameraOrigin: { x: number; y: number },
): void {
  // Get screen position for tile top vertex
  const { x: sx, y: sy } = tileToScreen(tileX, tileY, tileZ);

  // Save context state
  ctx.save();

  // Translate by camera origin
  ctx.translate(cameraOrigin.x, cameraOrigin.y);

  // Set stroke style (yellow with 80% opacity per research)
  ctx.strokeStyle = 'rgba(255, 255, 100, 0.8)';
  ctx.lineWidth = 2;

  // Draw rhombus outline (same path as floor tiles)
  ctx.beginPath();
  ctx.moveTo(sx, sy); // Top vertex
  ctx.lineTo(sx + TILE_W_HALF, sy + TILE_H_HALF); // Right vertex
  ctx.lineTo(sx, sy + TILE_H_HALF * 2); // Bottom vertex
  ctx.lineTo(sx - TILE_W_HALF, sy + TILE_H_HALF); // Left vertex
  ctx.closePath();
  ctx.stroke();

  // Restore context state
  ctx.restore();
}
