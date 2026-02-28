// src/isoAvatarRenderer.ts
// Avatar sprite rendering for isometric rooms
// Implements 8-direction support with multi-layer composition (body, clothing, head, hair)

import { tileToScreen } from './isometricMath.js';
import type { SpriteCache } from './isoSpriteCache.js';
import type { Renderable } from './isoTypes.js';

/** Animation timing constants */
export const WALK_FRAME_DURATION_MS = 250; // 250ms per walk frame (4 FPS)
export const BLINK_INTERVAL_MIN_MS = 5000; // Min 5 seconds between blinks
export const BLINK_INTERVAL_MAX_MS = 8000; // Max 8 seconds between blinks
export const BLINK_FRAME_DURATION_MS = 100; // 100ms per blink frame (fast blink)

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
  /** Animation state ('idle' | 'walk' | 'spawning' | 'despawning') */
  state: 'idle' | 'walk' | 'spawning' | 'despawning';
  /** Animation frame (0-3 for walk, 0 for idle, 0-2 for blink overlay, 0-N for spawn effect) */
  frame: number;
  /** Timestamp of last state/frame change (for animation timing) */
  lastUpdateMs: number;
  /** Next blink timestamp (only for idle state) */
  nextBlinkMs: number;
  /** Current blink frame (0 = no blink, 1-3 = blink overlay frames) */
  blinkFrame: number;
  /** Spawn effect progress (0.0-1.0, only for spawning/despawning states) */
  spawnProgress: number;
}

/**
 * Layer rendering order for avatar composition.
 * Layers render back to front (body → clothing → head → hair)
 */
const AVATAR_LAYERS = ['body', 'clothing', 'head', 'hair'] as const;

/**
 * Update avatar animation state based on elapsed time.
 * Call this each frame BEFORE rendering.
 *
 * @param spec - Avatar specification (mutated in place)
 * @param currentTimeMs - Current timestamp from Date.now() or performance.now()
 */
export function updateAvatarAnimation(spec: AvatarSpec, currentTimeMs: number): void {
  const elapsed = currentTimeMs - spec.lastUpdateMs;

  // Handle walk cycle
  if (spec.state === 'walk') {
    if (elapsed >= WALK_FRAME_DURATION_MS) {
      spec.frame = (spec.frame + 1) % 4; // Cycle through frames 0-3
      spec.lastUpdateMs = currentTimeMs;
    }
  }

  // Handle idle blinks
  if (spec.state === 'idle') {
    // Check if it's time to blink
    if (currentTimeMs >= spec.nextBlinkMs && spec.blinkFrame === 0) {
      spec.blinkFrame = 1; // Start blink
      spec.lastUpdateMs = currentTimeMs;
    }
    // Advance blink frames (1 -> 2 -> 3 -> 0)
    else if (spec.blinkFrame > 0 && elapsed >= BLINK_FRAME_DURATION_MS) {
      spec.blinkFrame = (spec.blinkFrame + 1) % 4; // 1->2->3->0
      spec.lastUpdateMs = currentTimeMs;

      // If blink complete, schedule next blink
      if (spec.blinkFrame === 0) {
        const interval = BLINK_INTERVAL_MIN_MS +
          Math.random() * (BLINK_INTERVAL_MAX_MS - BLINK_INTERVAL_MIN_MS);
        spec.nextBlinkMs = currentTimeMs + interval;
      }
    }
  }

  // Handle spawn/despawn effects (simplified linear progress for now)
  if (spec.state === 'spawning' || spec.state === 'despawning') {
    // Increment progress over 1 second (arbitrary duration)
    const SPAWN_DURATION_MS = 1000;
    const progress = elapsed / SPAWN_DURATION_MS;
    spec.spawnProgress = Math.min(1.0, spec.spawnProgress + progress);
    spec.lastUpdateMs = currentTimeMs;

    // Transition to idle when spawn complete
    if (spec.spawnProgress >= 1.0 && spec.state === 'spawning') {
      spec.state = 'idle';
      spec.spawnProgress = 0;
      spec.nextBlinkMs = currentTimeMs + BLINK_INTERVAL_MIN_MS;
    }
  }
}

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

      // Determine state-specific frame key suffix
      const stateFrameKey = spec.state === 'walk'
        ? `walk_${spec.frame}`
        : 'idle_0'; // spawning/despawning use idle frame with clipping

      // Apply spawn/despawn clipping if needed
      if (spec.state === 'spawning' || spec.state === 'despawning') {
        ctx.save();
      }

      // Render each layer in order (back to front)
      for (const layer of AVATAR_LAYERS) {
        // Frame key format: avatar_{variant}_{layer}_{direction}_{state}_{frame}
        const frameKey = `avatar_${spec.variant}_${layer}_${spec.direction}_${stateFrameKey}`;

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

        // Apply clipping for spawn/despawn effects
        if (spec.state === 'spawning' || spec.state === 'despawning') {
          // Create clip rectangle (only on first layer to avoid multiple clips)
          if (layer === AVATAR_LAYERS[0]) {
            const clipY = spec.state === 'spawning'
              ? dy
              : dy + frame.h * (1 - spec.spawnProgress);
            const clipHeight = frame.h * spec.spawnProgress;

            ctx.beginPath();
            ctx.rect(dx, clipY, frame.w, clipHeight);
            ctx.clip();
          }
        }

        // Draw sprite (no mirroring - all 8 directions are unique sprites)
        ctx.drawImage(
          frame.bitmap,
          frame.x, frame.y,  // Source atlas position
          frame.w, frame.h,  // Source size
          dx, dy,            // Destination position
          frame.w, frame.h   // Destination size (no scaling)
        );
      }

      // Restore context after spawn/despawn clipping
      if (spec.state === 'spawning' || spec.state === 'despawning') {
        ctx.restore();
      }

      // Draw blink overlay for idle state
      if (spec.state === 'idle' && spec.blinkFrame > 0) {
        const blinkFrameKey = `avatar_blink_${spec.direction}_${spec.blinkFrame}`;
        const blinkFrame = spriteCache.getFrame(atlasName, blinkFrameKey);

        if (blinkFrame) {
          const dx = Math.floor(screen.x - blinkFrame.w / 2);
          const dy = Math.floor(screen.y - blinkFrame.h);

          ctx.drawImage(
            blinkFrame.bitmap,
            blinkFrame.x, blinkFrame.y,
            blinkFrame.w, blinkFrame.h,
            dx, dy,
            blinkFrame.w, blinkFrame.h
          );
        }
      }
    },
  };
}
