// src/avatarRendererTypes.ts
// Shared types for avatar rendering backends (PixelLab)

import type { SpriteCache } from "./isoSpriteCache.js";
import type { Renderable } from "./isoTypes.js";
import type { TeamSection } from "./agentTypes.js";

/**
 * Avatar specification — shared by all rendering backends.
 * Contains position, direction, animation state, and visual configuration.
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
  /** Animation state */
  state: "idle" | "walk" | "sit" | "spawning" | "despawning";
  /** Animation frame (walk cycle frame index) */
  frame: number;
  /** Timestamp of last state/frame change (for animation timing) */
  lastUpdateMs: number;
  /** Spawn effect progress (0.0-1.0, only for spawning/despawning states) */
  spawnProgress: number;
  /** Sub-tile X offset in screen pixels for smooth walk interpolation */
  screenOffsetX?: number;
  /** Sub-tile Y offset in screen pixels for smooth walk interpolation */
  screenOffsetY?: number;
  /** Whether this avatar is currently selected (visual highlight) */
  isSelected?: boolean;
  /** Display name shown in name tag (e.g. "Claude 1") */
  displayName?: string;
  /** Key of the chair tile the avatar is sitting on (e.g. "3,5") */
  sittingChairKey?: string;
  /** Team section for PixelLab character selection */
  team?: TeamSection;

  // --- PixelLab-specific state ---
  /** PixelLab idle animation frame (0-3 for breathing cycle) */
  pixelLabIdleFrame?: number;
  /** Timestamp for PixelLab idle frame advancement */
  pixelLabIdleLastMs?: number;
}

/**
 * Avatar renderer backend interface.
 * Each rendering backend implements this.
 */
export interface AvatarRenderer {
  /** Human-readable name for this renderer */
  readonly name: string;

  /**
   * Check if this renderer has the required assets loaded.
   */
  isAvailable(spriteCache: SpriteCache): boolean;

  /**
   * Update avatar animation state for one frame.
   * Called each frame BEFORE rendering.
   */
  updateAnimation(spec: AvatarSpec, currentTimeMs: number): void;

  /**
   * Create a renderable for the given avatar spec.
   * Returns null if assets are missing.
   */
  createRenderable(spec: AvatarSpec, spriteCache: SpriteCache): Renderable | null;
}
