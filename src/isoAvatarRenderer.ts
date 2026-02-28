// src/isoAvatarRenderer.ts
// Avatar sprite rendering for isometric rooms
// Implements 8-direction support with multi-layer composition (body, clothing, head, hair)

import { tileToScreen } from './isometricMath.js';
import type { SpriteCache } from './isoSpriteCache.js';
import type { Renderable } from './isoTypes.js';

/**
 * Avatar specification with 8-direction support and palette variants
 */
export interface AvatarSpec {
  /** Unique avatar ID */
  id: string;
  /** Tile X coordinate */
  tileX: number;
  /** Tile Y coordinate */
  tileY: number;
  /** Tile Z coordinate (height level 0-9) */
  tileZ: number;
  /** Habbo direction (0-7 clockwise from NE) */
  direction: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Palette variant (0-5 for 6 distinct characters) */
  variant: 0 | 1 | 2 | 3 | 4 | 5;
  /** Animation state ('idle' | 'walk') */
  state: 'idle' | 'walk';
  /** Animation frame (0-3 for walk cycle, 0 for idle) */
  frame: number;
}

/**
 * Layer rendering order for avatar composition.
 * Layers render back to front (body → clothing → head → hair)
 */
const AVATAR_LAYERS = ['body', 'clothing', 'head', 'hair'] as const;

/**
 * Create a renderable object for an avatar with multi-layer composition.
 *
 * This implements the avatar rendering pipeline:
 * 1. Look up sprite frames for each layer from cache using frame key format
 * 2. Convert tile coordinates to screen coordinates
 * 3. Apply coordinate rounding (Math.floor) for pixel-perfect rendering
 * 4. Draw each layer in order (body, clothing, head, hair)
 *
 * Unlike furniture, avatars use all 8 directions (no mirroring) because
 * characters are asymmetric (different arm/leg positions when walking diagonally).
 *
 * Frame key format: avatar_{variant}_{layer}_{direction}_{state}_{frame}
 * Example: avatar_0_body_2_idle_0, avatar_3_hair_5_walk_2
 *
 * @param spec - Avatar specification
 * @param spriteCache - Sprite cache instance
 * @param atlasName - Atlas name in sprite cache
 * @returns Renderable object with draw function
 */
export function createAvatarRenderable(
  spec: AvatarSpec,
  spriteCache: SpriteCache,
  atlasName: string,
): Renderable {
  return {
    tileX: spec.tileX,
    tileY: spec.tileY,
    tileZ: spec.tileZ,
    draw: (ctx) => {
      // Debug log (only once per avatar ID)
      if (!window._debuggedAvatars) window._debuggedAvatars = new Set();
      if (!window._debuggedAvatars.has(spec.id)) {
        console.log(`✓ Rendering avatar ${spec.id} (variant ${spec.variant}, direction ${spec.direction}) at (${spec.tileX},${spec.tileY},${spec.tileZ})`);
        window._debuggedAvatars.add(spec.id);
      }

      // Convert tile position to screen coordinates
      const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);

      // Render each layer in order (back to front)
      for (const layer of AVATAR_LAYERS) {
        // Frame key format: avatar_{variant}_{layer}_{direction}_{state}_{frame}
        const frameKey = `avatar_${spec.variant}_${layer}_${spec.direction}_${spec.state}_${spec.frame}`;

        // Look up sprite frame from cache
        const frame = spriteCache.getFrame(atlasName, frameKey);
        if (!frame) {
          // Graceful degradation - skip missing layers (don't crash render loop)
          // This is expected during development when placeholders aren't complete
          continue;
        }

        // Center sprite horizontally, align bottom to tile position
        // CRITICAL: Round coordinates with Math.floor() to avoid sub-pixel rendering cost
        const dx = Math.floor(screen.x - frame.w / 2);
        const dy = Math.floor(screen.y - frame.h);

        // Draw sprite (no mirroring - all 8 directions are unique sprites)
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
