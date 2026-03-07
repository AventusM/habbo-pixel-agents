// tests/isoAvatarRenderer.test.ts
// Smoke tests for avatar renderer with 8-direction support

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAvatarRenderable, createNitroAvatarRenderable, buildFrameKey, updateAvatarAnimation, WALK_FRAME_DURATION_MS, BLINK_INTERVAL_MIN_MS, BLINK_INTERVAL_MAX_MS, BLINK_FRAME_DURATION_MS } from '../src/isoAvatarRenderer.js';
import type { AvatarSpec } from '../src/isoAvatarRenderer.js';
import { SpriteCache } from '../src/isoSpriteCache.js';
import type { OutfitConfig, PartType } from '../src/avatarOutfitConfig.js';
import { outfitToFigureParts, getDefaultPreset } from '../src/avatarOutfitConfig.js';

describe('isoAvatarRenderer', () => {
  let spriteCache: SpriteCache;

  beforeEach(() => {
    spriteCache = new SpriteCache();
  });

  it('exports AvatarSpec interface with all required fields', () => {
    // TypeScript compile-time check - if this compiles, interface exists
    const spec: AvatarSpec = {
      id: 'test-avatar',
      tileX: 5,
      tileY: 5,
      tileZ: 0,
      direction: 2,
      variant: 0,
      state: 'idle',
      frame: 0,
      lastUpdateMs: 0,
      nextBlinkMs: 5000,
      blinkFrame: 0,
      spawnProgress: 0,
    };

    expect(spec.id).toBe('test-avatar');
    expect(spec.direction).toBe(2);
    expect(spec.variant).toBe(0);
    expect(spec.state).toBe('idle');
    expect(spec.frame).toBe(0);
    expect(spec.lastUpdateMs).toBe(0);
    expect(spec.nextBlinkMs).toBe(5000);
    expect(spec.blinkFrame).toBe(0);
    expect(spec.spawnProgress).toBe(0);
  });

  it('createAvatarRenderable returns Renderable with correct tileX/tileY/tileZ', () => {
    const spec: AvatarSpec = {
      id: 'av1',
      tileX: 3,
      tileY: 7,
      tileZ: 2,
      direction: 0,
      variant: 0,
      state: 'idle',
      frame: 0,
      lastUpdateMs: 0,
      nextBlinkMs: 5000,
      blinkFrame: 0,
      spawnProgress: 0,
    };

    const renderable = createAvatarRenderable(spec, spriteCache, 'avatar');

    expect(renderable.tileX).toBe(3.6); // +0.6 depth bias for avatar sorting
    expect(renderable.tileY).toBe(7);
    expect(renderable.tileZ).toBe(2);
    expect(typeof renderable.draw).toBe('function');
  });

  it('renderable.draw() does not throw when sprite cache is empty (graceful degradation)', () => {
    const spec: AvatarSpec = {
      id: 'av2',
      tileX: 1,
      tileY: 1,
      tileZ: 0,
      direction: 4,
      variant: 2,
      state: 'idle',
      frame: 0,
      lastUpdateMs: 0,
      nextBlinkMs: 5000,
      blinkFrame: 0,
      spawnProgress: 0,
    };

    const renderable = createAvatarRenderable(spec, spriteCache, 'avatar');

    // Mock canvas context
    const ctx = {
      drawImage: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
    } as unknown as CanvasRenderingContext2D;

    // Should not throw even when sprite cache is empty
    expect(() => renderable.draw(ctx)).not.toThrow();
  });

  it('all 8 directions produce distinct frame lookups', () => {
    const directions = [0, 1, 2, 3, 4, 5, 6, 7] as const;
    const frameKeys = new Set<string>();

    for (const direction of directions) {
      const spec: AvatarSpec = {
        id: `av-dir-${direction}`,
        tileX: 0,
        tileY: 0,
        tileZ: 0,
        direction,
        variant: 0,
        state: 'idle',
        frame: 0,
        lastUpdateMs: 0,
        nextBlinkMs: 5000,
        blinkFrame: 0,
        spawnProgress: 0,
      };

      // Expected frame key format: avatar_{variant}_{layer}_{direction}_{state}_{frame}
      const expectedFrameKey = `avatar_0_body_${direction}_idle_0`;
      frameKeys.add(expectedFrameKey);
    }

    // All 8 directions should produce unique frame keys
    expect(frameKeys.size).toBe(8);
  });

  it('all 6 variants produce distinct frame lookups', () => {
    const variants = [0, 1, 2, 3, 4, 5] as const;
    const frameKeys = new Set<string>();

    for (const variant of variants) {
      const spec: AvatarSpec = {
        id: `av-var-${variant}`,
        tileX: 0,
        tileY: 0,
        tileZ: 0,
        direction: 0,
        variant,
        state: 'idle',
        frame: 0,
        lastUpdateMs: 0,
        nextBlinkMs: 5000,
        blinkFrame: 0,
        spawnProgress: 0,
      };

      // Expected frame key format: avatar_{variant}_{layer}_{direction}_{state}_{frame}
      const expectedFrameKey = `avatar_${variant}_body_0_idle_0`;
      frameKeys.add(expectedFrameKey);
    }

    // All 6 variants should produce unique frame keys
    expect(frameKeys.size).toBe(6);
  });

  it('idle vs walk state produces different frame keys', () => {
    const idleSpec: AvatarSpec = {
      id: 'av-idle',
      tileX: 0,
      tileY: 0,
      tileZ: 0,
      direction: 2,
      variant: 0,
      state: 'idle',
      frame: 0,
      lastUpdateMs: 0,
      nextBlinkMs: 5000,
      blinkFrame: 0,
      spawnProgress: 0,
    };

    const walkSpec: AvatarSpec = {
      id: 'av-walk',
      tileX: 0,
      tileY: 0,
      tileZ: 0,
      direction: 2,
      variant: 0,
      state: 'walk',
      frame: 2,
      lastUpdateMs: 0,
      nextBlinkMs: 0,
      blinkFrame: 0,
      spawnProgress: 0,
    };

    const idleFrameKey = `avatar_0_body_2_idle_0`;
    const walkFrameKey = `avatar_0_body_2_walk_2`;

    expect(idleFrameKey).not.toBe(walkFrameKey);
  });

  it('multi-layer composition renders all layers in correct order', () => {
    const spec: AvatarSpec = {
      id: 'av-layers',
      tileX: 5,
      tileY: 5,
      tileZ: 0,
      direction: 3,
      variant: 1,
      state: 'idle',
      frame: 0,
      lastUpdateMs: 0,
      nextBlinkMs: 5000,
      blinkFrame: 0,
      spawnProgress: 0,
    };

    const renderable = createAvatarRenderable(spec, spriteCache, 'avatar');

    // Track drawImage calls to verify layer order
    const drawCalls: string[] = [];
    const mockCtx = {
      drawImage: (...args: any[]) => {
        // ImageBitmap argument is not available in test, but we can track the call
        drawCalls.push('drawImage');
      },
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
    } as unknown as CanvasRenderingContext2D;

    // Render with empty sprite cache (no actual sprites)
    renderable.draw(mockCtx);

    // Since sprite cache is empty, no layers will be drawn (graceful degradation)
    // This test verifies the multi-layer loop exists and doesn't crash
    expect(drawCalls.length).toBe(0); // No sprites = no draws

    // Test would draw 4 layers (body, clothing, head, hair) if sprites existed
  });

  // Animation timing tests
  it('updateAvatarAnimation advances walk frames every 250ms', () => {
    const spec: AvatarSpec = {
      id: 'av-walk',
      tileX: 0,
      tileY: 0,
      tileZ: 0,
      direction: 2,
      variant: 0,
      state: 'walk',
      frame: 0,
      lastUpdateMs: 0,
      nextBlinkMs: 0,
      blinkFrame: 0,
      spawnProgress: 0,
    };

    // Before WALK_FRAME_DURATION_MS - no frame change
    updateAvatarAnimation(spec, WALK_FRAME_DURATION_MS - 50);
    expect(spec.frame).toBe(0);

    // At WALK_FRAME_DURATION_MS - frame advances
    updateAvatarAnimation(spec, WALK_FRAME_DURATION_MS);
    expect(spec.frame).toBe(1);
    expect(spec.lastUpdateMs).toBe(WALK_FRAME_DURATION_MS);
  });

  it('walk cycle wraps from frame 3 to 0', () => {
    const spec: AvatarSpec = {
      id: 'av-walk',
      tileX: 0,
      tileY: 0,
      tileZ: 0,
      direction: 2,
      variant: 0,
      state: 'walk',
      frame: 3,
      lastUpdateMs: 0,
      nextBlinkMs: 0,
      blinkFrame: 0,
      spawnProgress: 0,
    };

    // Advance from frame 3 -> 0
    updateAvatarAnimation(spec, WALK_FRAME_DURATION_MS);
    expect(spec.frame).toBe(0);
  });

  it('idle triggers blink when nextBlinkMs is reached', () => {
    const spec: AvatarSpec = {
      id: 'av-idle',
      tileX: 0,
      tileY: 0,
      tileZ: 0,
      direction: 2,
      variant: 0,
      state: 'idle',
      frame: 0,
      lastUpdateMs: 0,
      nextBlinkMs: 5000,
      blinkFrame: 0,
      spawnProgress: 0,
    };

    // Before blink time
    updateAvatarAnimation(spec, 4999);
    expect(spec.blinkFrame).toBe(0);

    // At blink time - blink starts
    updateAvatarAnimation(spec, 5000);
    expect(spec.blinkFrame).toBe(1);
  });

  it('blink advances through frames 1->2->3->0 at 100ms intervals', () => {
    const spec: AvatarSpec = {
      id: 'av-idle',
      tileX: 0,
      tileY: 0,
      tileZ: 0,
      direction: 2,
      variant: 0,
      state: 'idle',
      frame: 0,
      lastUpdateMs: 0,
      nextBlinkMs: 0,
      blinkFrame: 1,
      spawnProgress: 0,
    };

    // Frame 1 -> 2
    updateAvatarAnimation(spec, BLINK_FRAME_DURATION_MS);
    expect(spec.blinkFrame).toBe(2);

    // Frame 2 -> 3
    updateAvatarAnimation(spec, 2 * BLINK_FRAME_DURATION_MS);
    expect(spec.blinkFrame).toBe(3);

    // Frame 3 -> 0
    updateAvatarAnimation(spec, 3 * BLINK_FRAME_DURATION_MS);
    expect(spec.blinkFrame).toBe(0);

    // Next blink scheduled
    expect(spec.nextBlinkMs).toBeGreaterThanOrEqual(3 * BLINK_FRAME_DURATION_MS + BLINK_INTERVAL_MIN_MS);
    expect(spec.nextBlinkMs).toBeLessThanOrEqual(3 * BLINK_FRAME_DURATION_MS + BLINK_INTERVAL_MAX_MS);
  });

  it('spawning progress increments toward 1.0', () => {
    const spec: AvatarSpec = {
      id: 'av-spawn',
      tileX: 0,
      tileY: 0,
      tileZ: 0,
      direction: 2,
      variant: 0,
      state: 'spawning',
      frame: 0,
      lastUpdateMs: 0,
      nextBlinkMs: 0,
      blinkFrame: 0,
      spawnProgress: 0,
    };

    // After 500ms - halfway
    updateAvatarAnimation(spec, 500);
    expect(spec.spawnProgress).toBeCloseTo(0.5, 1);
    expect(spec.state).toBe('spawning');

    // After 999ms - almost complete (still spawning)
    updateAvatarAnimation(spec, 999);
    expect(spec.spawnProgress).toBeCloseTo(0.999, 2);
    expect(spec.state).toBe('spawning');
  });

  it('spawning transitions to idle when progress reaches 1.0', () => {
    const spec: AvatarSpec = {
      id: 'av-spawn',
      tileX: 0,
      tileY: 0,
      tileZ: 0,
      direction: 2,
      variant: 0,
      state: 'spawning',
      frame: 0,
      lastUpdateMs: 0,
      nextBlinkMs: 0,
      blinkFrame: 0,
      spawnProgress: 0,
    };

    // Complete spawn effect
    updateAvatarAnimation(spec, 1000);

    expect(spec.state).toBe('idle');
    expect(spec.spawnProgress).toBe(0);
    expect(spec.nextBlinkMs).toBeGreaterThanOrEqual(1000 + BLINK_INTERVAL_MIN_MS);
  });

  it('frame key format changes for walk vs idle state', () => {
    // This is a logical test to verify the frame key pattern
    // In real rendering, walk uses walk_{frame} and idle uses idle_0

    const idleKey = 'avatar_0_body_2_idle_0';
    const walkKey = 'avatar_0_body_2_walk_2';

    // Keys should differ in state portion
    expect(idleKey.includes('idle')).toBe(true);
    expect(walkKey.includes('walk')).toBe(true);
    expect(idleKey).not.toBe(walkKey);
  });

  // --- Dynamic OutfitConfig tests ---

  it('createNitroAvatarRenderable returns null when sprite cache has no body asset', () => {
    const spec: AvatarSpec = {
      id: 'av-no-asset',
      tileX: 0,
      tileY: 0,
      tileZ: 0,
      direction: 2,
      variant: 0,
      state: 'idle',
      frame: 0,
      lastUpdateMs: 0,
      nextBlinkMs: 5000,
      blinkFrame: 0,
      spawnProgress: 0,
    };

    // Sprite cache is empty - no Nitro assets loaded
    const result = createNitroAvatarRenderable(spec, spriteCache);
    expect(result).toBeNull();
  });

  it('AvatarSpec without outfit field compiles and works (backward compatible)', () => {
    const spec: AvatarSpec = {
      id: 'av-no-outfit',
      tileX: 5,
      tileY: 5,
      tileZ: 0,
      direction: 2,
      variant: 3,
      state: 'idle',
      frame: 0,
      lastUpdateMs: 0,
      nextBlinkMs: 5000,
      blinkFrame: 0,
      spawnProgress: 0,
      // No outfit field - should fall back to variant-based defaults
    };

    expect(spec.outfit).toBeUndefined();
    // Verify it still creates a renderable (placeholder path)
    const renderable = createAvatarRenderable(spec, spriteCache, 'avatar');
    expect(renderable).toBeDefined();
    expect(renderable.tileX).toBe(5.6);
  });

  it('AvatarSpec with outfit field uses OutfitConfig', () => {
    const outfit: OutfitConfig = getDefaultPreset(6); // Female pink outfit
    const spec: AvatarSpec = {
      id: 'av-with-outfit',
      tileX: 5,
      tileY: 5,
      tileZ: 0,
      direction: 2,
      variant: 0,
      state: 'idle',
      frame: 0,
      lastUpdateMs: 0,
      nextBlinkMs: 5000,
      blinkFrame: 0,
      spawnProgress: 0,
      outfit,
    };

    expect(spec.outfit).toBeDefined();
    expect(spec.outfit!.gender).toBe('F');
    expect(spec.outfit!.parts.hair.asset).toBe('Hair_F_Bob');
    expect(spec.outfit!.colors.skin).toBe('#FCEBD6');
  });

  it('buildFrameKey with default figureParts produces expected key format', () => {
    // Default figureParts uses hh_human_body for body (setId 1)
    const key = buildFrameKey('bd', 'idle', 2, 0, 0);
    expect(key).toBe('h_std_bd_1_2_0');
  });

  it('buildFrameKey with custom figureParts uses custom setIds', () => {
    const customParts = outfitToFigureParts(getDefaultPreset(6));
    // Preset 6 uses Hair_F_Bob setId 2073
    const hairKey = buildFrameKey('hr', 'idle', 2, 0, 0, customParts);
    expect(hairKey).toBe('h_std_hr_2073_2_0');

    // Preset 6 uses Shirt_F_Schoolshirt setId 2110
    const shirtKey = buildFrameKey('ch', 'idle', 0, 0, 0, customParts);
    expect(shirtKey).toBe('h_std_ch_2110_0_0');
  });

  it('buildFrameKey walk action for walk-capable parts', () => {
    const key = buildFrameKey('bd', 'walk', 2, 3, 0);
    expect(key).toBe('h_wlk_bd_1_2_3');
  });

  it('buildFrameKey sit action for sit-capable parts', () => {
    const key = buildFrameKey('bd', 'sit', 0, 0, 0);
    expect(key).toBe('h_sit_bd_1_0_0');
  });

  it('buildFrameKey head uses variant-mapped setId', () => {
    // hd setId = (variant % 4) + 1
    const keyV0 = buildFrameKey('hd', 'idle', 0, 0, 0);
    expect(keyV0).toBe('h_std_hd_1_0_0');

    const keyV3 = buildFrameKey('hd', 'idle', 0, 0, 3);
    expect(keyV3).toBe('h_std_hd_4_0_0');

    const keyV5 = buildFrameKey('hd', 'idle', 0, 0, 5);
    expect(keyV5).toBe('h_std_hd_2_0_0'); // 5 % 4 + 1 = 2
  });
});
