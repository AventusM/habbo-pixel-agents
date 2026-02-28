// tests/isoFurnitureRenderer.test.ts
// Unit tests for furniture rendering module

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createFurnitureRenderable,
  createMultiTileFurnitureRenderable,
  getBaseDirection,
  shouldMirrorSprite,
  type FurnitureSpec,
  type MultiTileFurnitureSpec,
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

  describe('createMultiTileFurnitureRenderable', () => {
    it('uses max coordinate for sort key (2×1 desk)', () => {
      const spec: MultiTileFurnitureSpec = {
        name: 'desk',
        tileX: 3,
        tileY: 3,
        tileZ: 0,
        widthTiles: 2,
        heightTiles: 1,
        direction: 0,
      };

      const renderable = createMultiTileFurnitureRenderable(spec, mockSpriteCache, 'furniture');

      // Sort key should use max coordinate across footprint
      // Origin: (3,3), Footprint: 2×1, Max: (4,3)
      expect(renderable.tileX).toBe(4); // 3 + 2 - 1
      expect(renderable.tileY).toBe(3); // 3 + 1 - 1
      expect(renderable.tileZ).toBe(0);
    });

    it('uses max coordinate for sort key (2×2 bookshelf)', () => {
      const spec: MultiTileFurnitureSpec = {
        name: 'bookshelf',
        tileX: 5,
        tileY: 5,
        tileZ: 0,
        widthTiles: 2,
        heightTiles: 2,
        direction: 0,
      };

      const renderable = createMultiTileFurnitureRenderable(spec, mockSpriteCache, 'furniture');

      // Origin: (5,5), Footprint: 2×2, Max: (6,6)
      expect(renderable.tileX).toBe(6); // 5 + 2 - 1
      expect(renderable.tileY).toBe(6); // 5 + 2 - 1
      expect(renderable.tileZ).toBe(0);
    });

    it('renders at origin tile, not sort tile', () => {
      const spec: MultiTileFurnitureSpec = {
        name: 'desk',
        tileX: 3,
        tileY: 4,
        tileZ: 0,
        widthTiles: 2,
        heightTiles: 1,
        direction: 0,
      };

      const renderable = createMultiTileFurnitureRenderable(spec, mockSpriteCache, 'furniture');
      renderable.draw(mockCtx);

      // Verify drawImage was called
      expect(mockCtx.drawImage).toHaveBeenCalled();

      // Check that sprite is rendered at origin tile position
      // tileToScreen(3, 4, 0) = { x: (3-4)*32 = -32, y: (3+4)*16 = 112 }
      // dx = Math.floor(-32 - 64/2) = Math.floor(-64) = -64
      // dy = Math.floor(112 - 64) = 48
      const drawImageCall = mockCtx.drawImage.mock.calls[0];
      const dx = drawImageCall[5];
      const dy = drawImageCall[6];

      expect(dx).toBe(-64);
      expect(dy).toBe(48);
    });

    it('uses correct frame key format for multi-tile furniture', () => {
      const spec: MultiTileFurnitureSpec = {
        name: 'desk',
        tileX: 0,
        tileY: 0,
        tileZ: 0,
        widthTiles: 2,
        heightTiles: 1,
        direction: 0,
      };

      const renderable = createMultiTileFurnitureRenderable(spec, mockSpriteCache, 'furniture');
      renderable.draw(mockCtx);

      expect(mockSpriteCache.getFrame).toHaveBeenCalledWith('furniture', 'desk_64_a_0_0');
    });

    it('applies direction mirroring for multi-tile furniture', () => {
      const spec: MultiTileFurnitureSpec = {
        name: 'desk',
        tileX: 0,
        tileY: 0,
        tileZ: 0,
        widthTiles: 2,
        heightTiles: 1,
        direction: 4,
      };

      const renderable = createMultiTileFurnitureRenderable(spec, mockSpriteCache, 'furniture');
      renderable.draw(mockCtx);

      // Direction 4 should apply horizontal flip
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.scale).toHaveBeenCalledWith(-1, 1);
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('handles missing sprite frame gracefully for multi-tile', () => {
      mockSpriteCache.getFrame = vi.fn().mockReturnValue(null);

      const spec: MultiTileFurnitureSpec = {
        name: 'missing_desk',
        tileX: 0,
        tileY: 0,
        tileZ: 0,
        widthTiles: 2,
        heightTiles: 1,
        direction: 0,
      };

      const renderable = createMultiTileFurnitureRenderable(spec, mockSpriteCache, 'furniture');

      // Should not throw
      expect(() => renderable.draw(mockCtx)).not.toThrow();

      // Should not call drawImage
      expect(mockCtx.drawImage).not.toHaveBeenCalled();
    });

    it('rounds coordinates for multi-tile furniture', () => {
      const spec: MultiTileFurnitureSpec = {
        name: 'desk',
        tileX: 1,
        tileY: 1,
        tileZ: 0,
        widthTiles: 2,
        heightTiles: 1,
        direction: 0,
      };

      const renderable = createMultiTileFurnitureRenderable(spec, mockSpriteCache, 'furniture');
      renderable.draw(mockCtx);

      // Verify drawImage was called
      expect(mockCtx.drawImage).toHaveBeenCalled();

      // Check that dx and dy are whole numbers
      const drawImageCall = mockCtx.drawImage.mock.calls[0];
      const dx = drawImageCall[5];
      const dy = drawImageCall[6];

      expect(Number.isInteger(dx)).toBe(true);
      expect(Number.isInteger(dy)).toBe(true);
    });

    it('calculates correct sort key for 1×2 furniture', () => {
      const spec: MultiTileFurnitureSpec = {
        name: 'tall_shelf',
        tileX: 2,
        tileY: 3,
        tileZ: 0,
        widthTiles: 1,
        heightTiles: 2,
        direction: 0,
      };

      const renderable = createMultiTileFurnitureRenderable(spec, mockSpriteCache, 'furniture');

      // Origin: (2,3), Footprint: 1×2, Max: (2,4)
      expect(renderable.tileX).toBe(2); // 2 + 1 - 1
      expect(renderable.tileY).toBe(4); // 3 + 2 - 1
    });
  });
});
