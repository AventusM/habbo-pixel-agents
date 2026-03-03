// src/isoTileRenderer.ts
// Pure canvas drawing module for isometric room rendering
// No React imports — pure TypeScript for testability

import {
  TILE_W,
  TILE_H,
  TILE_W_HALF,
  TILE_H_HALF,
  tileToScreen,
} from './isometricMath.js';
import type { TileGrid, HsbColor, Renderable } from './isoTypes.js';
import { tileColors, depthSort } from './isoTypes.js';
import {
  createFurnitureRenderable,
  createMultiTileFurnitureRenderable,
  createNitroFurnitureRenderable,
  createNitroMultiTileFurnitureRenderable,
  type FurnitureSpec,
  type MultiTileFurnitureSpec,
} from './isoFurnitureRenderer.js';
import type { SpriteCache } from './isoSpriteCache.js';
import { resolveAssetName } from './furnitureRegistry.js';

/**
 * Wall height in pixels — 4 tile heights (128px).
 * Wall strips hang below tile edges by this amount.
 */
export const WALL_HEIGHT = 128;

/**
 * Default HSB color for tiles without per-tile color set.
 * Habbo-style blue-grey floor.
 */
const DEFAULT_HSB: HsbColor = { h: 220, s: 25, b: 80 };

/**
 * Initialize a canvas for HiDPI rendering.
 * Sets physical pixel dimensions based on devicePixelRatio,
 * scales context, and disables image smoothing for crisp pixels.
 *
 * @param canvas - HTMLCanvasElement to initialize
 * @returns CanvasRenderingContext2D ready for drawing
 */
export function initCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;

  // Set physical pixel dimensions
  canvas.width = Math.floor(canvas.offsetWidth * dpr);
  canvas.height = Math.floor(canvas.offsetHeight * dpr);

  // Keep CSS size
  canvas.style.width = canvas.offsetWidth + 'px';
  canvas.style.height = canvas.offsetHeight + 'px';

  const ctx = canvas.getContext('2d')!;

  // Scale context for HiDPI
  ctx.scale(dpr, dpr);

  // Disable image smoothing for pixel-crisp rendering
  ctx.imageSmoothingEnabled = false;

  return ctx;
}

/**
 * Compute camera origin that centers the room in the viewport.
 * Returns the pixel offset to add to all tile screen coordinates.
 *
 * @param grid - TileGrid to compute bounds for
 * @param canvasCssWidth - Canvas width in CSS pixels
 * @param canvasCssHeight - Canvas height in CSS pixels
 * @returns Camera origin {x, y} to add to screen coordinates
 */
export function computeCameraOrigin(
  grid: TileGrid,
  canvasCssWidth: number,
  canvasCssHeight: number,
): { x: number; y: number } {
  // Find bounding box of all non-void tiles
  let minSx = Infinity;
  let maxSx = -Infinity;
  let minSy = Infinity;
  let maxSy = -Infinity;

  let hasNonVoidTiles = false;

  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      const tile = grid.tiles[ty][tx];
      if (tile == null) continue; // Skip void tiles

      hasNonVoidTiles = true;

      const { x: sx, y: sy } = tileToScreen(tx, ty, 0);

      // Tile rhombus bounds
      minSx = Math.min(minSx, sx - TILE_W_HALF);
      maxSx = Math.max(maxSx, sx + TILE_W_HALF);
      minSy = Math.min(minSy, sy);
      maxSy = Math.max(maxSy, sy + TILE_H);
    }
  }

  // If no non-void tiles, return origin at 0,0
  if (!hasNonVoidTiles) {
    return { x: 0, y: 0 };
  }

  // Add wall height to room height (for tallest wall)
  const roomW = maxSx - minSx;
  const roomH = maxSy - minSy + WALL_HEIGHT;

  // Center the room in the viewport
  return {
    x: Math.floor((canvasCssWidth - roomW) / 2) - minSx,
    y: Math.floor((canvasCssHeight - roomH) / 2) - minSy,
  };
}

/**
 * Pre-render complete room geometry to an OffscreenCanvas.
 * Draws floor rhombuses, wall strips, and furniture in depth-sorted order.
 *
 * @param grid - TileGrid to render
 * @param cameraOrigin - Camera offset to apply to all coordinates
 * @param physicalW - OffscreenCanvas width in physical pixels
 * @param physicalH - OffscreenCanvas height in physical pixels
 * @param dpr - Device pixel ratio for context scaling
 * @param defaultHsb - Optional default HSB color for tiles (overrides DEFAULT_HSB)
 * @param furniture - Optional array of single-tile furniture to render
 * @param multiTileFurniture - Optional array of multi-tile furniture to render
 * @param spriteCache - Sprite cache instance (required if furniture provided)
 * @param atlasName - Atlas name in sprite cache (default: 'furniture')
 * @returns OffscreenCanvas with rendered room
 */
export function preRenderRoom(
  grid: TileGrid,
  cameraOrigin: { x: number; y: number },
  physicalW: number,
  physicalH: number,
  dpr: number,
  defaultHsb?: HsbColor,
  furniture?: FurnitureSpec[],
  multiTileFurniture?: MultiTileFurnitureSpec[],
  spriteCache?: SpriteCache,
  atlasName: string = 'furniture',
  tileColorMap?: Map<string, HsbColor>,
): OffscreenCanvas {
  const offscreen = new OffscreenCanvas(physicalW, physicalH);
  const ctx = offscreen.getContext('2d')!;

  // Scale context for HiDPI
  ctx.scale(dpr, dpr);

  // Disable image smoothing for pixel-crisp rendering
  ctx.imageSmoothingEnabled = false;

  const hsb = defaultHsb || DEFAULT_HSB;

  // Build renderables array (one per non-void tile)
  const renderables: Renderable[] = [];

  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      const tile = grid.tiles[ty][tx];
      if (tile == null) continue; // Skip void tiles

      const tileZ = tile.height;

      renderables.push({
        tileX: tx,
        tileY: ty,
        tileZ: tileZ,
        draw: (ctx) => {
          // Compute screen position (add camera origin)
          const { x: sx, y: sy } = tileToScreen(tx, ty, tileZ);
          const screenX = sx + cameraOrigin.x;
          const screenY = sy + cameraOrigin.y;

          // Check for per-tile color override
          const tileKey = `${tx},${ty}`;
          const tileHsb = (tileColorMap && tileColorMap.get(tileKey)) || hsb;

          // Draw floor tile (top face)
          drawFloorTile(ctx, screenX, screenY, tileHsb);

          // Draw left wall strip (if on left edge or tile to left is void)
          if (tx === 0 || grid.tiles[ty][tx - 1] == null) {
            drawLeftFace(ctx, screenX, screenY, tileHsb);
          }

          // Draw right wall strip (if on top edge or tile above is void)
          if (ty === 0 || grid.tiles[ty - 1]?.[tx] == null) {
            drawRightFace(ctx, screenX, screenY, tileHsb);
          }
        },
      });
    }
  }

  // Add furniture renderables to unified depth-sort array
  // Try Nitro (real Habbo sprites) first, fall back to placeholder atlas
  if (furniture && spriteCache) {
    for (const furni of furniture) {
      const nitroName = resolveAssetName(furni.name);
      let furnitureRenderable = spriteCache.hasNitroAsset(nitroName)
        ? createNitroFurnitureRenderable(furni, spriteCache, nitroName)
        : null;

      // Fall back to placeholder atlas
      if (!furnitureRenderable) {
        furnitureRenderable = createFurnitureRenderable(furni, spriteCache, atlasName);
      }

      // Wrap the draw function to apply camera origin offset
      const originalDraw = furnitureRenderable.draw;
      furnitureRenderable.draw = (ctx) => {
        ctx.save();
        ctx.translate(cameraOrigin.x, cameraOrigin.y);
        originalDraw(ctx);
        ctx.restore();
      };

      renderables.push(furnitureRenderable);
    }
  }

  // Add multi-tile furniture renderables
  if (multiTileFurniture && spriteCache) {
    for (const furni of multiTileFurniture) {
      const nitroName = resolveAssetName(furni.name);
      let furnitureRenderable = spriteCache.hasNitroAsset(nitroName)
        ? createNitroMultiTileFurnitureRenderable(furni, spriteCache, nitroName)
        : null;

      // Fall back to placeholder atlas
      if (!furnitureRenderable) {
        furnitureRenderable = createMultiTileFurnitureRenderable(furni, spriteCache, atlasName);
      }

      // Wrap the draw function to apply camera origin offset
      const originalDraw = furnitureRenderable.draw;
      furnitureRenderable.draw = (ctx) => {
        ctx.save();
        ctx.translate(cameraOrigin.x, cameraOrigin.y);
        originalDraw(ctx);
        ctx.restore();
      };

      renderables.push(furnitureRenderable);
    }
  }

  // Depth sort (back-to-front painter's algorithm)
  const sorted = depthSort(renderables);

  // Draw all renderables in sorted order
  for (const renderable of sorted) {
    renderable.draw(ctx);
  }

  return offscreen;
}

/**
 * Draw floor tile top face (rhombus).
 * Module-private helper.
 */
function drawFloorTile(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  sx: number,
  sy: number,
  hsb: HsbColor,
): void {
  const { top } = tileColors(hsb);

  ctx.beginPath();
  ctx.moveTo(sx, sy); // top vertex
  ctx.lineTo(sx + TILE_W_HALF, sy + TILE_H_HALF); // right vertex
  ctx.lineTo(sx, sy + TILE_H); // bottom vertex
  ctx.lineTo(sx - TILE_W_HALF, sy + TILE_H_HALF); // left vertex
  ctx.closePath();

  ctx.fillStyle = top;
  ctx.fill();
}

/**
 * Draw left wall face (parallelogram hanging below left edge).
 * Module-private helper.
 */
function drawLeftFace(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  sx: number,
  sy: number,
  hsb: HsbColor,
): void {
  const { left } = tileColors(hsb);

  ctx.beginPath();
  ctx.moveTo(sx - TILE_W_HALF, sy + TILE_H_HALF); // left vertex of rhombus
  ctx.lineTo(sx, sy + TILE_H); // bottom vertex of rhombus
  ctx.lineTo(sx, sy + TILE_H + WALL_HEIGHT); // bottom-left of wall strip
  ctx.lineTo(sx - TILE_W_HALF, sy + TILE_H_HALF + WALL_HEIGHT); // top-left of wall strip
  ctx.closePath();

  ctx.fillStyle = left;
  ctx.fill();
}

/**
 * Draw right wall face (parallelogram hanging below right edge).
 * Module-private helper.
 */
function drawRightFace(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  sx: number,
  sy: number,
  hsb: HsbColor,
): void {
  const { right } = tileColors(hsb);

  ctx.beginPath();
  ctx.moveTo(sx + TILE_W_HALF, sy + TILE_H_HALF); // right vertex of rhombus
  ctx.lineTo(sx, sy + TILE_H); // bottom vertex of rhombus
  ctx.lineTo(sx, sy + TILE_H + WALL_HEIGHT); // bottom-right of wall strip
  ctx.lineTo(sx + TILE_W_HALF, sy + TILE_H_HALF + WALL_HEIGHT); // top-right of wall strip
  ctx.closePath();

  ctx.fillStyle = right;
  ctx.fill();
}
