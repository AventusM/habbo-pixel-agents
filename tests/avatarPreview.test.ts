// tests/avatarPreview.test.ts
// M006/S02 T04 — the live Nitro preview helper: buildPreviewSpec maps a draft
// into the AvatarSpec the in-room Nitro path consumes, and drawAvatarPreview
// degrades gracefully (returns false) when figure assets are unavailable.

import { describe, it, expect } from 'vitest';
import {
  buildPreviewSpec,
  drawAvatarPreview,
  hasPreviewAssets,
} from '../src/render/avatarPreview.js';
import { ROLE_OUTFIT_PRESETS, getRolePreset } from '../src/avatarOutfitConfig.js';
import type { OutfitConfig } from '../src/avatarOutfitConfig.js';
import type { SpriteCache } from '../src/isoSpriteCache.js';

function mockCache(hasBody: boolean): SpriteCache {
  return {
    hasNitroAsset: (name: string) => name === 'hh_human_body' && hasBody,
    getNitroFrame: () => null,
  } as unknown as SpriteCache;
}

const noopCtx = {
  clearRect: () => {},
  drawImage: () => {},
  save: () => {},
  restore: () => {},
  beginPath: () => {},
  rect: () => {},
  clip: () => {},
} as unknown as CanvasRenderingContext2D;

const draft: OutfitConfig = ROLE_OUTFIT_PRESETS['core-dev'];

describe('buildPreviewSpec', () => {
  it('maps the draft colors and parts into the spec outfit', () => {
    const spec = buildPreviewSpec(draft);
    expect(spec.id).toBe('editor-preview');
    expect(spec.state).toBe('idle');
    expect(spec.variant).toBe(0);
    expect(spec.tileX).toBe(0);
    expect(spec.tileY).toBe(0);
    expect(spec.tileZ).toBe(0);
    expect(spec.outfit).toBe(draft);
    expect(spec.outfit?.colors.shirt).toBe(draft.colors.shirt);
    expect(spec.outfit?.parts.hair).toEqual(draft.parts.hair);
  });

  it('defaults to direction 2 and honours an override', () => {
    expect(buildPreviewSpec(draft).direction).toBe(2);
    expect(buildPreviewSpec(draft, { direction: 6 }).direction).toBe(6);
  });

  it('produces distinct specs for distinct role drafts', () => {
    const planning = buildPreviewSpec(getRolePreset('planning', 0));
    const support = buildPreviewSpec(getRolePreset('support', 0));
    expect(planning.outfit?.colors.shirt).not.toBe(support.outfit?.colors.shirt);
    expect(JSON.stringify(planning)).not.toBe(JSON.stringify(support));
  });
});

describe('drawAvatarPreview', () => {
  it('returns false (no throw) when the cache has no figure assets', () => {
    const cache = mockCache(false);
    const result = drawAvatarPreview(noopCtx, buildPreviewSpec(draft), cache);
    expect(result).toBe(false);
  });

  it('returns true and draws without throwing when the body asset exists', () => {
    const cache = mockCache(true);
    const result = drawAvatarPreview(noopCtx, buildPreviewSpec(draft), cache, {
      clearWidth: 90,
      clearHeight: 120,
    });
    expect(result).toBe(true);
  });
});

describe('hasPreviewAssets', () => {
  it('is false for a null cache and for a cache without the body asset', () => {
    expect(hasPreviewAssets(null)).toBe(false);
    expect(hasPreviewAssets(mockCache(false))).toBe(false);
  });

  it('is true once the body asset is loaded', () => {
    expect(hasPreviewAssets(mockCache(true))).toBe(true);
  });
});
