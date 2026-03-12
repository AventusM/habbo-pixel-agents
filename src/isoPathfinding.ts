// src/isoPathfinding.ts
// Grid-based BFS pathfinding for isometric rooms
// Pure functions, no DOM dependencies

import type { TileGrid } from './isoTypes.js';
import type { TilePathStep, TilePath } from './isoAgentBehavior.js';
import type { AvatarSpec } from './avatarRendererTypes.js';
import type { FurnitureSpec, MultiTileFurnitureSpec } from './isoFurnitureRenderer.js';
import { isWalkableFurniture } from './furnitureRegistry.js';

/** 8-connected neighbor offsets (cardinals + diagonals) */
const NEIGHBORS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], // cardinals
  [1, 1], [-1, -1], [1, -1], [-1, 1], // diagonals
];

/**
 * Build a set of tile keys blocked by furniture.
 * Multi-tile furniture blocks all tiles in its footprint.
 */
export function computeBlockedTiles(
  furniture: FurnitureSpec[],
  multiTileFurniture: MultiTileFurnitureSpec[],
  overrideWalkable?: Set<string>,
): Set<string> {
  const blocked = new Set<string>();
  for (const f of furniture) {
    if (!isWalkableFurniture(f.name)) {
      const key = `${f.tileX},${f.tileY}`;
      if (!overrideWalkable?.has(key)) {
        blocked.add(key);
      }
    }
  }
  for (const f of multiTileFurniture) {
    if (!isWalkableFurniture(f.name)) {
      for (let dy = 0; dy < f.heightTiles; dy++) {
        for (let dx = 0; dx < f.widthTiles; dx++) {
          const key = `${f.tileX + dx},${f.tileY + dy}`;
          if (!overrideWalkable?.has(key)) {
            blocked.add(key);
          }
        }
      }
    }
  }
  return blocked;
}

/**
 * Check if a tile coordinate is walkable in the grid.
 */
function isWalkable(grid: TileGrid, x: number, y: number, blockedTiles?: Set<string>): boolean {
  if (y < 0 || y >= grid.height || x < 0 || x >= grid.width) return false;
  if (grid.tiles[y][x] === null) return false;
  if (blockedTiles && blockedTiles.has(`${x},${y}`)) return false;
  return true;
}

/**
 * Find shortest path between two tiles using 8-connected BFS.
 *
 * Diagonal movement is only allowed if both adjacent cardinal tiles are walkable
 * (no corner-cutting through walls).
 *
 * @param grid - Tile grid with walkability info
 * @param startX - Start tile X
 * @param startY - Start tile Y
 * @param endX - End tile X
 * @param endY - End tile Y
 * @returns Array of tile steps from start to end, or null if unreachable
 */
export function findPath(
  grid: TileGrid,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  blockedTiles?: Set<string>,
): TilePath | null {
  // Start or end not walkable (start is exempt from blocking so avatar can leave furniture tile)
  if (!isWalkable(grid, startX, startY) || !isWalkable(grid, endX, endY, blockedTiles)) {
    return null;
  }

  // Already there
  if (startX === endX && startY === endY) {
    const tile = grid.tiles[startY][startX]!;
    return [{ tileX: startX, tileY: startY, tileZ: tile.height }];
  }

  // BFS
  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue: [number, number][] = [[startX, startY]];
  const key = (x: number, y: number) => `${x},${y}`;

  visited.add(key(startX, startY));

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;

    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      const nk = key(nx, ny);

      if (visited.has(nk)) continue;
      if (!isWalkable(grid, nx, ny, blockedTiles)) continue;

      // Diagonal corner-cutting prevention:
      // Only allow diagonal if both adjacent cardinals are walkable
      if (dx !== 0 && dy !== 0) {
        if (!isWalkable(grid, cx + dx, cy, blockedTiles) || !isWalkable(grid, cx, cy + dy, blockedTiles)) {
          continue;
        }
      }

      visited.add(nk);
      parent.set(nk, key(cx, cy));

      if (nx === endX && ny === endY) {
        // Reconstruct path
        const path: TilePath = [];
        let cur = key(endX, endY);
        while (cur) {
          const [px, py] = cur.split(',').map(Number);
          const tile = grid.tiles[py][px]!;
          path.unshift({ tileX: px, tileY: py, tileZ: tile.height });
          cur = parent.get(cur)!;
        }
        return path;
      }

      queue.push([nx, ny]);
    }
  }

  return null; // Unreachable
}

/**
 * Get a random walkable tile from the grid.
 *
 * @param grid - Tile grid
 * @returns Random walkable tile step, or null if no walkable tiles
 */
export function getRandomWalkableTile(grid: TileGrid, blockedTiles?: Set<string>): TilePathStep | null {
  const walkable: TilePathStep[] = [];

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const tile = grid.tiles[y][x];
      if (tile !== null && (!blockedTiles || !blockedTiles.has(`${x},${y}`))) {
        walkable.push({ tileX: x, tileY: y, tileZ: tile.height });
      }
    }
  }

  if (walkable.length === 0) return null;
  return walkable[Math.floor(Math.random() * walkable.length)];
}

/**
 * Check if a tile is occupied by any avatar.
 *
 * @param tileX - Tile X to check
 * @param tileY - Tile Y to check
 * @param avatars - Array of avatar specs to check against
 * @returns true if any avatar occupies this tile
 */
export function isTileOccupied(
  tileX: number,
  tileY: number,
  avatars: AvatarSpec[],
): boolean {
  return avatars.some(a => a.tileX === tileX && a.tileY === tileY);
}
