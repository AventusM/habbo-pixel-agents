// src/render/avatarPreview.ts
// Pure WYSIWYG avatar preview helper (M006/S02): reuses the in-room Nitro render
// path (createNitroAvatarRenderable) over an OutfitConfig draft so the editor
// preview renders exactly what spawn renders. No React and no stores here — the
// component feeds it a draft and a sprite cache.
import type { AvatarSpec } from '../avatarRendererTypes.js';
import type { OutfitConfig } from '../avatarOutfitConfig.js';
import type { SpriteCache } from '../isoSpriteCache.js';
import { createNitroAvatarRenderable } from '../isoAvatarRenderer.js';

export interface PreviewSpecOptions {
  direction?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export interface PreviewDrawOptions {
  clearWidth?: number;
  clearHeight?: number;
}

const PREVIEW_ID = 'editor-preview';
const FIGURE_BODY_ASSET = 'hh_human_body';

/** Build a minimal idle AvatarSpec whose outfit is the editor draft. */
export function buildPreviewSpec(outfit: OutfitConfig, opts: PreviewSpecOptions = {}): AvatarSpec {
  return {
    id: PREVIEW_ID,
    tileX: 0,
    tileY: 0,
    tileZ: 0,
    direction: opts.direction ?? 2,
    variant: 0,
    state: 'idle',
    frame: 0,
    lastUpdateMs: 0,
    spawnProgress: 0,
    outfit,
  };
}

/**
 * Draw the preview through the shared Nitro path. Returns false when the figure
 * assets are unavailable (empty cache) so the host can show a fallback.
 */
export function drawAvatarPreview(
  ctx: CanvasRenderingContext2D,
  spec: AvatarSpec,
  spriteCache: SpriteCache,
  opts: PreviewDrawOptions = {},
): boolean {
  const renderable = createNitroAvatarRenderable(spec, spriteCache);
  if (!renderable) return false;
  if (opts.clearWidth !== undefined && opts.clearHeight !== undefined) {
    ctx.clearRect(0, 0, opts.clearWidth, opts.clearHeight);
  }
  renderable.draw(ctx);
  return true;
}

/** True when the cache can render the Habbo figure body (editor preview is available). */
export function hasPreviewAssets(spriteCache: SpriteCache | null): boolean {
  return spriteCache !== null && spriteCache.hasNitroAsset(FIGURE_BODY_ASSET);
}
