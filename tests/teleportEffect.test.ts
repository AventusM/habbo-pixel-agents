// tests/teleportEffect.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTeleportEffect,
  drawTeleportFlash,
  isEffectActive,
} from '../src/teleportEffect.js';
import type { TeleportEffect } from '../src/teleportEffect.js';

describe('teleportEffect', () => {
  describe('createTeleportEffect', () => {
    it('sets correct defaults with 600ms duration', () => {
      const effect = createTeleportEffect(100, 200, 'spawn');
      expect(effect.screenX).toBe(100);
      expect(effect.screenY).toBe(200);
      expect(effect.durationMs).toBe(600);
      expect(effect.type).toBe('spawn');
      expect(effect.startMs).toBeGreaterThan(0);
    });

    it('supports despawn type', () => {
      const effect = createTeleportEffect(50, 75, 'despawn');
      expect(effect.type).toBe('despawn');
    });
  });

  describe('isEffectActive', () => {
    it('returns true while within duration', () => {
      const effect: TeleportEffect = {
        screenX: 100,
        screenY: 200,
        startMs: 1000,
        durationMs: 600,
        type: 'spawn',
      };
      expect(isEffectActive(effect, 1000)).toBe(true);
      expect(isEffectActive(effect, 1300)).toBe(true);
      expect(isEffectActive(effect, 1599)).toBe(true);
    });

    it('returns false after duration elapsed', () => {
      const effect: TeleportEffect = {
        screenX: 100,
        screenY: 200,
        startMs: 1000,
        durationMs: 600,
        type: 'spawn',
      };
      expect(isEffectActive(effect, 1600)).toBe(false);
      expect(isEffectActive(effect, 2000)).toBe(false);
    });
  });

  describe('drawTeleportFlash', () => {
    let ctx: CanvasRenderingContext2D;

    beforeEach(() => {
      // Minimal canvas context mock
      ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        createRadialGradient: vi.fn(() => ({
          addColorStop: vi.fn(),
        })),
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        fillStyle: '',
      } as unknown as CanvasRenderingContext2D;
    });

    it('returns true while active (progress < 1.0)', () => {
      const effect: TeleportEffect = {
        screenX: 100,
        screenY: 200,
        startMs: 1000,
        durationMs: 600,
        type: 'spawn',
      };
      const result = drawTeleportFlash(ctx, effect, 1300);
      expect(result).toBe(true);
    });

    it('returns false when complete (progress >= 1.0)', () => {
      const effect: TeleportEffect = {
        screenX: 100,
        screenY: 200,
        startMs: 1000,
        durationMs: 600,
        type: 'spawn',
      };
      const result = drawTeleportFlash(ctx, effect, 1600);
      expect(result).toBe(false);
    });

    it('sets lighter composite operation for glow', () => {
      const effect: TeleportEffect = {
        screenX: 100,
        screenY: 200,
        startMs: 1000,
        durationMs: 600,
        type: 'spawn',
      };
      drawTeleportFlash(ctx, effect, 1300);
      expect(ctx.globalCompositeOperation).toBe('lighter');
    });

    it('effect at progress=0.5 has peak alpha', () => {
      const effect: TeleportEffect = {
        screenX: 100,
        screenY: 200,
        startMs: 1000,
        durationMs: 600,
        type: 'spawn',
      };
      // At progress=0.5 (300ms), sin(0.5 * PI) = 1.0
      drawTeleportFlash(ctx, effect, 1300);
      // globalAlpha should be sin(0.5 * PI) = 1.0
      expect(ctx.globalAlpha).toBeCloseTo(1.0, 5);
    });

    it('effect at progress=0.25 has sin(0.25*PI) alpha', () => {
      const effect: TeleportEffect = {
        screenX: 100,
        screenY: 200,
        startMs: 1000,
        durationMs: 600,
        type: 'spawn',
      };
      // At progress=0.25 (150ms), sin(0.25 * PI) ~= 0.7071
      drawTeleportFlash(ctx, effect, 1150);
      expect(ctx.globalAlpha).toBeCloseTo(Math.sin(0.25 * Math.PI), 5);
    });

    it('creates radial gradient centered at effect position', () => {
      const effect: TeleportEffect = {
        screenX: 150,
        screenY: 250,
        startMs: 1000,
        durationMs: 600,
        type: 'spawn',
      };
      drawTeleportFlash(ctx, effect, 1300);
      expect(ctx.createRadialGradient).toHaveBeenCalledWith(
        150, 250, 0,
        150, 250, expect.any(Number),
      );
    });
  });
});
