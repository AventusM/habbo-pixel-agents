// src/isoFurnitureRenderer.ts
// Furniture sprite rendering for isometric rooms
// Implements single-tile and multi-tile furniture with depth sorting

import { tileToScreen, TILE_W_HALF, TILE_H_HALF } from './isometricMath.js';
import type { SpriteCache, NitroSpriteFrame, NitroAssetData } from './isoSpriteCache.js';
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
        const flipped = getFlippedSprite(frame.bitmap, frame.x, frame.y, frame.w, frame.h);
        if (flipped) {
          // For center-aligned sprites, flipped position is the same
          ctx.drawImage(
            flipped,
            0, 0,
            frame.w, frame.h,
            dx, dy,
            frame.w, frame.h
          );
        } else {
          // Fallback for test environments
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
        }
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
 * Uses origin tile + footprint metadata for depth sorting. The depthSort
 * comparator uses the footprint to do range-based comparison: any point
 * renderable at or past the back edge draws on top. This eliminates the
 * ambiguity of a single sort position for large furniture.
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
        const flipped = getFlippedSprite(frame.bitmap, frame.x, frame.y, frame.w, frame.h);
        if (flipped) {
          ctx.drawImage(
            flipped,
            0, 0,
            frame.w, frame.h,
            dx, dy,
            frame.w, frame.h
          );
        } else {
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
        }
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
 * Cache for pre-flipped sprite canvases.
 * Two-level map: ImageBitmap → frame-coords-key → flipped OffscreenCanvas.
 * Using the bitmap as outer key ensures different items with identical frame
 * coordinates (e.g. coins) get separate cached flips.
 */
const flipCache = new WeakMap<ImageBitmap, Map<string, OffscreenCanvas>>();

/**
 * Get or create a horizontally flipped version of a sprite frame.
 * Uses pixel-level manipulation for reliable cross-environment flipping.
 * Returns null if OffscreenCanvas is not available (test environments).
 */
function getFlippedSprite(
  bitmap: ImageBitmap,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): OffscreenCanvas | null {
  let bitmapCache = flipCache.get(bitmap);
  if (!bitmapCache) {
    bitmapCache = new Map();
    flipCache.set(bitmap, bitmapCache);
  }
  const key = `${sx}:${sy}:${sw}:${sh}`;
  const cached = bitmapCache.get(key);
  if (cached) return cached;

  try {
    const canvas = new OffscreenCanvas(sw, sh);
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.drawImage !== 'function') return null;

    // Draw source frame
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

    // Flip pixels horizontally via ImageData swap
    const imageData = ctx.getImageData(0, 0, sw, sh);
    const { data, width, height } = imageData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < Math.floor(width / 2); x++) {
        const i1 = (y * width + x) * 4;
        const i2 = (y * width + (width - 1 - x)) * 4;
        for (let c = 0; c < 4; c++) {
          const tmp = data[i1 + c];
          data[i1 + c] = data[i2 + c];
          data[i2 + c] = tmp;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);

    bitmapCache.set(key, canvas);
    return canvas;
  } catch {
    return null; // OffscreenCanvas not available
  }
}

/**
 * Get the per-direction layer z-ordering from visualization metadata.
 * Returns a map of layer index → z value for the given direction.
 * Layers without explicit z values default to 0.
 */
function getLayerZValues(
  metadata: NitroAssetData,
  direction: number,
): Map<number, number> {
  const zMap = new Map<number, number>();
  const dirData = metadata.visualization.directions?.[String(direction)];
  if (dirData) {
    for (const [layerIdx, layerProps] of Object.entries(dirData)) {
      const z = Number((layerProps as Record<string, string>).z) || 0;
      zMap.set(Number(layerIdx), z);
    }
  }
  return zMap;
}

/**
 * Draw a single Nitro sprite frame with offset and optional flip.
 * Uses pre-computed flipped bitmaps for reliable rendering.
 */
function drawNitroFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frame: NitroSpriteFrame,
  screenX: number,
  screenY: number,
  needsFlip: boolean,
): void {
  // Nitro offsets are relative to the tile floor center (diamond center),
  // but tileToScreen returns the top vertex. Shift down by TILE_H_HALF.
  const dy = Math.floor(screenY + TILE_H_HALF + frame.offsetY);

  const flip = needsFlip !== frame.flipH; // XOR: direction flip combined with asset flipH

  if (flip) {
    // Mirror the x offset around the tile center:
    // Original: left edge at screenX + offsetX
    // Flipped:  left edge at screenX - offsetX - width
    const flipped = getFlippedSprite(frame.bitmap, frame.x, frame.y, frame.w, frame.h);
    if (flipped) {
      const dx = Math.floor(screenX - frame.offsetX - frame.w);
      ctx.drawImage(
        flipped,
        0, 0,
        frame.w, frame.h,
        dx, dy,
        frame.w, frame.h
      );
    } else {
      // Fallback for test environments: use ctx.scale(-1, 1)
      const dx = Math.floor(screenX + frame.offsetX);
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
    }
  } else {
    const dx = Math.floor(screenX + frame.offsetX);
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
      const layerZValues = getLayerZValues(metadata, spec.direction);

      // Resolve all layers and sort by per-direction z value
      const layerCount = metadata.visualization.layerCount || 1;
      const layers: { frame: NitroSpriteFrame; z: number }[] = [];
      for (let i = 0; i < layerCount; i++) {
        const layerLetter = String.fromCharCode(97 + i); // 'a', 'b', 'c', ...
        const frameName = `${nitroAssetName}_64_${layerLetter}_${baseDir}_0`;
        const frame = resolveNitroFrame(spriteCache, nitroAssetName, frameName);
        if (!frame) continue;
        layers.push({ frame, z: layerZValues.get(i) ?? 0 });
      }

      // Sort by z: lower z = drawn first (behind)
      layers.sort((a, b) => a.z - b.z);

      for (const layer of layers) {
        drawNitroFrame(ctx, layer.frame, screen.x, screen.y, needsFlip);
      }
    },
  };
}

/**
 * Create a renderable for multi-tile furniture using Nitro per-item spritesheets.
 * Same as createNitroFurnitureRenderable but for multi-tile specs.
 * Depth sorting is handled by sliceMultiTileRenderable at the call site.
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

  return {
    tileX: spec.tileX,
    tileY: spec.tileY,
    tileZ: spec.tileZ,
    draw: (ctx) => {
      const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);
      const needsFlip = shouldMirrorSprite(spec.direction);
      const baseDir = getBaseDirection(spec.direction);
      const layerZValues = getLayerZValues(metadata, spec.direction);

      // Resolve all layers and sort by per-direction z value
      const layerCount = metadata.visualization.layerCount || 1;
      const layers: { frame: NitroSpriteFrame; z: number }[] = [];
      for (let i = 0; i < layerCount; i++) {
        const layerLetter = String.fromCharCode(97 + i);
        const frameName = `${nitroAssetName}_64_${layerLetter}_${baseDir}_0`;
        const frame = resolveNitroFrame(spriteCache, nitroAssetName, frameName);
        if (!frame) continue;
        layers.push({ frame, z: layerZValues.get(i) ?? 0 });
      }

      // Sort by z: lower z = drawn first (behind)
      layers.sort((a, b) => a.z - b.z);

      for (const layer of layers) {
        drawNitroFrame(ctx, layer.frame, screen.x, screen.y, needsFlip);
      }
    },
  };
}

/**
 * Create renderables for a single-tile chair by splitting layers into seat
 * and backrest groups based on per-direction z-values.
 *
 * Chairs have two meaningful layer groups:
 *   - Seat layers (z <= 0): rendered at base depth (behind the avatar)
 *   - Backrest layers (z > 0): rendered at depth + 0.8 (in front of the avatar)
 *
 * The avatar uses a +0.6 depth bias, so a backrest at +0.8 correctly renders
 * on top of the sitting avatar's torso. When there are no backrest layers
 * (e.g. direction 2 where backrest z=-100), falls back to a single renderable
 * via createNitroFurnitureRenderable.
 *
 * Returns [] if the asset is not loaded.
 */
export function createNitroChairRenderables(
  spec: FurnitureSpec,
  spriteCache: SpriteCache,
  nitroAssetName: string,
): Renderable[] {
  if (!spriteCache.hasNitroAsset(nitroAssetName)) {
    return [];
  }

  const metadata = spriteCache.getNitroMetadata(nitroAssetName);
  if (!metadata) return [];

  const needsFlip = shouldMirrorSprite(spec.direction);
  const baseDir = getBaseDirection(spec.direction);
  // CRITICAL: pass spec.direction (not baseDir) to get correct z-values for this direction
  const layerZValues = getLayerZValues(metadata, spec.direction);

  const layerCount = metadata.visualization.layerCount || 1;

  type LayerEntry = { frame: NitroSpriteFrame; z: number };
  const seatLayers: LayerEntry[] = [];
  const backrestLayers: LayerEntry[] = [];

  for (let i = 0; i < layerCount; i++) {
    const layerLetter = String.fromCharCode(97 + i); // 'a', 'b', 'c', ...
    const frameName = `${nitroAssetName}_64_${layerLetter}_${baseDir}_0`;
    const frame = resolveNitroFrame(spriteCache, nitroAssetName, frameName);
    if (!frame) continue;
    const z = layerZValues.get(i) ?? 0;
    if (z > 0) {
      backrestLayers.push({ frame, z });
    } else {
      seatLayers.push({ frame, z });
    }
  }

  // Fallback: no backrest layers → delegate to standard single renderable
  if (backrestLayers.length === 0) {
    const r = createNitroFurnitureRenderable(spec, spriteCache, nitroAssetName);
    return r ? [r] : [];
  }

  const results: Renderable[] = [];

  // Seat renderable: draw seat layers at base depth
  if (seatLayers.length > 0) {
    const seatLayersCopy = [...seatLayers].sort((a, b) => a.z - b.z);
    results.push({
      tileX: spec.tileX,
      tileY: spec.tileY,
      tileZ: spec.tileZ,
      draw: (ctx) => {
        const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);
        for (const layer of seatLayersCopy) {
          drawNitroFrame(ctx, layer.frame, screen.x, screen.y, needsFlip);
        }
      },
    });
  }

  // Backrest renderable: draw backrest layers at depth + 0.8 (past avatar's +0.6 bias)
  const backrestLayersCopy = [...backrestLayers].sort((a, b) => a.z - b.z);
  results.push({
    tileX: spec.tileX + 0.8,
    tileY: spec.tileY,
    tileZ: spec.tileZ,
    draw: (ctx) => {
      const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);
      for (const layer of backrestLayersCopy) {
        drawNitroFrame(ctx, layer.frame, screen.x, screen.y, needsFlip);
      }
    },
  });

  return results;
}

/**
 * Split a multi-tile furniture renderable into per-depth-row renderables.
 * Each depth row gets two clip-based renderables:
 *   1. A ground strip (full-width horizontal band at ground level)
 *   2. A column cap (horizontally-clipped upper portion above ground level)
 *
 * Additionally, a full-sprite "base" renderable is emitted at the back-most
 * depth. This base draws the complete unclipped sprite, ensuring that layers
 * extending beyond the tile footprint (e.g. hc_djset instruments) are still
 * visible. The column-capped slices draw ON TOP to provide depth-correct
 * occlusion with avatars; the base only shows through where no cap covers.
 *
 * For 1×1 items, returns the original renderable unchanged (no slicing needed).
 *
 * @param spec - Multi-tile furniture specification with footprint dimensions
 * @param renderable - The full-sprite renderable to slice
 * @returns Array of slice renderables, each with its own depth position
 */
export function sliceMultiTileRenderable(
  spec: MultiTileFurnitureSpec,
  renderable: Renderable,
): Renderable[] {
  if (spec.widthTiles <= 1 && spec.heightTiles <= 1) {
    return [renderable];
  }

  const ox = spec.tileX;
  const oy = spec.tileY;
  const w = spec.widthTiles;
  const h = spec.heightTiles;
  const z = spec.tileZ;

  const dBack = ox + oy;
  const dFront = dBack + w + h - 2;
  const numSlices = dFront - dBack + 1;
  const centerTileX = ox + (w - 1) / 2;
  const slices: Renderable[] = [];

  for (let i = 0; i < numSlices; i++) {
    const d = dBack + i;
    // Each ground-level band clips to its horizontal strip.
    // -1px overlap on clipTop eliminates sub-pixel seam artifacts.
    const clipTop = (d * TILE_H_HALF - z * TILE_H_HALF) - 1;
    const clipBottom = i === numSlices - 1
      ? 100000   // front-most: include everything below
      : ((d + 1) * TILE_H_HALF - z * TILE_H_HALF);

    // Ground strip: full-width horizontal band at ground level
    slices.push({
      tileX: centerTileX,
      tileY: d - centerTileX,
      tileZ: z,
      draw: (ctx) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(-100000, clipTop, 200000, clipBottom - clipTop);
        ctx.clip();
        renderable.draw(ctx);
        ctx.restore();
      },
    });

    // Column cap: upper portion (above ground strip) for this depth row.
    // Horizontally clipped to the screen X range of footprint tiles at depth d.
    // This prevents the furniture's tall upper portion from incorrectly
    // occluding avatars at the corners/sides of the furniture.
    const minTx = Math.max(ox, d - oy - h + 1);
    const maxTx = Math.min(ox + w - 1, d - oy);
    const clipLeft = (2 * minTx - d) * TILE_W_HALF - TILE_W_HALF - 1;
    const clipRight = (2 * maxTx - d) * TILE_W_HALF + TILE_W_HALF + 1;

    slices.push({
      tileX: centerTileX,
      tileY: d - centerTileX,
      tileZ: z,
      draw: (ctx) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(clipLeft, -100000, clipRight - clipLeft, clipTop + 1 + 100000);
        ctx.clip();
        renderable.draw(ctx);
        ctx.restore();
      },
    });
  }

  // Base renderable: full unclipped sprite at the back-most depth.
  // This ensures sprite overflow beyond tile footprint (e.g. instruments on
  // hc_djset) is still visible. The column caps draw on top at their correct
  // depths, so in-footprint pixels get proper avatar occlusion. Only the
  // overflow pixels (outside any column cap) show through from this base,
  // rendered behind nearby entities — which is the correct visual behavior.
  slices.push({
    tileX: ox,
    tileY: oy,
    tileZ: z,
    draw: (ctx) => {
      renderable.draw(ctx);
    },
  });

  return slices;
}
