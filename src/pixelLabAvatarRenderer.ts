// src/pixelLabAvatarRenderer.ts
// PixelLab single-sprite avatar renderer
// Renders pre-generated PixelLab characters as scaled single sprites per frame.

import { tileToScreen, TILE_H_HALF } from "./isometricMath.js";
import type { SpriteCache } from "./isoSpriteCache.js";
import type { Renderable } from "./isoTypes.js";
import type { AvatarSpec, AvatarRenderer } from "./avatarRendererTypes.js";

/** Default PixelLab atlas name (beanie-hoodie-guy fallback) */
const DEFAULT_ATLAS_NAME = "pixellab";

/**
 * Map a TeamSection string to the corresponding PixelLab atlas name.
 * Falls back to the default 'pixellab' atlas when team is unrecognised or absent.
 */
export function getAtlasForTeam(team?: string): string {
  switch (team) {
    case 'planning':       return 'pl-planning';
    case 'core-dev':       return 'pl-core-dev';
    case 'infrastructure': return 'pl-infrastructure';
    case 'support':        return 'pl-support';
    default:               return DEFAULT_ATLAS_NAME;
  }
}

/** Scale factor: 48px sprites scaled up to match furniture proportions */
const SCALE = 2.5;

/** Vertical offset to align character feet with tile surface */
const Y_OFFSET = 30;

/** Walk animation: 6 frames per cycle */
const WALK_FRAMES = 6;

/** Idle (breathing) animation: 4 frames per cycle */
const IDLE_FRAMES = 4;

/** Time per walk animation frame (ms) */
const WALK_FRAME_DURATION_MS = 150;

/** Time per idle animation frame (ms) */
const IDLE_FRAME_DURATION_MS = 250;

/** Vertical offset applied to avatar ground position */
const AVATAR_GROUND_Y = 0;

/**
 * PixelLab avatar renderer implementation.
 *
 * Frame key format: pl_{animation}_{habboDirection}_{frameNum}
 * - pl_rot_{dir}            — static rotation (spawn/despawn fallback)
 * - pl_idle_{dir}_{frame}   — breathing idle (4 frames)
 * - pl_walk_{dir}_{frame}   — walking (6 frames)
 * - pl_run_{dir}_{frame}    — running (6 frames)
 */
export const pixelLabRenderer: AvatarRenderer = {
  name: "PixelLab",

  isAvailable(spriteCache: SpriteCache): boolean {
    return spriteCache.getFrame(DEFAULT_ATLAS_NAME, "pl_rot_3") !== null;
  },

  updateAnimation(spec: AvatarSpec, currentTimeMs: number): void {
    const elapsed = currentTimeMs - spec.lastUpdateMs;

    // Walk cycle: 6 frames
    if (spec.state === "walk") {
      if (elapsed >= WALK_FRAME_DURATION_MS) {
        spec.frame = (spec.frame + 1) % WALK_FRAMES;
        spec.lastUpdateMs = currentTimeMs;
      }
    }

    // Idle/sit: breathing animation (4 frames)
    if (spec.state === "idle" || spec.state === "sit") {
      const idleElapsed = currentTimeMs - (spec.pixelLabIdleLastMs || spec.lastUpdateMs);
      if (idleElapsed >= IDLE_FRAME_DURATION_MS) {
        spec.pixelLabIdleFrame = ((spec.pixelLabIdleFrame || 0) + 1) % IDLE_FRAMES;
        spec.pixelLabIdleLastMs = currentTimeMs;
      }
    }

    // Spawn/despawn effects
    if (spec.state === "spawning" || spec.state === "despawning") {
      const SPAWN_DURATION_MS = 1000;
      const progress = elapsed / SPAWN_DURATION_MS;

      if (spec.state === "spawning") {
        spec.spawnProgress = Math.min(1.0, spec.spawnProgress + progress);
        if (spec.spawnProgress >= 1.0) {
          spec.state = "idle";
          spec.spawnProgress = 0;
        }
      } else {
        spec.spawnProgress = Math.max(0, spec.spawnProgress - progress);
      }
      spec.lastUpdateMs = currentTimeMs;
    }
  },

  createRenderable(spec: AvatarSpec, spriteCache: SpriteCache): Renderable | null {
    if (!this.isAvailable(spriteCache)) {
      return null;
    }

    return {
      tileX: spec.tileX + 0.6,
      tileY: spec.tileY,
      tileZ: spec.tileZ,
      draw: (ctx) => {
        const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);
        screen.y += AVATAR_GROUND_Y;
        screen.x += spec.screenOffsetX || 0;
        screen.y += spec.screenOffsetY || 0;

        // Build frame key based on state
        let frameKey: string;
        if (spec.state === "walk") {
          frameKey = `pl_walk_${spec.direction}_${spec.frame}`;
        } else if (spec.state === "idle" || spec.state === "sit") {
          const idleFrame = spec.pixelLabIdleFrame || 0;
          frameKey = `pl_idle_${spec.direction}_${idleFrame}`;
        } else {
          frameKey = `pl_rot_${spec.direction}`;
        }

        const atlasName = getAtlasForTeam(spec.team);
        const frame = spriteCache.getFrame(atlasName, frameKey)
          || spriteCache.getFrame(atlasName, `pl_rot_${spec.direction}`)
          || spriteCache.getFrame(DEFAULT_ATLAS_NAME, frameKey)
          || spriteCache.getFrame(DEFAULT_ATLAS_NAME, `pl_rot_${spec.direction}`);
        if (!frame) return;

        const dw = Math.floor(frame.w * SCALE);
        const dh = Math.floor(frame.h * SCALE);
        const dx = Math.floor(screen.x - dw / 2);
        const dy = Math.floor(screen.y - dh + TILE_H_HALF + Y_OFFSET);

        // Spawn/despawn clipping
        if (spec.state === "spawning" || spec.state === "despawning") {
          ctx.save();
          const clipY = spec.state === "spawning"
            ? dy
            : dy + dh * (1 - spec.spawnProgress);
          const clipHeight = dh * spec.spawnProgress;
          ctx.beginPath();
          ctx.rect(dx, clipY, dw, clipHeight);
          ctx.clip();
        }

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          frame.bitmap,
          frame.x, frame.y, frame.w, frame.h,
          dx, dy, dw, dh,
        );

        if (spec.state === "spawning" || spec.state === "despawning") {
          ctx.restore();
        }
      },
    };
  },
};
