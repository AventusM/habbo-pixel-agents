// tests/isoFurnitureRenderer.test.ts
// Unit tests for furniture rendering module

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createFurnitureRenderable,
  createMultiTileFurnitureRenderable,
  createNitroChairRenderables,
  sliceMultiTileRenderable,
  getBaseDirection,
  shouldMirrorSprite,
  type FurnitureSpec,
  type MultiTileFurnitureSpec,
} from '../src/isoFurnitureRenderer.js';
import type { SpriteCache, SpriteFrame, NitroSpriteFrame, NitroAssetData } from '../src/isoSpriteCache.js';
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
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
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
    it('returns renderable with origin tile coordinates (2×1 desk)', () => {
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

      expect(renderable.tileX).toBe(3);
      expect(renderable.tileY).toBe(3);
      expect(renderable.tileZ).toBe(0);
    });

    it('returns renderable with origin tile coordinates (2×2 bookshelf)', () => {
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

      expect(renderable.tileX).toBe(5);
      expect(renderable.tileY).toBe(5);
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

    it('returns renderable with origin tile coordinates for 1×2 furniture', () => {
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

      expect(renderable.tileX).toBe(2);
      expect(renderable.tileY).toBe(3);
      expect(renderable.tileZ).toBe(0);
    });
  });

  describe('sliceMultiTileRenderable', () => {
    it('returns single renderable unchanged for 1×1 furniture', () => {
      const spec: MultiTileFurnitureSpec = {
        name: 'chair',
        tileX: 3,
        tileY: 4,
        tileZ: 0,
        widthTiles: 1,
        heightTiles: 1,
        direction: 0,
      };
      const renderable: Renderable = { tileX: 3, tileY: 4, tileZ: 0, draw: () => {} };
      const slices = sliceMultiTileRenderable(spec, renderable);

      expect(slices).toHaveLength(1);
      expect(slices[0]).toBe(renderable); // same reference, not a copy
    });

    it('returns 4 slices for 2×1 furniture (2 ground bands + 2 column caps)', () => {
      const spec: MultiTileFurnitureSpec = {
        name: 'desk',
        tileX: 3,
        tileY: 3,
        tileZ: 0,
        widthTiles: 2,
        heightTiles: 1,
        direction: 0,
      };
      const renderable: Renderable = { tileX: 3, tileY: 3, tileZ: 0, draw: () => {} };
      const slices = sliceMultiTileRenderable(spec, renderable);

      // 2 ground bands + 2 column caps + 1 base = 5
      expect(slices).toHaveLength(5);
      // Pairs: [ground d=6, cap d=6, ground d=7, cap d=7], then base
      expect(slices[0].tileX + slices[0].tileY).toBe(6); // ground d=6
      expect(slices[1].tileX + slices[1].tileY).toBe(6); // column cap d=6
      expect(slices[2].tileX + slices[2].tileY).toBe(7); // ground d=7
      expect(slices[3].tileX + slices[3].tileY).toBe(7); // column cap d=7
      expect(slices[4].tileX + slices[4].tileY).toBe(6); // base at origin depth
    });

    it('returns 8 slices for 3×2 furniture (4 ground bands + 4 column caps)', () => {
      const spec: MultiTileFurnitureSpec = {
        name: 'table',
        tileX: 5,
        tileY: 5,
        tileZ: 0,
        widthTiles: 3,
        heightTiles: 2,
        direction: 0,
      };
      const renderable: Renderable = { tileX: 5, tileY: 5, tileZ: 0, draw: () => {} };
      const slices = sliceMultiTileRenderable(spec, renderable);

      // 4 ground bands + 4 column caps + 1 base = 9
      expect(slices).toHaveLength(9);
      // Pairs: [ground, cap] at each depth, then base
      expect(slices[0].tileX + slices[0].tileY).toBe(10); // ground d=10
      expect(slices[1].tileX + slices[1].tileY).toBe(10); // cap d=10
      expect(slices[2].tileX + slices[2].tileY).toBe(11); // ground d=11
      expect(slices[3].tileX + slices[3].tileY).toBe(11); // cap d=11
      expect(slices[4].tileX + slices[4].tileY).toBe(12); // ground d=12
      expect(slices[5].tileX + slices[5].tileY).toBe(12); // cap d=12
      expect(slices[6].tileX + slices[6].tileY).toBe(13); // ground d=13
      expect(slices[7].tileX + slices[7].tileY).toBe(13); // cap d=13
      expect(slices[8].tileX + slices[8].tileY).toBe(10); // base at origin
    });

    it('preserves tileZ on all slices', () => {
      const spec: MultiTileFurnitureSpec = {
        name: 'desk',
        tileX: 2,
        tileY: 3,
        tileZ: 2,
        widthTiles: 2,
        heightTiles: 2,
        direction: 0,
      };
      const renderable: Renderable = { tileX: 2, tileY: 3, tileZ: 2, draw: () => {} };
      const slices = sliceMultiTileRenderable(spec, renderable);

      for (const slice of slices) {
        expect(slice.tileZ).toBe(2);
      }
    });

    it('each slice draw function calls the original renderable draw', () => {
      const spec: MultiTileFurnitureSpec = {
        name: 'desk',
        tileX: 3,
        tileY: 3,
        tileZ: 0,
        widthTiles: 2,
        heightTiles: 1,
        direction: 0,
      };
      const drawFn = vi.fn();
      const renderable: Renderable = { tileX: 3, tileY: 3, tileZ: 0, draw: drawFn };
      const slices = sliceMultiTileRenderable(spec, renderable);

      // Draw each slice — each should call the original draw
      // 2 ground bands + 2 column caps + 1 base = 5 slices
      for (const slice of slices) {
        slice.draw(mockCtx);
      }
      expect(drawFn).toHaveBeenCalledTimes(5);
    });
  });

  describe('createNitroChairRenderables', () => {
    let mockNitroFrame: NitroSpriteFrame;
    let mockNitroSpriteCache: SpriteCache;

    // Metadata matching hc_chr dir 0: layer 0 (seat, z=0), layer 1 (backrest, z=100)
    const dir0Metadata: NitroAssetData = {
      name: 'hc_chr',
      type: 'furniture',
      spritesheet: {} as any,
      assets: {
        'hc_chr_64_a_0_0': { x: -10, y: -20 },
        'hc_chr_64_b_0_0': { x: -10, y: -40 },
      },
      visualization: {
        layerCount: 2,
        directions: {
          '0': { '1': { z: '100' } }, // layer 1 (b) has z=100 → backrest
        },
      },
      logic: { dimensions: [1, 1, 0], directions: [0, 2, 4, 6] },
    };

    // Metadata matching hc_chr dir 2: layer 1 has z=-100 → no backrest, no split
    const dir2Metadata: NitroAssetData = {
      name: 'hc_chr',
      type: 'furniture',
      spritesheet: {} as any,
      assets: {
        'hc_chr_64_a_2_0': { x: -10, y: -20 },
        'hc_chr_64_b_2_0': { x: -10, y: -40 },
      },
      visualization: {
        layerCount: 2,
        directions: {
          '2': { '1': { z: '-100' } }, // layer 1 has z=-100 → seat side
        },
      },
      logic: { dimensions: [1, 1, 0], directions: [0, 2, 4, 6] },
    };

    // Metadata for single-layer chair (no z values → all z=0 → no backrest)
    const singleLayerMetadata: NitroAssetData = {
      name: 'simple_chair',
      type: 'furniture',
      spritesheet: {} as any,
      assets: {
        'simple_chair_64_a_0_0': { x: -10, y: -20 },
      },
      visualization: {
        layerCount: 1,
        directions: {},
      },
      logic: { dimensions: [1, 1, 0], directions: [0, 2, 4, 6] },
    };

    beforeEach(() => {
      mockNitroFrame = {
        bitmap: {} as ImageBitmap,
        x: 0,
        y: 0,
        w: 32,
        h: 48,
        offsetX: -10,
        offsetY: -20,
        flipH: false,
      };

      mockNitroSpriteCache = {
        hasNitroAsset: vi.fn().mockReturnValue(true),
        getNitroMetadata: vi.fn().mockReturnValue(dir0Metadata),
        getNitroFrame: vi.fn().mockReturnValue(mockNitroFrame),
        getFrame: vi.fn().mockReturnValue(null),
      } as any;
    });

    it('dir 0 chair with backrest layer returns 2 renderables (seat + backrest)', () => {
      const spec: FurnitureSpec = { name: 'hc_chr', tileX: 3, tileY: 4, tileZ: 0, direction: 0 };
      (mockNitroSpriteCache.getNitroMetadata as any).mockReturnValue(dir0Metadata);

      const renderables = createNitroChairRenderables(spec, mockNitroSpriteCache, 'hc_chr');

      expect(renderables).toHaveLength(2);
    });

    it('seat renderable has tileX === spec.tileX', () => {
      const spec: FurnitureSpec = { name: 'hc_chr', tileX: 3, tileY: 4, tileZ: 0, direction: 0 };
      (mockNitroSpriteCache.getNitroMetadata as any).mockReturnValue(dir0Metadata);

      const renderables = createNitroChairRenderables(spec, mockNitroSpriteCache, 'hc_chr');

      expect(renderables[0].tileX).toBe(3);
    });

    it('backrest renderable has tileX === spec.tileX + 0.8', () => {
      const spec: FurnitureSpec = { name: 'hc_chr', tileX: 3, tileY: 4, tileZ: 0, direction: 0 };
      (mockNitroSpriteCache.getNitroMetadata as any).mockReturnValue(dir0Metadata);

      const renderables = createNitroChairRenderables(spec, mockNitroSpriteCache, 'hc_chr');

      expect(renderables[1].tileX).toBe(3.8);
    });

    it('both renderables have correct tileY matching spec', () => {
      const spec: FurnitureSpec = { name: 'hc_chr', tileX: 3, tileY: 4, tileZ: 0, direction: 0 };
      (mockNitroSpriteCache.getNitroMetadata as any).mockReturnValue(dir0Metadata);

      const renderables = createNitroChairRenderables(spec, mockNitroSpriteCache, 'hc_chr');

      expect(renderables[0].tileY).toBe(4);
      expect(renderables[1].tileY).toBe(4);
    });

    it('both renderables have correct tileZ matching spec', () => {
      const spec: FurnitureSpec = { name: 'hc_chr', tileX: 3, tileY: 4, tileZ: 2, direction: 0 };
      (mockNitroSpriteCache.getNitroMetadata as any).mockReturnValue(dir0Metadata);

      const renderables = createNitroChairRenderables(spec, mockNitroSpriteCache, 'hc_chr');

      expect(renderables[0].tileZ).toBe(2);
      expect(renderables[1].tileZ).toBe(2);
    });

    it('dir 2 chair with all z <= 0 returns 1 renderable (no split)', () => {
      const spec: FurnitureSpec = { name: 'hc_chr', tileX: 3, tileY: 4, tileZ: 0, direction: 2 };
      (mockNitroSpriteCache.getNitroMetadata as any).mockReturnValue(dir2Metadata);

      const renderables = createNitroChairRenderables(spec, mockNitroSpriteCache, 'hc_chr');

      expect(renderables).toHaveLength(1);
      expect(renderables[0].tileX).toBe(3);
    });

    it('single-layer chair (layerCount 1, no z > 0) returns 1 renderable', () => {
      const spec: FurnitureSpec = { name: 'simple_chair', tileX: 1, tileY: 2, tileZ: 0, direction: 0 };
      (mockNitroSpriteCache.getNitroMetadata as any).mockReturnValue(singleLayerMetadata);

      const renderables = createNitroChairRenderables(spec, mockNitroSpriteCache, 'simple_chair');

      expect(renderables).toHaveLength(1);
      expect(renderables[0].tileX).toBe(1);
    });

    it('missing asset returns empty array', () => {
      const spec: FurnitureSpec = { name: 'missing_chair', tileX: 0, tileY: 0, tileZ: 0, direction: 0 };
      (mockNitroSpriteCache.hasNitroAsset as any).mockReturnValue(false);

      const renderables = createNitroChairRenderables(spec, mockNitroSpriteCache, 'missing_chair');

      expect(renderables).toHaveLength(0);
    });

    it('draw functions call drawImage for each layer in the group', () => {
      const spec: FurnitureSpec = { name: 'hc_chr', tileX: 3, tileY: 4, tileZ: 0, direction: 0 };
      (mockNitroSpriteCache.getNitroMetadata as any).mockReturnValue(dir0Metadata);

      const renderables = createNitroChairRenderables(spec, mockNitroSpriteCache, 'hc_chr');
      expect(renderables).toHaveLength(2);

      // Draw seat (layer a only — z=0)
      const seatCtx = { drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), scale: vi.fn() } as any;
      renderables[0].draw(seatCtx);
      expect(seatCtx.drawImage).toHaveBeenCalledTimes(1);

      // Draw backrest (layer b only — z=100)
      const backCtx = { drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), scale: vi.fn() } as any;
      renderables[1].draw(backCtx);
      expect(backCtx.drawImage).toHaveBeenCalledTimes(1);
    });
  });
});
