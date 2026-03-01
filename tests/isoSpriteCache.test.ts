// tests/isoSpriteCache.test.ts
// Unit tests for sprite cache with mocked createImageBitmap

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpriteCache, type SpriteManifest } from '../src/isoSpriteCache.js';

describe('SpriteCache', () => {
  let cache: SpriteCache;
  let mockImageBitmap: { width: number; height: number; close: () => void };

  beforeEach(() => {
    cache = new SpriteCache();
    mockImageBitmap = { width: 512, height: 512, close: vi.fn() };

    // Mock createImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn(async (img: HTMLImageElement) => ({
      width: img.width,
      height: img.height,
      close: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loadAtlas loads PNG and JSON into cache', async () => {
    // Mock Image constructor
    const mockImage = {
      width: 512,
      height: 512,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
    };

    vi.stubGlobal('Image', vi.fn(() => mockImage));

    // Mock fetch for JSON manifest
    const mockManifest: SpriteManifest = {
      frames: {
        'furniture_64_a_0_0': {
          frame: { x: 0, y: 0, w: 64, h: 64 },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 },
          sourceSize: { w: 64, h: 64 },
        },
      },
      meta: {
        image: 'furniture_atlas.png',
        format: 'RGBA8888',
        size: { w: 512, h: 512 },
      },
    };

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => mockManifest,
    })) as any;

    // Call loadAtlas
    const loadPromise = cache.loadAtlas('chair', 'test://chair.png', 'test://chair.json');

    // Trigger onload
    if (mockImage.onload) {
      mockImage.onload();
    }

    await loadPromise;

    // Verify createImageBitmap was called
    expect(globalThis.createImageBitmap).toHaveBeenCalled();
  });

  it('getFrame returns correct atlas region for valid frame name', async () => {
    // Setup: load atlas first
    const mockImage = {
      width: 512,
      height: 512,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
    };

    vi.stubGlobal('Image', vi.fn(() => mockImage));

    const mockManifest: SpriteManifest = {
      frames: {
        'furniture_64_a_0_0': {
          frame: { x: 100, y: 200, w: 64, h: 64 },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 },
          sourceSize: { w: 64, h: 64 },
        },
      },
      meta: {
        image: 'furniture_atlas.png',
        format: 'RGBA8888',
        size: { w: 512, h: 512 },
      },
    };

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => mockManifest,
    })) as any;

    const loadPromise = cache.loadAtlas('chair', 'test://chair.png', 'test://chair.json');
    if (mockImage.onload) {
      mockImage.onload();
    }
    await loadPromise;

    // Test getFrame
    const frame = cache.getFrame('chair', 'furniture_64_a_0_0');

    expect(frame).not.toBeNull();
    expect(frame!.x).toBe(100);
    expect(frame!.y).toBe(200);
    expect(frame!.w).toBe(64);
    expect(frame!.h).toBe(64);
    expect(frame!.bitmap).toBeDefined();
  });

  it('getFrame returns null for unknown atlas name', () => {
    const frame = cache.getFrame('nonexistent', 'furniture_64_a_0_0');
    expect(frame).toBeNull();
  });

  it('getFrame returns null for unknown frame name', async () => {
    // Setup: load atlas with one frame
    const mockImage = {
      width: 512,
      height: 512,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
    };

    vi.stubGlobal('Image', vi.fn(() => mockImage));

    const mockManifest: SpriteManifest = {
      frames: {
        'furniture_64_a_0_0': {
          frame: { x: 0, y: 0, w: 64, h: 64 },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 },
          sourceSize: { w: 64, h: 64 },
        },
      },
      meta: {
        image: 'furniture_atlas.png',
        format: 'RGBA8888',
        size: { w: 512, h: 512 },
      },
    };

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => mockManifest,
    })) as any;

    const loadPromise = cache.loadAtlas('chair', 'test://chair.png', 'test://chair.json');
    if (mockImage.onload) {
      mockImage.onload();
    }
    await loadPromise;

    // Test with invalid frame name
    const frame = cache.getFrame('chair', 'nonexistent_frame');
    expect(frame).toBeNull();
  });

  it('dispose closes all ImageBitmaps and clears cache', async () => {
    // Setup: load atlas
    const mockImage = {
      width: 512,
      height: 512,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
    };

    vi.stubGlobal('Image', vi.fn(() => mockImage));

    const closeMock = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
      width: 512,
      height: 512,
      close: closeMock,
    })));

    const mockManifest: SpriteManifest = {
      frames: {
        'furniture_64_a_0_0': {
          frame: { x: 0, y: 0, w: 64, h: 64 },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 },
          sourceSize: { w: 64, h: 64 },
        },
      },
      meta: {
        image: 'furniture_atlas.png',
        format: 'RGBA8888',
        size: { w: 512, h: 512 },
      },
    };

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => mockManifest,
    })) as any;

    const loadPromise = cache.loadAtlas('chair', 'test://chair.png', 'test://chair.json');
    if (mockImage.onload) {
      mockImage.onload();
    }
    await loadPromise;

    // Call dispose
    cache.dispose();

    // Verify bitmap.close() was called
    expect(closeMock).toHaveBeenCalled();

    // Verify cache is cleared
    const frame = cache.getFrame('chair', 'furniture_64_a_0_0');
    expect(frame).toBeNull();
  });

  it('loadAtlas handles image load failure gracefully', async () => {
    const mockImage = {
      width: 512,
      height: 512,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
    };

    vi.stubGlobal('Image', vi.fn(() => mockImage));

    // Call loadAtlas
    const loadPromise = cache.loadAtlas('chair', 'test://chair.png', 'test://chair.json');

    // Trigger onerror
    if (mockImage.onerror) {
      mockImage.onerror();
    }

    // Expect Promise to reject
    await expect(loadPromise).rejects.toThrow('Failed to load image');
  });

  it('loadAtlas handles fetch JSON failure gracefully', async () => {
    const mockImage = {
      width: 512,
      height: 512,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
    };

    vi.stubGlobal('Image', vi.fn(() => mockImage));

    // Mock fetch to return 404
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
    })) as any;

    // Call loadAtlas
    const loadPromise = cache.loadAtlas('chair', 'test://chair.png', 'test://chair.json');

    // Trigger onload
    if (mockImage.onload) {
      mockImage.onload();
    }

    // Expect Promise to reject
    await expect(loadPromise).rejects.toThrow('Failed to fetch manifest');
  });

  it('multiple atlases can coexist in cache', async () => {
    // Mock Image constructor
    const mockImage1 = {
      width: 512,
      height: 512,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
    };

    const mockImage2 = {
      width: 256,
      height: 256,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
    };

    let imageCallCount = 0;
    vi.stubGlobal('Image', vi.fn(() => {
      imageCallCount++;
      return imageCallCount === 1 ? mockImage1 : mockImage2;
    }));

    // Mock manifests for two different atlases
    const mockManifest1: SpriteManifest = {
      frames: {
        'frame1': {
          frame: { x: 10, y: 10, w: 64, h: 64 },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 },
          sourceSize: { w: 64, h: 64 },
        },
      },
      meta: {
        image: 'atlas1.png',
        format: 'RGBA8888',
        size: { w: 512, h: 512 },
      },
    };

    const mockManifest2: SpriteManifest = {
      frames: {
        'frame2': {
          frame: { x: 20, y: 20, w: 32, h: 32 },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
          sourceSize: { w: 32, h: 32 },
        },
      },
      meta: {
        image: 'atlas2.png',
        format: 'RGBA8888',
        size: { w: 256, h: 256 },
      },
    };

    let fetchCallCount = 0;
    global.fetch = vi.fn(async () => {
      fetchCallCount++;
      return {
        ok: true,
        json: async () => (fetchCallCount === 1 ? mockManifest1 : mockManifest2),
      };
    }) as any;

    // Load atlas1
    const load1Promise = cache.loadAtlas('atlas1', 'test://atlas1.png', 'test://atlas1.json');
    if (mockImage1.onload) {
      mockImage1.onload();
    }
    await load1Promise;

    // Load atlas2
    const load2Promise = cache.loadAtlas('atlas2', 'test://atlas2.png', 'test://atlas2.json');
    if (mockImage2.onload) {
      mockImage2.onload();
    }
    await load2Promise;

    // Verify both atlases return correct frames
    const frame1 = cache.getFrame('atlas1', 'frame1');
    expect(frame1).not.toBeNull();
    expect(frame1!.x).toBe(10);
    expect(frame1!.y).toBe(10);

    const frame2 = cache.getFrame('atlas2', 'frame2');
    expect(frame2).not.toBeNull();
    expect(frame2!.x).toBe(20);
    expect(frame2!.y).toBe(20);

    // Verify no cross-contamination
    const frame1FromAtlas2 = cache.getFrame('atlas2', 'frame1');
    expect(frame1FromAtlas2).toBeNull();
  });
});
