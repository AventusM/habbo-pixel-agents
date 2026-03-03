// src/isoLayoutEditor.ts
// Layout editor mouse-to-tile conversion and hover highlight rendering
// Pure TypeScript module for interactive isometric grid editing

import {
  TILE_W_HALF,
  TILE_H_HALF,
  tileToScreen,
  screenToTile,
} from './isometricMath.js';
import type { HsbColor, TileGrid } from './isoTypes.js';
import type { FurnitureSpec, MultiTileFurnitureSpec } from './isoFurnitureRenderer.js';
import { getFurnitureDimensions } from './furnitureRegistry.js';
import type { SpriteCache } from './isoSpriteCache.js';

/**
 * Editor mode enum
 */
export type EditorMode = 'view' | 'paint' | 'color' | 'furniture';

/**
 * Editor state for tracking current editor mode and selection
 */
export interface EditorState {
  mode: EditorMode;
  hoveredTile: { x: number; y: number; z: number } | null;
  selectedColor: HsbColor;
  selectedFurniture?: string;
  furnitureDirection?: number;
}

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

/**
 * Toggle tile walkability (void ↔ walkable).
 * Mutates grid in place.
 *
 * @param grid - TileGrid to modify
 * @param tileX - Tile X coordinate
 * @param tileY - Tile Y coordinate
 */
export function toggleTileWalkability(
  grid: TileGrid,
  tileX: number,
  tileY: number,
): void {
  // Check bounds
  if (tileY < 0 || tileY >= grid.height || tileX < 0 || tileX >= grid.width) {
    return;
  }

  const tile = grid.tiles[tileY][tileX];

  if (tile === null) {
    // Tile is void → make walkable at height 0
    grid.tiles[tileY][tileX] = { height: 0 };
  } else {
    // Tile is walkable → make void
    grid.tiles[tileY][tileX] = null;
  }
}

/**
 * Set color for a specific tile.
 * Mutates tileColorMap in place.
 *
 * @param tileColorMap - Map of tile coordinates to colors
 * @param tileX - Tile X coordinate
 * @param tileY - Tile Y coordinate
 * @param color - HSB color to set
 */
export function setTileColor(
  tileColorMap: Map<string, HsbColor>,
  tileX: number,
  tileY: number,
  color: HsbColor,
): void {
  const key = `${tileX},${tileY}`;
  tileColorMap.set(key, color);
}

/**
 * Convert TileGrid back to Habbo heightmap string format.
 * Inverse of parseHeightmap.
 *
 * @param grid - TileGrid to serialize
 * @returns Heightmap string (rows separated by newlines)
 */
export function gridToHeightmap(grid: TileGrid): string {
  return grid.tiles
    .map(row => row.map(tile => (tile ? String(tile.height) : 'x')).join(''))
    .join('\n');
}

/**
 * Place furniture at specified tile position.
 * Validates bounds and walkability before placement.
 *
 * @param grid - TileGrid for bounds validation
 * @param furnitureList - List of single-tile furniture
 * @param multiTileFurnitureList - List of multi-tile furniture
 * @param tileX - Tile X coordinate
 * @param tileY - Tile Y coordinate
 * @param furnitureType - Furniture type name
 * @param direction - Habbo direction (0, 2, 4, 6)
 * @returns true if placement succeeded, false if rejected
 */
export function placeFurniture(
  grid: TileGrid,
  furnitureList: FurnitureSpec[],
  multiTileFurnitureList: MultiTileFurnitureSpec[],
  tileX: number,
  tileY: number,
  furnitureType: string,
  direction: number,
  spriteCache?: SpriteCache,
): boolean {
  const { widthTiles, heightTiles } = spriteCache
    ? getFurnitureDimensions(furnitureType, spriteCache)
    : { widthTiles: 1, heightTiles: 1 };

  // Validate footprint
  for (let dy = 0; dy < heightTiles; dy++) {
    for (let dx = 0; dx < widthTiles; dx++) {
      const checkX = tileX + dx;
      const checkY = tileY + dy;

      // Check bounds
      if (checkX < 0 || checkX >= grid.width || checkY < 0 || checkY >= grid.height) {
        console.warn(`Furniture placement rejected: out of bounds at (${checkX}, ${checkY})`);
        return false;
      }

      // Check walkability
      const tile = grid.tiles[checkY][checkX];
      if (tile === null) {
        console.warn(`Furniture placement rejected: void tile at (${checkX}, ${checkY})`);
        return false;
      }
    }
  }

  // Get tile height
  const baseTile = grid.tiles[tileY][tileX];
  const tileZ = baseTile ? baseTile.height : 0;

  // Create furniture spec
  if (widthTiles === 1 && heightTiles === 1) {
    // Single-tile furniture
    furnitureList.push({
      name: furnitureType,
      tileX,
      tileY,
      tileZ,
      direction: direction as 0 | 2 | 4 | 6,
    });
  } else {
    // Multi-tile furniture
    multiTileFurnitureList.push({
      name: furnitureType,
      tileX,
      tileY,
      tileZ,
      direction: direction as 0 | 2 | 4 | 6,
      widthTiles,
      heightTiles,
    });
  }

  return true;
}

/**
 * Rotate furniture direction through Habbo's 4 directions.
 * Habbo directions: 0=NE, 2=SE, 4=SW, 6=NW
 *
 * @param currentDirection - Current direction (0, 2, 4, 6)
 * @returns Next direction in rotation sequence
 */
export function rotateFurniture(currentDirection: number): number {
  const directions = [0, 2, 4, 6];
  const currentIndex = directions.indexOf(currentDirection);
  const nextIndex = (currentIndex + 1) % directions.length;
  return directions[nextIndex];
}

/**
 * Layout data structure for save/load
 */
export interface LayoutData {
  heightmap: string;
  doorX: number;
  doorY: number;
  doorZ: number;
  doorDir: number;
  tileColors: Record<string, HsbColor>;
  furniture: FurnitureSpec[];
  multiTileFurniture: MultiTileFurnitureSpec[];
}

/**
 * Save layout to JSON string.
 *
 * @param grid - TileGrid to serialize
 * @param tileColorMap - Tile color overrides
 * @param furniture - Single-tile furniture list
 * @param multiTileFurniture - Multi-tile furniture list
 * @param doorCoords - Door position and direction
 * @returns JSON string
 */
export function saveLayout(
  grid: TileGrid,
  tileColorMap: Map<string, HsbColor>,
  furniture: FurnitureSpec[],
  multiTileFurniture: MultiTileFurnitureSpec[],
  doorCoords: { x: number; y: number; z: number; dir: number },
): string {
  const data: LayoutData = {
    heightmap: gridToHeightmap(grid),
    doorX: doorCoords.x,
    doorY: doorCoords.y,
    doorZ: doorCoords.z,
    doorDir: doorCoords.dir,
    tileColors: Object.fromEntries(tileColorMap),
    furniture,
    multiTileFurniture,
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Load layout from JSON string.
 *
 * @param jsonString - JSON layout data
 * @returns Parsed layout data
 */
export function loadLayout(jsonString: string): LayoutData {
  return JSON.parse(jsonString);
}
