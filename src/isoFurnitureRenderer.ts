// src/isoFurnitureRenderer.ts
// Furniture sprite rendering for isometric rooms
// Implements single-tile and multi-tile furniture with depth sorting

import { tileToScreen, TILE_H_HALF } from './isometricMath.js';
import type { SpriteCache, NitroSpriteFrame } from './isoSpriteCache.js';
import type { Renderable } from './isoTypes.js';

/**
 * Specification for single-tile furniture (chair, lamp, etc.)
 */
export interface FurnitureSpec {
  /** Furniture type name (e.g., "chair", "desk") */
  name: string;
  /** Tile X coordinate */
  tileX: number;
  /** Tile Y coordinate */
  tileY: number;
  /** Tile Z coordinate (height level 0-9) */
  tileZ: number;
  /** Habbo direction (0, 2, 4, 6) */
  direction: 0 | 2 | 4 | 6;
}

/**
 * Specification for multi-tile furniture (desks, bookshelves, etc.)
 */
export interface MultiTileFurnitureSpec {
  /** Furniture type name (e.g., "desk", "bookshelf") */
  name: string;
  /** Origin tile X coordinate (bottom-left of footprint) */
  tileX: number;
  /** Origin tile Y coordinate (bottom-left of footprint) */
  tileY: number;
  /** Tile Z coordinate (height level 0-9) */
  tileZ: number;
  /** Footprint width in tiles (e.g., 2 for 2×1 desk) */
  widthTiles: number;
  /** Footprint height in tiles (e.g., 1 for 2×1 desk) */
  heightTiles: number;
  /** Habbo direction (0, 2, 4, 6) */
  direction: 0 | 2 | 4 | 6;
}

/**
 * Get base direction for sprite lookup.
 * Habbo sprites only store directions 0 and 2.
 * Directions 4 and 6 are horizontal mirrors.
 *
 * @param direction - Habbo direction (0, 2, 4, 6)
 * @returns Base direction (0 or 2)
 */
export function getBaseDirection(direction: 0 | 2 | 4 | 6): 0 | 2 {
  // Direction 4 (back-facing) mirrors direction 2 (right-facing)
  // Direction 6 (left-facing) mirrors direction 0 (front-facing)
  return direction === 4 ? 2 : direction === 6 ? 0 : direction;
}

/**
 * Check if sprite should be horizontally mirrored.
 * Directions 4 and 6 are mirrors of 2 and 0.
 *
 * @param direction - Habbo direction (0, 2, 4, 6)
 * @returns true if sprite should be flipped
 */
export function shouldMirrorSprite(direction: 0 | 2 | 4 | 6): boolean {
  return direction === 4 || direction === 6;
}

/**
 * Create a renderable object for single-tile furniture.
 *
 * This implements the furniture rendering pipeline:
 * 1. Look up sprite frame from cache using frame key format
 * 2. Convert tile coordinates to screen coordinates
 * 3. Apply coordinate rounding (Math.floor) for pixel-perfect rendering
 * 4. Draw sprite with horizontal flip for directions 4 and 6
 *
 * @param spec - Furniture specification
 * @param spriteCache - Sprite cache instance
 * @param atlasName - Atlas name in sprite cache
 * @returns Renderable object with draw function
 */
export function createFurnitureRenderable(
  spec: FurnitureSpec,
  spriteCache: SpriteCache,
  atlasName: string,
): Renderable {
  return {
    tileX: spec.tileX,
    tileY: spec.tileY,
    tileZ: spec.tileZ,
    draw: (ctx) => {
      // Frame key format: {name}_{size}_{layer}_{direction}_{frame}
      const baseDirection = getBaseDirection(spec.direction);
      const frameKey = `${spec.name}_64_a_${baseDirection}_0`;

      // Look up sprite frame from cache
      const frame = spriteCache.getFrame(atlasName, frameKey);
      if (!frame) {
        console.warn(`❌ Missing furniture sprite: ${frameKey} in atlas ${atlasName}`);
        return; // Graceful fallback - don't crash render loop
      }

      // Debug log (only once per furniture type)
      if (!window._debuggedFurniture) window._debuggedFurniture = new Set();
      if (!window._debuggedFurniture.has(spec.name)) {
        console.log(`✓ Rendering ${spec.name} at (${spec.tileX},${spec.tileY},${spec.tileZ}) with frame ${frameKey}`);
        window._debuggedFurniture.add(spec.name);
      }

      // Convert tile position to screen coordinates
      const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);

      // Center sprite horizontally, align bottom to tile position
      // CRITICAL: Round coordinates with Math.floor() to avoid sub-pixel rendering cost
      const dx = Math.floor(screen.x - frame.w / 2);
      const dy = Math.floor(screen.y - frame.h);

      // Apply horizontal mirror for directions 4 and 6
      if (shouldMirrorSprite(spec.direction)) {
        ctx.save();
        ctx.scale(-1, 1); // Horizontal flip
        ctx.drawImage(
          frame.bitmap,
          frame.x, frame.y,  // Source atlas position
          frame.w, frame.h,  // Source size
          -dx - frame.w, dy, // Destination position (flipped X coordinate)
          frame.w, frame.h   // Destination size (no scaling)
        );
        ctx.restore();
      } else {
        ctx.drawImage(
          frame.bitmap,
          frame.x, frame.y,  // Source atlas position
          frame.w, frame.h,  // Source size
          dx, dy,            // Destination position
          frame.w, frame.h   // Destination size (no scaling)
        );
      }
    },
  };
}

/**
 * Create a renderable object for multi-tile furniture.
 *
 * This implements the max-coordinate sort key pattern to fix depth sorting bugs
 * where avatars standing behind furniture edges incorrectly appear in front.
 *
 * Key differences from single-tile:
 * 1. Sort key uses max(tileX + widthTiles - 1, tileY + heightTiles - 1)
 * 2. Rendering position uses origin tile (spec.tileX, spec.tileY), NOT sort tile
 * 3. Ensures furniture's farthest edge determines depth ordering
 *
 * Example: 2×1 desk at origin (3,3) uses sort key (4,3) but renders at (3,3)
 *
 * @param spec - Multi-tile furniture specification
 * @param spriteCache - Sprite cache instance
 * @param atlasName - Atlas name in sprite cache
 * @returns Renderable object with draw function
 */
export function createMultiTileFurnitureRenderable(
  spec: MultiTileFurnitureSpec,
  spriteCache: SpriteCache,
  atlasName: string,
): Renderable {
  // Calculate max coordinate across full footprint for depth sorting
  // This ensures the furniture's farthest edge determines rendering order
  const sortTileX = spec.tileX + spec.widthTiles - 1;
  const sortTileY = spec.tileY + spec.heightTiles - 1;

  return {
    // Use max coordinate for depth sort key
    tileX: sortTileX,
    tileY: sortTileY,
    tileZ: spec.tileZ,
    draw: (ctx) => {
      // Frame key format: {name}_{size}_{layer}_{direction}_{frame}
      const baseDirection = getBaseDirection(spec.direction);
      const frameKey = `${spec.name}_64_a_${baseDirection}_0`;

      // Look up sprite frame from cache
      const frame = spriteCache.getFrame(atlasName, frameKey);
      if (!frame) {
        console.warn(`❌ Missing multi-tile furniture sprite: ${frameKey} in atlas ${atlasName}`);
        return; // Graceful fallback
      }

      // Debug log (only once per furniture type)
      if (!window._debuggedFurniture) window._debuggedFurniture = new Set();
      if (!window._debuggedFurniture.has(spec.name)) {
        console.log(`✓ Rendering ${spec.name} [${spec.widthTiles}×${spec.heightTiles}] at (${spec.tileX},${spec.tileY},${spec.tileZ}) with frame ${frameKey}`);
        window._debuggedFurniture.add(spec.name);
      }

      // CRITICAL: Render at ORIGIN tile position, not sort tile position
      // This ensures the sprite appears at the correct screen location
      const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);

      // Center sprite horizontally, align bottom to tile position
      // CRITICAL: Round coordinates with Math.floor() to avoid sub-pixel rendering cost
      const dx = Math.floor(screen.x - frame.w / 2);
      const dy = Math.floor(screen.y - frame.h);

      // Apply horizontal mirror for directions 4 and 6
      if (shouldMirrorSprite(spec.direction)) {
        ctx.save();
        ctx.scale(-1, 1); // Horizontal flip
        ctx.drawImage(
          frame.bitmap,
          frame.x, frame.y,
          frame.w, frame.h,
          -dx - frame.w, dy,
          frame.w, frame.h
        );
        ctx.restore();
      } else {
        ctx.drawImage(
          frame.bitmap,
          frame.x, frame.y,
          frame.w, frame.h,
          dx, dy,
          frame.w, frame.h
        );
      }
    },
  };
}

// ---- Nitro rendering functions ----

/**
 * Draw a single Nitro sprite frame with offset and optional flip.
 */
function drawNitroFrame(
  ctx: CanvasRenderingContext2D,
  frame: NitroSpriteFrame,
  screenX: number,
  screenY: number,
  needsFlip: boolean,
): void {
  // Nitro offsets are relative to the tile floor center (diamond center),
  // but tileToScreen returns the top vertex. Shift down by TILE_H_HALF.
  const dx = Math.floor(screenX + frame.offsetX);
  const dy = Math.floor(screenY + TILE_H_HALF + frame.offsetY);

  const flip = needsFlip !== frame.flipH; // XOR: direction flip combined with asset flipH

  if (flip) {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(
      frame.bitmap,
      frame.x, frame.y,
      frame.w, frame.h,
      -dx - frame.w, dy,
      frame.w, frame.h
    );
    ctx.restore();
  } else {
    ctx.drawImage(
      frame.bitmap,
      frame.x, frame.y,
      frame.w, frame.h,
      dx, dy,
      frame.w, frame.h
    );
  }
}

/**
 * Resolve a Nitro frame, following source references.
 * Cortex-assets uses "source" to share sprites between directions.
 */
function resolveNitroFrame(
  spriteCache: SpriteCache,
  assetName: string,
  frameName: string,
): NitroSpriteFrame | null {
  const metadata = spriteCache.getNitroMetadata(assetName);
  if (!metadata) return null;

  // Direct frame lookup
  let frame = spriteCache.getNitroFrame(assetName, frameName);
  if (frame) return frame;

  // Follow source reference
  const assetEntry = metadata.assets[frameName];
  if (assetEntry?.source) {
    frame = spriteCache.getNitroFrame(assetName, assetEntry.source);
    if (frame) {
      // Apply the original asset's offsets and flipH, not the source's
      return {
        ...frame,
        offsetX: assetEntry.x,
        offsetY: assetEntry.y,
        flipH: assetEntry.flipH ?? false,
      };
    }
  }

  return null;
}

/**
 * Create a renderable for furniture using Nitro per-item spritesheets.
 *
 * Key differences from placeholder renderer:
 * - Uses per-item atlas (one PNG per furniture) instead of shared atlas
 * - Renders all layers (a, b, c, ...) based on Nitro visualization.layerCount
 * - Applies Nitro asset offsets instead of center-bottom calculation
 * - Follows source references for direction mirroring
 * - Returns null if Nitro asset not loaded (caller should use placeholder)
 */
export function createNitroFurnitureRenderable(
  spec: FurnitureSpec,
  spriteCache: SpriteCache,
  nitroAssetName: string,
): Renderable | null {
  if (!spriteCache.hasNitroAsset(nitroAssetName)) {
    return null;
  }

  const metadata = spriteCache.getNitroMetadata(nitroAssetName);
  if (!metadata) return null;

  return {
    tileX: spec.tileX,
    tileY: spec.tileY,
    tileZ: spec.tileZ,
    draw: (ctx) => {
      const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);
      const needsFlip = shouldMirrorSprite(spec.direction);
      const baseDir = getBaseDirection(spec.direction);

      const layerCount = metadata.visualization.layerCount || 1;
      let drawnLayers = 0;
      for (let i = 0; i < layerCount; i++) {
        const layerLetter = String.fromCharCode(97 + i); // 'a', 'b', 'c', ...
        const frameName = `${nitroAssetName}_64_${layerLetter}_${baseDir}_0`;

        const frame = resolveNitroFrame(spriteCache, nitroAssetName, frameName);
        if (!frame) continue;

        drawNitroFrame(ctx, frame, screen.x, screen.y, needsFlip);
        drawnLayers++;
      }

      if (!window._debuggedFurniture) window._debuggedFurniture = new Set();
      if (!window._debuggedFurniture.has(`nitro:${nitroAssetName}`)) {
        if (drawnLayers === 0) {
          console.warn(`⚠ Nitro furniture ${nitroAssetName}: 0/${layerCount} layers resolved for dir ${baseDir} at (${spec.tileX},${spec.tileY})`);
        } else {
          console.log(`✓ Nitro furniture: ${nitroAssetName} (${drawnLayers}/${layerCount} layers, dir ${baseDir}) at (${spec.tileX},${spec.tileY})`);
        }
        window._debuggedFurniture.add(`nitro:${nitroAssetName}`);
      }
    },
  };
}

/**
 * Create a renderable for multi-tile furniture using Nitro per-item spritesheets.
 * Same as createNitroFurnitureRenderable but with max-coordinate depth sorting.
 */
export function createNitroMultiTileFurnitureRenderable(
  spec: MultiTileFurnitureSpec,
  spriteCache: SpriteCache,
  nitroAssetName: string,
): Renderable | null {
  if (!spriteCache.hasNitroAsset(nitroAssetName)) {
    return null;
  }

  const metadata = spriteCache.getNitroMetadata(nitroAssetName);
  if (!metadata) return null;

  const sortTileX = spec.tileX + spec.widthTiles - 1;
  const sortTileY = spec.tileY + spec.heightTiles - 1;

  return {
    tileX: sortTileX,
    tileY: sortTileY,
    tileZ: spec.tileZ,
    draw: (ctx) => {
      const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);
      const needsFlip = shouldMirrorSprite(spec.direction);
      const baseDir = getBaseDirection(spec.direction);

      const layerCount = metadata.visualization.layerCount || 1;
      let drawnLayers = 0;
      for (let i = 0; i < layerCount; i++) {
        const layerLetter = String.fromCharCode(97 + i);
        const frameName = `${nitroAssetName}_64_${layerLetter}_${baseDir}_0`;

        const frame = resolveNitroFrame(spriteCache, nitroAssetName, frameName);
        if (!frame) continue;

        drawNitroFrame(ctx, frame, screen.x, screen.y, needsFlip);
        drawnLayers++;
      }

      if (!window._debuggedFurniture) window._debuggedFurniture = new Set();
      if (!window._debuggedFurniture.has(`nitro:${nitroAssetName}`)) {
        if (drawnLayers === 0) {
          console.warn(`⚠ Nitro furniture ${nitroAssetName}: 0/${layerCount} layers resolved for dir ${baseDir} at (${spec.tileX},${spec.tileY})`);
        } else {
          console.log(`✓ Nitro furniture: ${nitroAssetName} [${spec.widthTiles}×${spec.heightTiles}] (${drawnLayers}/${layerCount} layers, dir ${baseDir}) at (${spec.tileX},${spec.tileY})`);
        }
        window._debuggedFurniture.add(`nitro:${nitroAssetName}`);
      }
    },
  };
}
