// src/render/layers.ts
// WorldLayer contract (M003/S03): a world-space cached layer with explicit
// invalidation inputs and a visible-slice blit. Formalizes the Q12/Q13 pattern
// (room buffer + kanban notes cache) into first-class objects owned by
// CanvasStage/RoomCanvas instead of scattered renderState fields.

import type { CameraState } from '../cameraController.js';
import type { TileGrid } from '../isoTypes.js';
import type { SpriteCache } from '../isoSpriteCache.js';
import { screenToWorld } from '../cameraController.js';

/** Cap world-layer DPR at 2 — pixel art gains nothing above, and blits stay cheap */
export function layerDpr(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

/**
 * Blit the visible slice of a world-space layer 1:1 under the camera transform
 * (avoids scaling the whole layer through the transform every frame).
 */
export function blitVisibleSlice(
  ctx: CanvasRenderingContext2D,
  layer: OffscreenCanvas | HTMLCanvasElement,
  layerSize: { w: number; h: number },
  cam: CameraState,
  canvasCssW: number,
  canvasCssH: number,
): void {
  const dpr = layerDpr();
  const tl = screenToWorld(0, 0, cam, canvasCssW, canvasCssH);
  const br = screenToWorld(canvasCssW, canvasCssH, cam, canvasCssW, canvasCssH);
  const sx = Math.max(0, Math.floor(tl.x));
  const sy = Math.max(0, Math.floor(tl.y));
  const ex = Math.min(layerSize.w, Math.ceil(br.x));
  const ey = Math.min(layerSize.h, Math.ceil(br.y));
  const sw = ex - sx;
  const sh = ey - sy;
  if (sw <= 0 || sh <= 0) return;
  ctx.drawImage(layer, sx * dpr, sy * dpr, sw * dpr, sh * dpr, sx, sy, sw, sh);
}

export interface WorldLayer<TInputs> {
  readonly name: string;
  readonly size: { w: number; h: number };
  /** True when the layer must re-render for these inputs */
  invalidated(inputs: TInputs): boolean;
  render(inputs: TInputs): void;
  readonly buffer: OffscreenCanvas | null;
}

type FurnitureRenderableFactory = (
  furniture: unknown,
  multiTileFurniture: unknown,
  spriteCache: SpriteCache,
  origin: { x: number; y: number },
) => unknown[];

export interface RoomLayerInputs {
  grid: TileGrid;
  canvasCssW: number;
  canvasCssH: number;
  /** Identity/version token: any change re-renders (tile colors, booth frames, layout) */
  version: string;
  tileColorMap: Map<string, unknown> | null;
  furniture: unknown[];
  multiTileFurniture: unknown[];
  spriteCache: SpriteCache | undefined;
}

export interface RoomLayerResult {
  origin: { x: number; y: number };
  furnitureRenderables: unknown[];
}

/** Room floor + walls pre-rendered into a buffer sized to the room's extent */
export class RoomLayer implements WorldLayer<RoomLayerInputs> {
  readonly name = 'room';
  private buf: OffscreenCanvas | null = null;
  private layerSize = { w: 0, h: 0 };
  private key = '';

  constructor(
    private readonly computeBounds: (grid: TileGrid) => { roomW: number; roomH: number },
    private readonly computeOrigin: (grid: TileGrid, w: number, h: number) => { x: number; y: number },
    private readonly preRender: (
      grid: TileGrid,
      origin: { x: number; y: number },
      physicalW: number,
      physicalH: number,
      dpr: number,
      tileColorMap: Map<string, unknown> | null,
    ) => OffscreenCanvas,
    private readonly createFurnitureRenderables: FurnitureRenderableFactory,
  ) {}

  get buffer(): OffscreenCanvas | null {
    return this.buf;
  }

  get size(): { w: number; h: number } {
    return this.layerSize;
  }

  invalidated(inputs: RoomLayerInputs): boolean {
    const key = `${inputs.canvasCssW}x${inputs.canvasCssH}|${inputs.version}`;
    return key !== this.key;
  }

  render(inputs: RoomLayerInputs): RoomLayerResult {
    const dpr = layerDpr();
    const PAD = 48;
    const { roomW, roomH } = this.computeBounds(inputs.grid);
    const bufferCssW = Math.max(inputs.canvasCssW, Math.ceil(roomW) + PAD);
    const bufferCssH = Math.max(inputs.canvasCssH, Math.ceil(roomH) + PAD);
    const origin = this.computeOrigin(inputs.grid, bufferCssW, bufferCssH);

    this.layerSize = { w: bufferCssW, h: bufferCssH };
    this.key = `${inputs.canvasCssW}x${inputs.canvasCssH}|${inputs.version}`;
    this.buf = this.preRender(
      inputs.grid,
      origin,
      Math.floor(bufferCssW * dpr),
      Math.floor(bufferCssH * dpr),
      dpr,
      inputs.tileColorMap,
    );

    const furnitureRenderables = inputs.spriteCache
      ? (this.createFurnitureRenderables(
          inputs.furniture,
          inputs.multiTileFurniture,
          inputs.spriteCache,
          origin,
        ) as unknown[])
      : [];

    return { origin, furnitureRenderables };
  }
}

export interface NotesLayerInputs {
  /** Everything the notes cache depends on, already serialized to a signature */
  signature: string;
  /** Callback that renders the notes into a fresh offscreen context */
  draw: (
    ctx: OffscreenCanvasRenderingContext2D,
    size: { w: number; h: number },
    dpr: number,
  ) => void;
  /** Layer must cover at least this world area */
  size: { w: number; h: number };
}

/** Kanban sticky notes cached in a world-space layer, rebuilt on input change */
export class NotesLayer implements WorldLayer<NotesLayerInputs> {
  readonly name = 'notes';
  private buf: OffscreenCanvas | null = null;
  private layerSize = { w: 0, h: 0 };
  private key = '';

  get buffer(): OffscreenCanvas | null {
    return this.buf;
  }

  get size(): { w: number; h: number } {
    return this.layerSize;
  }

  invalidated(inputs: NotesLayerInputs): boolean {
    return inputs.signature !== this.key;
  }

  render(inputs: NotesLayerInputs): void {
    const dpr = layerDpr();
    this.layerSize = { ...inputs.size };
    this.key = inputs.signature;
    const buffer = new OffscreenCanvas(
      Math.floor(inputs.size.w * dpr),
      Math.floor(inputs.size.h * dpr),
    );
    const ctx = buffer.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    inputs.draw(ctx, inputs.size, dpr);
    this.buf = buffer;
  }
}
