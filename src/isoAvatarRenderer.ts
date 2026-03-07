// src/isoAvatarRenderer.ts
// Avatar sprite rendering for isometric rooms
// Implements 8-direction support with multi-layer composition (body, clothing, head, hair)

import { tileToScreen, TILE_H_HALF } from "./isometricMath.js";
import type { SpriteCache, NitroSpriteFrame } from "./isoSpriteCache.js";
import type { Renderable } from "./isoTypes.js";
import type { OutfitConfig, PartType } from "./avatarOutfitConfig.js";
import { outfitToFigureParts } from "./avatarOutfitConfig.js";

/** Set to true to draw colored debug borders around each body part */
const DEBUG_AVATAR_PARTS = false;

/**
 * Vertical pixel offset to position avatar on tile.
 * 0 = avatar centered on tile diamond.
 */
export const AVATAR_GROUND_Y = 0;

/** Debug colors for each body part */
const DEBUG_PART_COLORS: Record<string, string> = {
  hrb: "#FF00FF",
  bd: "#FF0000",
  lh: "#00FF00",
  lg: "#0000FF",
  sh: "#FFFF00",
  ch: "#00FFFF",
  ls: "#FF8000",
  rh: "#8000FF",
  rs: "#FF0080",
  hd: "#80FF00",
  ey: "#FFD700",
  fc: "#FF4500",
  hr: "#0080FF",
};

/** Animation timing constants */
/** Time per tile step during walking (movement speed) */
export const TILE_STEP_DURATION_MS = 350;
/** Time per walk animation frame (leg cycle speed) */
export const WALK_FRAME_DURATION_MS = 150;
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
  /** Animation state */
  state: "idle" | "walk" | "sit" | "spawning" | "despawning";
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
  /** Dynamic outfit configuration (overrides variant-based fallback) */
  outfit?: OutfitConfig;
}

/**
 * Update avatar animation state based on elapsed time.
 * Call this each frame BEFORE rendering.
 */
export function updateAvatarAnimation(
  spec: AvatarSpec,
  currentTimeMs: number,
): void {
  const elapsed = currentTimeMs - spec.lastUpdateMs;

  // Handle walk cycle
  if (spec.state === "walk") {
    if (elapsed >= WALK_FRAME_DURATION_MS) {
      spec.frame = (spec.frame + 1) % 4; // Cycle through frames 0-3
      spec.lastUpdateMs = currentTimeMs;
    }
  }

  // Handle idle/sit blinks
  if (spec.state === "idle" || spec.state === "sit") {
    if (currentTimeMs >= spec.nextBlinkMs && spec.blinkFrame === 0) {
      spec.blinkFrame = 1;
      spec.lastUpdateMs = currentTimeMs;
    } else if (spec.blinkFrame > 0 && elapsed >= BLINK_FRAME_DURATION_MS) {
      spec.blinkFrame = (spec.blinkFrame + 1) % 4;
      spec.lastUpdateMs = currentTimeMs;

      if (spec.blinkFrame === 0) {
        const interval =
          BLINK_INTERVAL_MIN_MS +
          Math.random() * (BLINK_INTERVAL_MAX_MS - BLINK_INTERVAL_MIN_MS);
        spec.nextBlinkMs = currentTimeMs + interval;
      }
    }
  }

  // Handle spawn/despawn effects
  if (spec.state === "spawning" || spec.state === "despawning") {
    const SPAWN_DURATION_MS = 1000;
    const progress = elapsed / SPAWN_DURATION_MS;

    if (spec.state === "spawning") {
      spec.spawnProgress = Math.min(1.0, spec.spawnProgress + progress);
      if (spec.spawnProgress >= 1.0) {
        spec.state = "idle";
        spec.spawnProgress = 0;
        spec.nextBlinkMs = currentTimeMs + BLINK_INTERVAL_MIN_MS;
      }
    } else {
      // Despawning: decrement toward 0
      spec.spawnProgress = Math.max(0, spec.spawnProgress - progress);
    }
    spec.lastUpdateMs = currentTimeMs;
  }
}

// ---- Placeholder avatar rendering (fallback) ----

const AVATAR_LAYERS = ["body", "clothing", "head", "hair"] as const;

export function createAvatarRenderable(
  spec: AvatarSpec,
  spriteCache: SpriteCache,
  atlasName: string,
): Renderable {
  return {
    // +0.6 bias: avatars render after furniture at same depth.
    // Sitting avatars also use +0.6 (avatar in front of chair is acceptable;
    // true back/front layer splitting would require per-furniture layer slicing).
    tileX: spec.tileX + 0.6,
    tileY: spec.tileY,
    tileZ: spec.tileZ,
    draw: (ctx) => {
      const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);
      screen.y += AVATAR_GROUND_Y;
      screen.x += spec.screenOffsetX || 0;
      screen.y += spec.screenOffsetY || 0;

      const stateFrameKey =
        spec.state === "walk" ? `walk_${spec.frame}` : "idle_0";

      if (spec.state === "spawning" || spec.state === "despawning") {
        ctx.save();
      }

      for (const layer of AVATAR_LAYERS) {
        const frameKey = `avatar_${spec.variant}_${layer}_${spec.direction}_${stateFrameKey}`;
        const frame = spriteCache.getFrame(atlasName, frameKey);
        if (!frame) continue;

        const dx = Math.floor(screen.x - frame.w / 2);
        const dy = Math.floor(screen.y - frame.h);

        if (spec.state === "spawning" || spec.state === "despawning") {
          if (layer === AVATAR_LAYERS[0]) {
            const clipY =
              spec.state === "spawning"
                ? dy
                : dy + frame.h * (1 - spec.spawnProgress);
            const clipHeight = frame.h * spec.spawnProgress;
            ctx.beginPath();
            ctx.rect(dx, clipY, frame.w, clipHeight);
            ctx.clip();
          }
        }

        ctx.drawImage(
          frame.bitmap,
          frame.x,
          frame.y,
          frame.w,
          frame.h,
          dx,
          dy,
          frame.w,
          frame.h,
        );
      }

      if (spec.state === "spawning" || spec.state === "despawning") {
        ctx.restore();
      }
    },
  };
}

// ---- Nitro avatar rendering with 11-layer composition ----

/**
 * Direction-dependent render layer order (back to front).
 *
 * Which arm is "behind" the body depends on facing direction:
 * - Dirs 2,3 (and mirrors 4,5): left arm is far side → lh/ls behind, rh/rs in front
 * - Dirs 0,1,7 (and mirrors 6): right arm is far side → rh/rs behind, lh/ls in front
 *
 * We use the MAPPED direction (after mapBodyDirection) to determine order.
 */
const RENDER_ORDER_LEFT_BEHIND: PartType[] = [
  "hrb",
  "bd",
  "lh",
  "ls",
  "lg",
  "sh",
  "ch",
  "rh",
  "rs",
  "hd",
  "ey",
  "fc",
  "hr",
];
const RENDER_ORDER_RIGHT_BEHIND: PartType[] = [
  "hrb",
  "bd",
  "rh",
  "rs",
  "lg",
  "sh",
  "ch",
  "lh",
  "ls",
  "hd",
  "ey",
  "fc",
  "hr",
];

function getRenderOrder(mappedDir: number): PartType[] {
  // Dirs 2,3: left arm is far → lh/ls drawn behind body
  // Dirs 0,1,7: right arm is far → rh/rs drawn behind body
  // Flip does NOT affect this: when sprites flip, both position and visual
  // content mirror together, so the behind/front relationship stays the same.
  const leftIsFar = mappedDir === 2 || mappedDir === 3;
  return leftIsFar ? RENDER_ORDER_LEFT_BEHIND : RENDER_ORDER_RIGHT_BEHIND;
}

/** Fallback part registry: maps part type → asset name + setId (used when no OutfitConfig) */
const DEFAULT_FIGURE_PARTS: Record<PartType, { asset: string; setId: number }> = {
  bd: { asset: "hh_human_body", setId: 1 },
  lh: { asset: "hh_human_body", setId: 1 },
  rh: { asset: "hh_human_body", setId: 1 },
  hd: { asset: "hh_human_body", setId: 1 },
  ey: { asset: "hh_human_face", setId: 1 },
  fc: { asset: "hh_human_face", setId: 1 },
  hr: { asset: "Hair_M_yo", setId: 2096 },
  hrb: { asset: "Hair_M_yo", setId: 2096 },
  ch: { asset: "Shirt_M_Tshirt_Plain", setId: 2050 },
  ls: { asset: "Shirt_M_Tshirt_Plain", setId: 2050 },
  rs: { asset: "Shirt_M_Tshirt_Plain", setId: 2050 },
  lg: { asset: "Trousers_U_Skinny_Jeans", setId: 2097 },
  sh: { asset: "Shoes_U_Slipons", setId: 2044 },
};

/** Parts that have walk animation frames */
const WALK_PARTS = new Set<PartType>([
  "bd",
  "lh",
  "rh",
  "lg",
  "sh",
  "ls",
  "rs",
]);
// Note: ch (chest) has NO walk frames — always uses std
// hd, hr, hrb also always use std

/** Parts that have sit animation frames */
const SIT_PARTS = new Set<PartType>([
  "bd",
  "lh",
  "rh",
  "lg",
  "sh",
  "ls",
  "rs",
]);

/** Per-variant outfit colors */
interface OutfitColors {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
}

const DEFAULT_VARIANT_OUTFITS: OutfitColors[] = [
  {
    skin: "#EFCFB1",
    hair: "#4A3728",
    shirt: "#5B9BD5",
    pants: "#3B5998",
    shoes: "#2C2C2C",
  }, // 0: Blue outfit, brown hair
  {
    skin: "#D4A574",
    hair: "#1A1A1A",
    shirt: "#D55B5B",
    pants: "#333333",
    shoes: "#5C3A1E",
  }, // 1: Red outfit, black hair
  {
    skin: "#F5D6C3",
    hair: "#C4651A",
    shirt: "#5BD55B",
    pants: "#4A7023",
    shoes: "#8B6914",
  }, // 2: Green outfit, ginger hair
  {
    skin: "#EFCFB1",
    hair: "#8B6DB0",
    shirt: "#9B5BD5",
    pants: "#4B0082",
    shoes: "#2C2C2C",
  }, // 3: Purple outfit, purple hair
  {
    skin: "#D4A574",
    hair: "#D4A017",
    shirt: "#D5A05B",
    pants: "#8B4513",
    shoes: "#654321",
  }, // 4: Orange outfit, blonde hair
  {
    skin: "#F5D6C3",
    hair: "#E0E0E0",
    shirt: "#D5D55B",
    pants: "#556B2F",
    shoes: "#696969",
  }, // 5: Yellow outfit, white hair
];

/** Map part type to outfit color category */
function getPartColor(part: PartType, outfit: OutfitColors): string {
  switch (part) {
    case "bd":
    case "lh":
    case "rh":
    case "hd":
      return outfit.skin;
    case "ey":
      return "#FFFFFF"; // No tint -- white is multiply identity, preserves eye pixel detail
    case "fc":
      return outfit.skin; // Mouth tinted to match skin tone
    case "hr":
    case "hrb":
      return outfit.hair;
    case "ch":
    case "ls":
    case "rs":
      return outfit.shirt;
    case "lg":
      return outfit.pants;
    case "sh":
      return outfit.shoes;
  }
}

/** Lazy-initialized offscreen canvas for per-part tinting */
let _tintCanvas: OffscreenCanvas | null = null;
let _tintCtx: OffscreenCanvasRenderingContext2D | null = null;

function getTintCanvas(
  w: number,
  h: number,
): OffscreenCanvasRenderingContext2D {
  if (!_tintCanvas || _tintCanvas.width < w || _tintCanvas.height < h) {
    _tintCanvas = new OffscreenCanvas(Math.max(w, 128), Math.max(h, 128));
    _tintCtx = _tintCanvas.getContext("2d")!;
    // Disable image smoothing to prevent subpixel interpolation artifacts.
    // Without this, drawImage can generate fractional alpha pixels at sprite
    // edges that survive the multiply + destination-in compositing pipeline,
    // producing faint ghost pixels on the main canvas.
    _tintCtx.imageSmoothingEnabled = false;
  }
  return _tintCtx!;
}

/**
 * Draw a body sprite part with color tinting.
 * Uses multiply blend + destination-in to preserve shading while applying color.
 */
function drawTintedBodyPart(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frame: NitroSpriteFrame,
  screenX: number,
  screenY: number,
  flip: boolean,
  color: string,
  partName?: string,
): void {
  // Registration point: tile center at (screenX, screenY + TILE_H_HALF)
  // Cortex figure X offsets are negative displacements from reg point to sprite origin.
  // sprite_x = regX + offsetX (addition — negative offset moves sprite left of reg).
  // sprite_y = regY - offsetY (subtraction — positive offset means sprite top above reg).
  const regX = screenX;
  const regY = screenY + TILE_H_HALF;
  const dx = Math.floor(regX + frame.offsetX);
  const dy = Math.floor(regY - frame.offsetY);

  const tCtx = getTintCanvas(frame.w, frame.h);
  tCtx.clearRect(0, 0, _tintCanvas!.width, _tintCanvas!.height);

  // Step 1: Draw original sprite (optionally flipped on the offscreen canvas)
  tCtx.globalCompositeOperation = "source-over";
  if (flip) {
    tCtx.save();
    tCtx.translate(frame.w, 0);
    tCtx.scale(-1, 1);
    tCtx.drawImage(
      frame.bitmap,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      0,
      0,
      frame.w,
      frame.h,
    );
    tCtx.restore();
  } else {
    tCtx.drawImage(
      frame.bitmap,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      0,
      0,
      frame.w,
      frame.h,
    );
  }

  // Step 2: Multiply with outfit color (preserves shading)
  tCtx.globalCompositeOperation = "multiply";
  tCtx.fillStyle = color;
  tCtx.fillRect(0, 0, frame.w, frame.h);

  // Step 3: Restore original alpha mask (re-draw sprite, also flipped if needed)
  tCtx.globalCompositeOperation = "destination-in";
  if (flip) {
    tCtx.save();
    tCtx.translate(frame.w, 0);
    tCtx.scale(-1, 1);
    tCtx.drawImage(
      frame.bitmap,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      0,
      0,
      frame.w,
      frame.h,
    );
    tCtx.restore();
  } else {
    tCtx.drawImage(
      frame.bitmap,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      0,
      0,
      frame.w,
      frame.h,
    );
  }

  tCtx.globalCompositeOperation = "source-over";

  // Draw tinted+flipped result to main canvas at the correct position
  let drawX: number;
  if (flip) {
    drawX = Math.floor(2 * regX - dx - frame.w);
  } else {
    drawX = dx;
  }

  ctx.drawImage(
    _tintCanvas!,
    0,
    0,
    frame.w,
    frame.h,
    drawX,
    dy,
    frame.w,
    frame.h,
  );

  // Debug: draw colored border around this part
  if (DEBUG_AVATAR_PARTS && partName) {
    const debugColor = DEBUG_PART_COLORS[partName] || "#FFFFFF";
    ctx.strokeStyle = debugColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(drawX + 0.5, dy + 0.5, frame.w - 1, frame.h - 1);
    // Label the part
    ctx.fillStyle = debugColor;
    ctx.font = "7px monospace";
    ctx.fillText(partName, drawX, dy - 1);
  }
}

/**
 * Map our direction (0-7) to cortex-assets body direction.
 * Cortex body has directions: 0, 1, 2, 3, 7
 * Directions 4, 5, 6 are mirrors of 2, 1, 0 respectively.
 */
function mapBodyDirection(direction: number): { dir: number; flip: boolean } {
  if (direction <= 3) return { dir: direction, flip: false };
  if (direction === 7) return { dir: 7, flip: false };
  if (direction === 4) return { dir: 2, flip: true };
  if (direction === 5) return { dir: 1, flip: true };
  if (direction === 6) return { dir: 0, flip: true };
  return { dir: 0, flip: false };
}

/**
 * Build a Nitro frame key for a given part.
 *
 * Key format: h_{action}_{partType}_{setId}_{direction}_{frame}
 *
 * Parts with walk animation use h_wlk when walking, others always use h_std.
 * Head setId is variant-mapped: (variant % 4) + 1 for 4 head shapes.
 */
export function buildFrameKey(
  part: PartType,
  state: string,
  direction: number,
  frame: number,
  variant: number,
  figureParts: Record<PartType, { asset: string; setId: number }> = DEFAULT_FIGURE_PARTS,
): string {
  const { dir } = mapBodyDirection(direction);
  const partDef = figureParts[part];
  let setId = partDef.setId;

  // Head uses variant-mapped setId for 4 head shapes
  if (part === "hd") {
    setId = (variant % 4) + 1;
  }

  // Determine action: walk parts use h_wlk, sit parts use h_sit, everything else h_std
  const isWalking = state === "walk" && WALK_PARTS.has(part);
  const isSitting = state === "sit" && SIT_PARTS.has(part);
  const action = isSitting ? "sit" : isWalking ? "wlk" : "std";
  const frameNum = isWalking ? frame : 0;

  return `h_${action}_${part}_${setId}_${dir}_${frameNum}`;
}

/**
 * Create a renderable for an avatar using Nitro figure assets
 * with 11-layer composition and per-variant outfit colors.
 */
export function createNitroAvatarRenderable(
  spec: AvatarSpec,
  spriteCache: SpriteCache,
): Renderable | null {
  // Need at least the body asset to render
  if (!spriteCache.hasNitroAsset("hh_human_body")) {
    return null;
  }

  return {
    // +0.6 bias: avatars render after furniture at same depth.
    // Sitting avatars also use +0.6 (avatar in front of chair is acceptable;
    // true back/front layer splitting would require per-furniture layer slicing).
    tileX: spec.tileX + 0.6,
    tileY: spec.tileY,
    tileZ: spec.tileZ,
    draw: (ctx) => {
      const screen = tileToScreen(spec.tileX, spec.tileY, spec.tileZ);
      // Shift avatar down to align feet with tile surface ground plane
      screen.y += AVATAR_GROUND_Y;
      // Apply sub-tile interpolation offsets for smooth walking
      screen.x += spec.screenOffsetX || 0;
      screen.y += spec.screenOffsetY || 0;
      const { dir: mappedDir, flip } = mapBodyDirection(spec.direction);
      // Use dynamic outfit when present, fall back to variant-based defaults
      const figureParts = spec.outfit
        ? outfitToFigureParts(spec.outfit)
        : DEFAULT_FIGURE_PARTS;
      const outfitColors: OutfitColors = spec.outfit
        ? spec.outfit.colors
        : (DEFAULT_VARIANT_OUTFITS[spec.variant] || DEFAULT_VARIANT_OUTFITS[0]);
      // Apply seated Y offset to lower avatar onto chair
      if (spec.state === "sit") {
        screen.y += 4;
      }
      const stateForFrame = spec.state === "walk" ? "walk" : spec.state === "sit" ? "sit" : "idle";
      const renderOrder = getRenderOrder(mappedDir);

      if (spec.state === "spawning" || spec.state === "despawning") {
        ctx.save();
      }

      let firstFrameDrawn = false;

      for (const part of renderOrder) {
        // Face parts: special asset, direction filtering, blink action
        if (part === "ey" || part === "fc") {
          // Face only visible from front/side (mapped dirs 1, 2, 3)
          // Directions 0 and 7 show back of head -- no face
          if (mappedDir === 0 || mappedDir === 7) continue;

          const faceAsset = "hh_human_face";
          if (!spriteCache.hasNitroAsset(faceAsset)) continue;

          // Eyes: setId mapped from variant (11 styles), Mouth: always setId 1
          const setId = part === "ey" ? ((spec.variant % 11) + 1) : 1;

          // Eyes use eyb (eye blink) action when blinkFrame > 0, else std
          const action = (part === "ey" && spec.blinkFrame > 0) ? "eyb" : "std";
          const faceKey = `h_${action}_${part}_${setId}_${mappedDir}_0`;

          const faceFrame = spriteCache.getNitroFrame(faceAsset, faceKey);
          if (!faceFrame) continue;

          const effectiveFlip = flip !== faceFrame.flipH;
          const color = getPartColor(part, outfitColors);
          drawTintedBodyPart(ctx, faceFrame, screen.x, screen.y, effectiveFlip, color, part);
          continue;
        }

        const partDef = figureParts[part];

        // Skip if asset not loaded (graceful degradation)
        if (!spriteCache.hasNitroAsset(partDef.asset)) continue;

        const frameKey = buildFrameKey(
          part,
          stateForFrame,
          spec.direction,
          spec.frame,
          spec.variant,
          figureParts,
        );
        let frame = spriteCache.getNitroFrame(partDef.asset, frameKey);
        // Fallback: if walk/sit frame missing, try std
        if (!frame && (stateForFrame === "walk" || stateForFrame === "sit")) {
          frame = spriteCache.getNitroFrame(
            partDef.asset,
            buildFrameKey(part, "idle", spec.direction, 0, spec.variant, figureParts),
          );
        }
        if (!frame) continue;

        // XOR flip: combine direction mirror with frame's flipH
        const effectiveFlip = flip !== frame.flipH;

        // Setup spawn clipping on first drawn frame
        if (
          !firstFrameDrawn &&
          (spec.state === "spawning" || spec.state === "despawning")
        ) {
          const clDy = Math.floor(screen.y + TILE_H_HALF - frame.offsetY);
          const clipY =
            spec.state === "spawning"
              ? clDy
              : clDy + frame.h * (1 - spec.spawnProgress);
          const clipHeight = frame.h * spec.spawnProgress;

          ctx.beginPath();
          ctx.rect(screen.x - 64, clipY, 128, clipHeight);
          ctx.clip();
          firstFrameDrawn = true;
        }

        const color = getPartColor(part, outfitColors);
        drawTintedBodyPart(
          ctx,
          frame,
          screen.x,
          screen.y,
          effectiveFlip,
          color,
          part,
        );
      }

      if (spec.state === "spawning" || spec.state === "despawning") {
        ctx.restore();
      }

      // Debug: draw crosshair at registration point
      if (DEBUG_AVATAR_PARTS) {
        const regX = screen.x;
        const regY = screen.y + TILE_H_HALF;
        ctx.strokeStyle = "#FF0000";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(regX - 5, regY);
        ctx.lineTo(regX + 5, regY);
        ctx.moveTo(regX, regY - 5);
        ctx.lineTo(regX, regY + 5);
        ctx.stroke();
      }
    },
  };
}
