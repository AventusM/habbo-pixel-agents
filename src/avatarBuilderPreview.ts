// src/avatarBuilderPreview.ts
// Standalone preview renderer for the avatar builder modal.
// Draws a single avatar at a fixed position on a small canvas, facing direction 2
// (front-facing, classic Habbo builder style).

import type { OutfitConfig, PartType } from './avatarOutfitConfig.js';
import type { SpriteCache, NitroSpriteFrame } from './isoSpriteCache.js';
import { outfitToFigureParts } from './avatarOutfitConfig.js';
import { TILE_H_HALF, TILE_W_HALF } from './isometricMath.js';

export const PREVIEW_WIDTH = 120;
export const PREVIEW_HEIGHT = 180;

/**
 * Render order for direction 2 (front-facing): left arm is far side.
 * Same as RENDER_ORDER_LEFT_BEHIND in isoAvatarRenderer.ts.
 */
const RENDER_ORDER: PartType[] = [
  'hrb', 'bd', 'lh', 'ls', 'lg', 'sh', 'ch', 'rh', 'rs', 'hd', 'ey', 'fc', 'hr',
];

/** Map part type to outfit color category */
function getPartColor(part: PartType, colors: OutfitConfig['colors']): string {
  switch (part) {
    case 'bd': case 'lh': case 'rh': case 'hd':
      return colors.skin;
    case 'ey':
      return '#FFFFFF'; // No tint -- white is multiply identity, preserves eye pixel detail
    case 'fc':
      return colors.skin; // Mouth tinted to match skin tone
    case 'hr': case 'hrb':
      return colors.hair;
    case 'ch': case 'ls': case 'rs':
      return colors.shirt;
    case 'lg':
      return colors.pants;
    case 'sh':
      return colors.shoes;
  }
}

/** Lazy-initialized offscreen canvas for per-part tinting */
let _tintCanvas: OffscreenCanvas | null = null;
let _tintCtx: OffscreenCanvasRenderingContext2D | null = null;

function getTintCanvas(w: number, h: number): OffscreenCanvasRenderingContext2D {
  if (!_tintCanvas || _tintCanvas.width < w || _tintCanvas.height < h) {
    _tintCanvas = new OffscreenCanvas(Math.max(w, 128), Math.max(h, 128));
    _tintCtx = _tintCanvas.getContext('2d')!;
  }
  return _tintCtx!;
}

/**
 * Draw a body sprite part with color tinting (preview version).
 * Same algorithm as drawTintedBodyPart in isoAvatarRenderer.ts but simplified
 * (no spawn clipping, no walk animation).
 */
function drawTintedPart(
  ctx: CanvasRenderingContext2D,
  frame: NitroSpriteFrame,
  screenX: number,
  screenY: number,
  flip: boolean,
  color: string,
): void {
  const regX = screenX;
  const regY = screenY + TILE_H_HALF;
  const dx = Math.floor(regX - frame.offsetX);
  const dy = Math.floor(regY - frame.offsetY);

  const tCtx = getTintCanvas(frame.w, frame.h);
  tCtx.clearRect(0, 0, frame.w, frame.h);

  // Step 1: Draw original sprite (optionally flipped)
  tCtx.globalCompositeOperation = 'source-over';
  if (flip) {
    tCtx.save();
    tCtx.translate(frame.w, 0);
    tCtx.scale(-1, 1);
    tCtx.drawImage(frame.bitmap, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
    tCtx.restore();
  } else {
    tCtx.drawImage(frame.bitmap, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  }

  // Step 2: Multiply with outfit color
  tCtx.globalCompositeOperation = 'multiply';
  tCtx.fillStyle = color;
  tCtx.fillRect(0, 0, frame.w, frame.h);

  // Step 3: Restore original alpha mask
  tCtx.globalCompositeOperation = 'destination-in';
  if (flip) {
    tCtx.save();
    tCtx.translate(frame.w, 0);
    tCtx.scale(-1, 1);
    tCtx.drawImage(frame.bitmap, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
    tCtx.restore();
  } else {
    tCtx.drawImage(frame.bitmap, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  }

  tCtx.globalCompositeOperation = 'source-over';

  // Position tinted result
  let drawX: number;
  if (flip) {
    drawX = Math.floor(2 * regX - dx - frame.w);
  } else {
    drawX = dx;
  }

  // Centering correction (same as main renderer)
  drawX += flip ? TILE_W_HALF : -TILE_W_HALF;

  ctx.drawImage(_tintCanvas!, 0, 0, frame.w, frame.h, drawX, dy, frame.w, frame.h);
}

/**
 * Render an avatar preview onto a canvas context.
 * Uses direction 2 (front-facing), frame 0 (idle), centered in the preview canvas.
 */
export function renderAvatarPreview(
  ctx: CanvasRenderingContext2D,
  outfit: OutfitConfig,
  spriteCache: SpriteCache,
  variant: number,
): void {
  ctx.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
  ctx.imageSmoothingEnabled = false;

  const figureParts = outfitToFigureParts(outfit);
  const direction = 2; // front-facing
  const frame = 0;     // idle

  // Center avatar in the preview canvas
  const screenX = PREVIEW_WIDTH / 2;
  const screenY = PREVIEW_HEIGHT - 50; // leave space at bottom for feet

  for (const part of RENDER_ORDER) {
    // Face parts: use hh_human_face asset, not the outfit part
    if (part === 'ey' || part === 'fc') {
      const faceAsset = 'hh_human_face';
      if (!spriteCache.hasNitroAsset(faceAsset)) continue;

      // Direction 2 is always front-facing in preview (always visible)
      const eyeSetId = (variant % 11) + 1;
      const faceSetId = part === 'ey' ? eyeSetId : 1;
      const faceKey = `h_std_${part}_${faceSetId}_${direction}_${frame}`;
      const faceFrame = spriteCache.getNitroFrame(faceAsset, faceKey);
      if (!faceFrame) continue;

      const effectiveFlip = faceFrame.flipH;
      const color = getPartColor(part, outfit.colors);
      drawTintedPart(ctx, faceFrame, screenX, screenY, effectiveFlip, color);
      continue;
    }

    const partDef = figureParts[part];

    if (!spriteCache.hasNitroAsset(partDef.asset)) continue;

    let setId = partDef.setId;
    if (part === 'hd') {
      setId = (variant % 4) + 1;
    }

    const frameKey = `h_std_${part}_${setId}_${direction}_${frame}`;
    const spriteFrame = spriteCache.getNitroFrame(partDef.asset, frameKey);
    if (!spriteFrame) continue;

    // Direction 2 = no flip, but check frame's flipH
    const effectiveFlip = spriteFrame.flipH;

    const color = getPartColor(part, outfit.colors);
    drawTintedPart(ctx, spriteFrame, screenX, screenY, effectiveFlip, color);
  }
}
