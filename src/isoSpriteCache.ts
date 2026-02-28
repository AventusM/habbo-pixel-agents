// src/isoSpriteCache.ts
// Sprite cache abstraction for loading PNG atlases as ImageBitmap objects

/**
 * Texture Packer JSON Hash format
 * Verified in 03-RESEARCH.md
 */
export interface SpriteManifest {
  frames: Record<string, {
    frame: { x: number; y: number; w: number; h: number };
    rotated: boolean;
    trimmed: boolean;
    spriteSourceSize: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
  }>;
  meta: {
    image: string;
    format: string;
    size: { w: number; h: number };
  };
}

/**
 * Frame lookup return type
 */
export interface SpriteFrame {
  bitmap: ImageBitmap;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * SpriteCache class - loads PNG atlases as GPU-accelerated ImageBitmap objects
 * and provides O(1) frame lookup API
 */
export class SpriteCache {
  private bitmaps: Map<string, ImageBitmap> = new Map();
  private manifests: Map<string, SpriteManifest> = new Map();

  /**
   * Load PNG atlas and JSON manifest into cache
   * @param atlasName - Unique identifier for this atlas
   * @param pngUri - URI to PNG atlas image
   * @param jsonUri - URI to Texture Packer JSON manifest
   */
  async loadAtlas(atlasName: string, pngUri: string, jsonUri: string): Promise<void> {
    // Load PNG as HTMLImageElement
    const img = new Image();
    const imageLoadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${pngUri}`));
    });
    img.src = pngUri;

    await imageLoadPromise;

    // GPU pre-decode: createImageBitmap after load
    const bitmap = await createImageBitmap(img);
    this.bitmaps.set(atlasName, bitmap);

    // Fetch JSON manifest
    const response = await fetch(jsonUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${jsonUri} (${response.status})`);
    }
    const manifest: SpriteManifest = await response.json();
    this.manifests.set(atlasName, manifest);
  }

  /**
   * Get frame coordinates from atlas
   * @param atlasName - Atlas identifier
   * @param frameName - Frame name from manifest (e.g., "furniture_64_a_0_0")
   * @returns SpriteFrame with bitmap and coordinates, or null if not found
   */
  getFrame(atlasName: string, frameName: string): SpriteFrame | null {
    const bitmap = this.bitmaps.get(atlasName);
    const manifest = this.manifests.get(atlasName);

    // Graceful degradation if atlas not loaded
    if (!bitmap || !manifest) {
      return null;
    }

    // Look up frame in manifest
    const frameData = manifest.frames[frameName];
    if (!frameData) {
      return null;
    }

    // Return SpriteFrame object
    return {
      bitmap,
      x: frameData.frame.x,
      y: frameData.frame.y,
      w: frameData.frame.w,
      h: frameData.frame.h,
    };
  }

  /**
   * Free GPU memory and clear cache
   */
  dispose(): void {
    // Close all ImageBitmaps to free GPU memory
    for (const bitmap of this.bitmaps.values()) {
      bitmap.close();
    }

    // Clear Maps
    this.bitmaps.clear();
    this.manifests.clear();
  }
}
