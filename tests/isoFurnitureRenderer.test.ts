// tests/isoFurnitureRenderer.test.ts
// Unit tests for furniture rendering module

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createFurnitureRenderable,
  getBaseDirection,
  shouldMirrorSprite,
  type FurnitureSpec,
} from '../src/isoFurnitureRenderer.js';
import type { SpriteCache, SpriteFrame } from '../src/isoSpriteCache.js';
import type { Renderable } from '../src/isoTypes.js';

describe('isoFurnitureRenderer', () => {
  let mockSpriteCache: SpriteCache;
  let mockFrame: SpriteFrame;
  let mockCtx: any;

  beforeEach(() => {
    // Mock sprite frame
    mockFrame = {
      bitmap: {} as ImageBitmap,
      x: 0,
      y: 0,
      w: 64,
      h: 64,
    };

    // Mock sprite cache
    mockSpriteCache = {
      getFrame: vi.fn().mockReturnValue(mockFrame),
    } as any;

    // Mock canvas context
    mockCtx = {
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
    };
  });

  describe('getBaseDirection', () => {
    it('returns 0 for direction 0 (front-facing)', () => {
      expect(getBaseDirection(0)).toBe(0);
    });

    it('returns 2 for direction 2 (right-facing)', () => {
      expect(getBaseDirection(2)).toBe(2);
    });

    it('returns 2 for direction 4 (back-facing, mirrors direction 2)', () => {
      expect(getBaseDirection(4)).toBe(2);
    });

    it('returns 0 for direction 6 (left-facing, mirrors direction 0)', () => {
      expect(getBaseDirection(6)).toBe(0);
    });
  });

  describe('shouldMirrorSprite', () => {
    it('returns false for direction 0', () => {
      expect(shouldMirrorSprite(0)).toBe(false);
    });

    it('returns false for direction 2', () => {
      expect(shouldMirrorSprite(2)).toBe(false);
    });

    it('returns true for direction 4 (mirrored)', () => {
      expect(shouldMirrorSprite(4)).toBe(true);
    });

    it('returns true for direction 6 (mirrored)', () => {
      expect(shouldMirrorSprite(6)).toBe(true);
    });
  });

  describe('createFurnitureRenderable', () => {
    it('returns Renderable with correct tile coordinates', () => {
      const spec: FurnitureSpec = {
        name: 'chair',
        tileX: 3,
        tileY: 4,
        tileZ: 0,
        direction: 0,
      };

      const renderable = createFurnitureRenderable(spec, mockSpriteCache, 'furniture');

      expect(renderable.tileX).toBe(3);
      expect(renderable.tileY).toBe(4);
      expect(renderable.tileZ).toBe(0);
      expect(typeof renderable.draw).toBe('function');
    });

    it('uses correct frame key format for direction 0', () => {
      const spec: FurnitureSpec = {
        name: 'chair',
        tileX: 0,
        tileY: 0,
        tileZ: 0,
        direction: 0,
      };

      const renderable = createFurnitureRenderable(spec, mockSpriteCache, 'furniture');
      renderable.draw(mockCtx);

      expect(mockSpriteCache.getFrame).toHaveBeenCalledWith('furniture', 'chair_64_a_0_0');
    });

    it('uses base direction 2 for direction 4 (mirroring)', () => {
      const spec: FurnitureSpec = {
        name: 'chair',
        tileX: 0,
        tileY: 0,
        tileZ: 0,
        direction: 4,
      };

      const renderable = createFurnitureRenderable(spec, mockSpriteCache, 'furniture');
      renderable.draw(mockCtx);

      // Direction 4 should look up direction 2 sprite
      expect(mockSpriteCache.getFrame).toHaveBeenCalledWith('furniture', 'chair_64_a_2_0');
    });

    it('uses base direction 0 for direction 6 (mirroring)', () => {
      const spec: FurnitureSpec = {
        name: 'chair',
        tileX: 0,
        tileY: 0,
        tileZ: 0,
        direction: 6,
      };

      const renderable = createFurnitureRenderable(spec, mockSpriteCache, 'furniture');
      renderable.draw(mockCtx);

      // Direction 6 should look up direction 0 sprite
      expect(mockSpriteCache.getFrame).toHaveBeenCalledWith('furniture', 'chair_64_a_0_0');
    });

    it('renders without crashing when sprite frame is missing', () => {
      // Mock missing frame
      mockSpriteCache.getFrame = vi.fn().mockReturnValue(null);

      const spec: FurnitureSpec = {
        name: 'missing_furniture',
        tileX: 0,
        tileY: 0,
        tileZ: 0,
        direction: 0,
      };

      const renderable = createFurnitureRenderable(spec, mockSpriteCache, 'furniture');

      // Should not throw - graceful degradation
      expect(() => renderable.draw(mockCtx)).not.toThrow();

      // Should not call drawImage if frame is missing
      expect(mockCtx.drawImage).not.toHaveBeenCalled();
    });

    it('applies horizontal flip for direction 4', () => {
      const spec: FurnitureSpec = {
        name: 'chair',
        tileX: 0,
        tileY: 0,
        tileZ: 0,
        direction: 4,
      };

      const renderable = createFurnitureRenderable(spec, mockSpriteCache, 'furniture');
      renderable.draw(mockCtx);

      // Should save/restore context for flip
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();

      // Should apply horizontal flip
      expect(mockCtx.scale).toHaveBeenCalledWith(-1, 1);

      // Should call drawImage with flipped coordinates
      expect(mockCtx.drawImage).toHaveBeenCalled();
    });

    it('applies horizontal flip for direction 6', () => {
      const spec: FurnitureSpec = {
        name: 'chair',
        tileX: 0,
        tileY: 0,
        tileZ: 0,
        direction: 6,
      };

      const renderable = createFurnitureRenderable(spec, mockSpriteCache, 'furniture');
      renderable.draw(mockCtx);

      // Should save/restore context for flip
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();

      // Should apply horizontal flip
      expect(mockCtx.scale).toHaveBeenCalledWith(-1, 1);
    });

    it('does not flip for direction 0', () => {
      const spec: FurnitureSpec = {
        name: 'chair',
        tileX: 0,
        tileY: 0,
        tileZ: 0,
        direction: 0,
      };

      const renderable = createFurnitureRenderable(spec, mockSpriteCache, 'furniture');
      renderable.draw(mockCtx);

      // Should NOT save/restore or scale for non-mirrored direction
      expect(mockCtx.save).not.toHaveBeenCalled();
      expect(mockCtx.scale).not.toHaveBeenCalled();

      // Should call drawImage normally
      expect(mockCtx.drawImage).toHaveBeenCalled();
    });

    it('rounds coordinates with Math.floor for pixel-perfect rendering', () => {
      // Set up spec at position that would produce fractional screen coordinates
      const spec: FurnitureSpec = {
        name: 'chair',
        tileX: 1,
        tileY: 1,
        tileZ: 0,
        direction: 0,
      };

      const renderable = createFurnitureRenderable(spec, mockSpriteCache, 'furniture');
      renderable.draw(mockCtx);

      // Verify drawImage was called
      expect(mockCtx.drawImage).toHaveBeenCalled();

      // Check that dx and dy are whole numbers (Math.floor applied)
      const drawImageCall = mockCtx.drawImage.mock.calls[0];
      const dx = drawImageCall[5]; // dx parameter
      const dy = drawImageCall[6]; // dy parameter

      expect(Number.isInteger(dx)).toBe(true);
      expect(Number.isInteger(dy)).toBe(true);
    });
  });
});
