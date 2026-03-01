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
 * Nitro unbundled asset data (per-item JSON)
 * Contains spritesheet frames, asset offsets, visualization, and logic metadata
 */
export interface NitroAssetData {
  name: string;
  type: string;
  spritesheet: SpriteManifest;
  assets: Record<string, { x: number; y: number; source?: string | null; flipH?: boolean }>;
  visualization: { layerCount: number; directions: Record<string, any> };
  logic: { dimensions: [number, number, number]; directions: number[] };
}

/**
 * Nitro frame lookup return type (includes asset offsets)
 */
export interface NitroSpriteFrame extends SpriteFrame {
  offsetX: number;
  offsetY: number;
  flipH: boolean;
}

/**
 * SpriteCache class - loads PNG atlases as GPU-accelerated ImageBitmap objects
 * and provides O(1) frame lookup API
 */
export class SpriteCache {
  private bitmaps: Map<string, ImageBitmap> = new Map();
  private manifests: Map<string, SpriteManifest> = new Map();
  private nitroAssets: Map<string, NitroAssetData> = new Map();

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
   * Load a Nitro unbundled asset (per-item PNG + combined JSON)
   * @param name - Asset name (e.g., "rare_dragonlamp")
   * @param pngUri - URI to the item's PNG spritesheet
   * @param jsonUri - URI to the item's combined Nitro JSON
   */
  async loadNitroAsset(name: string, pngUri: string, jsonUri: string): Promise<void> {
    // Load PNG as ImageBitmap
    const img = new Image();
    const imageLoadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load Nitro image: ${pngUri}`));
    });
    img.src = pngUri;
    await imageLoadPromise;

    const bitmap = await createImageBitmap(img);
    this.bitmaps.set(`nitro:${name}`, bitmap);

    // Fetch combined Nitro JSON
    const response = await fetch(jsonUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch Nitro JSON: ${jsonUri} (${response.status})`);
    }
    const data: NitroAssetData = await response.json();
    this.nitroAssets.set(name, data);

    // Also store the spritesheet manifest for getFrame() compatibility
    this.manifests.set(`nitro:${name}`, data.spritesheet);
  }

  /**
   * Get a Nitro sprite frame with asset offsets
   * @param assetName - Nitro asset name
   * @param frameName - Frame key (e.g., "rare_dragonlamp_64_a_0_0")
   * @returns NitroSpriteFrame with bitmap, coordinates, and offsets
   */
  getNitroFrame(assetName: string, frameName: string): NitroSpriteFrame | null {
    const bitmap = this.bitmaps.get(`nitro:${assetName}`);
    const nitroData = this.nitroAssets.get(assetName);

    if (!bitmap || !nitroData) {
      return null;
    }

    // Look up asset offsets from the original frame name
    const assetData = nitroData.assets[frameName];
    const offsetX = assetData ? assetData.x : 0;
    const offsetY = assetData ? assetData.y : 0;
    const flipH = assetData ? (assetData.flipH ?? false) : false;

    // Look up frame in spritesheet — follow source chain if not found directly (max 3 hops)
    let resolvedName = frameName;
    let frameData = nitroData.spritesheet.frames[resolvedName];

    if (!frameData) {
      // Follow source references to find sprite data
      let current = resolvedName;
      for (let i = 0; i < 3 && !frameData; i++) {
        const ref = nitroData.assets[current];
        if (!ref?.source) break;
        current = ref.source;
        frameData = nitroData.spritesheet.frames[current];
      }
    }

    if (!frameData) {
      return null;
    }

    return {
      bitmap,
      x: frameData.frame.x,
      y: frameData.frame.y,
      w: frameData.frame.w,
      h: frameData.frame.h,
      offsetX,
      offsetY,
      flipH,
    };
  }

  /**
   * Get Nitro asset metadata (visualization, logic, dimensions)
   * @param assetName - Nitro asset name
   * @returns NitroAssetData or null if not loaded
   */
  getNitroMetadata(assetName: string): NitroAssetData | null {
    return this.nitroAssets.get(assetName) ?? null;
  }

  /**
   * Check if a Nitro asset is loaded
   * @param assetName - Nitro asset name
   */
  hasNitroAsset(assetName: string): boolean {
    return this.nitroAssets.has(assetName);
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
    this.nitroAssets.clear();
  }
}
