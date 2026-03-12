// src/isoAvatarRenderer.ts
// Habbo/Nitro avatar sprite rendering for isometric rooms
// Implements 8-direction support with multi-layer composition (body, clothing, head, hair)

import { tileToScreen, TILE_W_HALF, TILE_H_HALF } from "./isometricMath.js";
import type { SpriteCache, NitroSpriteFrame } from "./isoSpriteCache.js";
import type { Renderable } from "./isoTypes.js";
import type { OutfitConfig, PartType } from "./avatarOutfitConfig.js";
import { outfitToFigureParts } from "./avatarOutfitConfig.js";
import type { AvatarRenderer } from "./avatarRendererTypes.js";

// Re-export AvatarSpec from shared types so existing imports keep working
export type { AvatarSpec } from "./avatarRendererTypes.js";
export type { AvatarRenderer } from "./avatarRendererTypes.js";

/** Set to true to draw colored debug borders around each body part */
export let DEBUG_AVATAR_PARTS = false;
export function setDebugAvatarParts(v: boolean) { DEBUG_AVATAR_PARTS = v; }

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
export const BLINK_INTERVAL_MIN_MS = 5000;
export const BLINK_INTERVAL_MAX_MS = 8000;
export const BLINK_FRAME_DURATION_MS = 100;

/** Habbo walk animation frame count */
const HABBO_WALK_FRAMES = 4;

// ---- Habbo/Nitro renderer as AvatarRenderer interface ----

/**
 * Habbo/Nitro avatar renderer implementation.
 * Uses multi-layer body part composition with per-variant outfit colors.
 */
export const habboRenderer: AvatarRenderer = {
  name: "Habbo",

  isAvailable(spriteCache: SpriteCache): boolean {
    return spriteCache.hasNitroAsset("hh_human_body");
  },

  updateAnimation(spec, currentTimeMs) {
    updateAvatarAnimation(spec, currentTimeMs);
  },

  createRenderable(spec, spriteCache) {
    return createNitroAvatarRenderable(spec, spriteCache)
      || createAvatarRenderable(spec, spriteCache, "avatar");
  },
};

// ---- Animation update (Habbo-specific) ----

/**
 * Update avatar animation state based on elapsed time (Habbo/Nitro).
 * Call this each frame BEFORE rendering.
 */
export function updateAvatarAnimation(
  spec: import("./avatarRendererTypes.js").AvatarSpec,
  currentTimeMs: number,
): void {
  const elapsed = currentTimeMs - spec.lastUpdateMs;

  // Walk cycle: 4 frames
  if (spec.state === "walk") {
    if (elapsed >= WALK_FRAME_DURATION_MS) {
      spec.frame = (spec.frame + 1) % HABBO_WALK_FRAMES;
      spec.lastUpdateMs = currentTimeMs;
    }
  }

  // Idle/sit blinks
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

  // Spawn/despawn effects
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
      spec.spawnProgress = Math.max(0, spec.spawnProgress - progress);
    }
    spec.lastUpdateMs = currentTimeMs;
  }
}

// ---- Placeholder avatar rendering (fallback) ----

const AVATAR_LAYERS = ["body", "clothing", "head", "hair"] as const;

export function createAvatarRenderable(
  spec: import("./avatarRendererTypes.js").AvatarSpec,
  spriteCache: SpriteCache,
  atlasName: string,
): Renderable {
  return {
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

/** Side/front views: far arm drawn before body, near arm after chest */
const RENDER_ORDER_LEFT_BEHIND: PartType[] = [
  "hrb", "bd", "lh", "ls", "lg", "sh", "ch", "rh", "rs", "hd", "ey", "fc", "hr",
];
const RENDER_ORDER_RIGHT_BEHIND: PartType[] = [
  "hrb", "bd", "rh", "rs", "lg", "sh", "ch", "lh", "ls", "hd", "ey", "fc", "hr",
];
/** Back views (dirs 0, 1, 7): both arms drawn after chest — fully visible */
const RENDER_ORDER_BACK_VIEW: PartType[] = [
  "hrb", "bd", "lg", "sh", "ch", "rh", "rs", "lh", "ls", "hd", "ey", "fc", "hr",
];

function getRenderOrder(mappedDir: number): PartType[] {
  if (mappedDir === 0 || mappedDir === 1 || mappedDir === 7) return RENDER_ORDER_BACK_VIEW;
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

const WALK_PARTS = new Set<PartType>(["bd", "lh", "rh", "lg", "sh", "ls", "rs"]);
const SIT_PARTS = new Set<PartType>(["bd", "lh", "rh", "lg", "sh", "ls", "rs"]);

/** Per-variant outfit colors */
interface OutfitColors {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
}

const DEFAULT_VARIANT_OUTFITS: OutfitColors[] = [
  { skin: "#EFCFB1", hair: "#4A3728", shirt: "#5B9BD5", pants: "#3B5998", shoes: "#2C2C2C" },
  { skin: "#D4A574", hair: "#1A1A1A", shirt: "#D55B5B", pants: "#333333", shoes: "#5C3A1E" },
  { skin: "#F5D6C3", hair: "#C4651A", shirt: "#5BD55B", pants: "#4A7023", shoes: "#8B6914" },
  { skin: "#EFCFB1", hair: "#8B6DB0", shirt: "#9B5BD5", pants: "#4B0082", shoes: "#2C2C2C" },
  { skin: "#D4A574", hair: "#D4A017", shirt: "#D5A05B", pants: "#8B4513", shoes: "#654321" },
  { skin: "#F5D6C3", hair: "#E0E0E0", shirt: "#D5D55B", pants: "#556B2F", shoes: "#696969" },
];

function getPartColor(part: PartType, outfit: OutfitColors): string {
  switch (part) {
    case "bd": case "lh": case "rh": case "hd": return outfit.skin;
    case "ey": return "#FFFFFF";
    case "fc": return outfit.skin;
    case "hr": case "hrb": return outfit.hair;
    case "ch": case "ls": case "rs": return outfit.shirt;
    case "lg": return outfit.pants;
    case "sh": return outfit.shoes;
  }
}

/** Lazy-initialized offscreen canvas for per-part tinting */
let _tintCanvas: OffscreenCanvas | null = null;
let _tintCtx: OffscreenCanvasRenderingContext2D | null = null;

function getTintCanvas(w: number, h: number): OffscreenCanvasRenderingContext2D {
  if (!_tintCanvas || _tintCanvas.width < w || _tintCanvas.height < h) {
    _tintCanvas = new OffscreenCanvas(Math.max(w, 128), Math.max(h, 128));
    _tintCtx = _tintCanvas.getContext("2d")!;
    _tintCtx.imageSmoothingEnabled = false;
  }
  return _tintCtx!;
}

function drawTintedBodyPart(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frame: NitroSpriteFrame,
  screenX: number,
  screenY: number,
  flip: boolean,
  color: string,
  partName?: string,
): void {
  const regX = screenX;
  const regY = screenY + TILE_H_HALF;
  const dx = Math.floor(regX - frame.offsetX);
  const dy = Math.floor(regY - frame.offsetY);

  const tCtx = getTintCanvas(frame.w, frame.h);
  tCtx.clearRect(0, 0, _tintCanvas!.width, _tintCanvas!.height);

  tCtx.globalCompositeOperation = "source-over";
  if (flip) {
    tCtx.save();
    tCtx.translate(frame.w, 0);
    tCtx.scale(-1, 1);
    tCtx.drawImage(frame.bitmap, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
    tCtx.restore();
  } else {
    tCtx.drawImage(frame.bitmap, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  }

  tCtx.globalCompositeOperation = "multiply";
  tCtx.fillStyle = color;
  tCtx.fillRect(0, 0, frame.w, frame.h);

  tCtx.globalCompositeOperation = "destination-in";
  if (flip) {
    tCtx.save();
    tCtx.translate(frame.w, 0);
    tCtx.scale(-1, 1);
    tCtx.drawImage(frame.bitmap, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
    tCtx.restore();
  } else {
    tCtx.drawImage(frame.bitmap, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  }

  tCtx.globalCompositeOperation = "source-over";

  let drawX: number;
  if (flip) {
    drawX = Math.floor(2 * regX - dx - frame.w);
  } else {
    drawX = dx;
  }
  drawX += flip ? TILE_W_HALF : -TILE_W_HALF;

  ctx.drawImage(_tintCanvas!, 0, 0, frame.w, frame.h, drawX, dy, frame.w, frame.h);

  if (DEBUG_AVATAR_PARTS && partName) {
    const debugColor = DEBUG_PART_COLORS[partName] || "#FFFFFF";
    ctx.strokeStyle = debugColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(drawX + 0.5, dy + 0.5, frame.w - 1, frame.h - 1);
    ctx.fillStyle = debugColor;
    ctx.font = "7px monospace";
    ctx.fillText(partName, drawX, dy - 1);
  }
}

function mapBodyDirection(direction: number): { dir: number; flip: boolean } {
  if (direction <= 3) return { dir: direction, flip: false };
  if (direction === 7) return { dir: 7, flip: false };
  if (direction === 4) return { dir: 2, flip: true };
  if (direction === 5) return { dir: 1, flip: true };
  if (direction === 6) return { dir: 0, flip: true };
  return { dir: 0, flip: false };
}

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
  if (part === "hd") {
    setId = (variant % 4) + 1;
  }
  const isWalking = state === "walk" && WALK_PARTS.has(part);
  const isSitting = state === "sit" && SIT_PARTS.has(part);
  const action = isSitting ? "sit" : isWalking ? "wlk" : "std";
  const frameNum = isWalking ? frame : 0;
  return `h_${action}_${part}_${setId}_${dir}_${frameNum}`;
}

export function createNitroAvatarRenderable(
  spec: import("./avatarRendererTypes.js").AvatarSpec,
  spriteCache: SpriteCache,
): Renderable | null {
  if (!spriteCache.hasNitroAsset("hh_human_body")) {
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
      const { dir: mappedDir, flip } = mapBodyDirection(spec.direction);
      const figureParts = spec.outfit
        ? outfitToFigureParts(spec.outfit)
        : DEFAULT_FIGURE_PARTS;
      const outfitColors: OutfitColors = spec.outfit
        ? spec.outfit.colors
        : (DEFAULT_VARIANT_OUTFITS[spec.variant] || DEFAULT_VARIANT_OUTFITS[0]);
      if (spec.state === "sit") {
        screen.y += 4;
      }
      const stateForFrame = spec.state === "walk" ? "walk" : spec.state === "sit" ? "sit" : "idle";
      const renderOrder = getRenderOrder(mappedDir);

      if (spec.state === "spawning" || spec.state === "despawning") {
        ctx.save();
      }

      let firstFrameDrawn = false;
      const armOffsets: Record<string, { offsetX: number; offsetY: number }> = {};

      for (const part of renderOrder) {
        if (part === "ey" || part === "fc") {
          if (mappedDir === 0 || mappedDir === 7) continue;
          const faceAsset = "hh_human_face";
          if (!spriteCache.hasNitroAsset(faceAsset)) continue;
          const setId = part === "ey" ? ((spec.variant % 11) + 1) : 1;
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
        if (!spriteCache.hasNitroAsset(partDef.asset)) continue;

        const frameKey = buildFrameKey(part, stateForFrame, spec.direction, spec.frame, spec.variant, figureParts);
        let frame = spriteCache.getNitroFrame(partDef.asset, frameKey);
        if (!frame && (stateForFrame === "walk" || stateForFrame === "sit")) {
          frame = spriteCache.getNitroFrame(
            partDef.asset,
            buildFrameKey(part, "idle", spec.direction, 0, spec.variant, figureParts),
          );
        }
        if (!frame) continue;

        const effectiveFlip = flip !== frame.flipH;

        if (!firstFrameDrawn && (spec.state === "spawning" || spec.state === "despawning")) {
          const clDy = Math.floor(screen.y + TILE_H_HALF - frame.offsetY);
          const clipY = spec.state === "spawning"
            ? clDy
            : clDy + frame.h * (1 - spec.spawnProgress);
          const clipHeight = frame.h * spec.spawnProgress;
          ctx.beginPath();
          ctx.rect(screen.x - 64, clipY, 128, clipHeight);
          ctx.clip();
          firstFrameDrawn = true;
        }

        if (part === "rh" || part === "lh") {
          armOffsets[part] = { offsetX: frame.offsetX, offsetY: frame.offsetY };
        }

        if (part === "rs" || part === "ls") {
          const armKey = part === "rs" ? "rh" : "lh";
          const armOff = armOffsets[armKey];
          if (armOff) {
            const armX = -armOff.offsetX;
            const slvX = -frame.offsetX;
            const armY = -armOff.offsetY;
            const slvY = -frame.offsetY;
            const armFrameKey = buildFrameKey(
              armKey as PartType, stateForFrame, spec.direction,
              spec.frame, spec.variant, figureParts,
            );
            const armFrame = spriteCache.getNitroFrame(figureParts[armKey as PartType].asset, armFrameKey);
            if (armFrame) {
              const overlapX = Math.min(armX + armFrame.w, slvX + frame.w) - Math.max(armX, slvX);
              const overlapY = Math.min(armY + armFrame.h, slvY + frame.h) - Math.max(armY, slvY);
              if (overlapX <= 0 || overlapY <= 0) continue;
            }
          }
        }

        const color = getPartColor(part, outfitColors);
        drawTintedBodyPart(ctx, frame, screen.x, screen.y, effectiveFlip, color, part);
      }

      if (spec.state === "spawning" || spec.state === "despawning") {
        ctx.restore();
      }

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
