// src/render/CanvasStage.ts
// CanvasStage (M003/S03): owns the room canvas lifecycle — backing-store
// init/resize, camera state (pan/zoom), pointer/wheel/touch input, the rAF
// frame loop, the frame scheduler, and the WorldLayer buffers. RoomCanvas
// instantiates it and keeps heightmap/agent/kanban data wiring plus the draw
// pipeline (src/render/sceneRenderer.ts).

import {
  applyZoom,
  setZoomWithPivot,
  type CameraState,
} from '../cameraController.js';
import { cameraStore } from '../state/cameraStore.js';
import { computeCameraOrigin, createFurnitureRenderables, initCanvas, preRenderRoom } from '../isoTileRenderer.js';
import { computeRoomBounds } from './roomBounds.js';
import type { HsbColor } from '../isoTypes.js';
import {
  NotesLayer,
  RoomLayer,
  type NotesLayerInputs,
  type RoomLayerInputs,
  type RoomLayerResult,
} from './layers.js';

export interface StageStats {
  /** Frames drawn to the canvas. */
  renders: number;
  /** Frames skipped by the static-scene throttle. */
  skips: number;
  /** Timestamp (ms) of the last drawn frame. */
  lastRenderAt: number;
}

export interface StageHooks {
  /** Whether this pointerdown should begin a camera pan drag. */
  canDrag: (event: MouseEvent) => boolean;
  /** Pointer moved over the canvas (canvas-relative CSS pixels). */
  onHover: (clientX: number, clientY: number) => void;
  /** Pointer left the canvas. */
  onHoverEnd: () => void;
  /** Debounced window resize settled; re-render/recenter. */
  onResize: () => void;
}

export type TickCallback = (nowMs: number) => boolean;
export type DrawCallback = (nowMs: number) => void;

/**
 * Static-scene cadence: 50ms (Q13). Immediate frames while the camera moves or
 * the scene is dynamic.
 */
const STATIC_INTERVAL_MS = 50;
const RESIZE_DEBOUNCE_MS = 150;

export class CanvasStage {
  readonly camera: CameraState = cameraStore.get();
  readonly roomLayer: RoomLayer;
  readonly notesLayer = new NotesLayer();

  private ctx: CanvasRenderingContext2D | null = null;
  private running = false;
  private rafId = 0;
  private tick: TickCallback | null = null;
  private draw: DrawCallback | null = null;

  private lastRenderTime = 0;
  private lastCam = { panX: NaN, panY: NaN, zoom: NaN };
  private stats: StageStats = { renders: 0, skips: 0, lastRenderAt: 0 };
  private invalidated = false;

  private drag = {
    isDragging: false,
    didDrag: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  };

  private removeListeners: Array<() => void> = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hooks: StageHooks,
  ) {
    this.roomLayer = new RoomLayer(
      computeRoomBounds,
      computeCameraOrigin,
      (grid, origin, physicalW, physicalH, dpr, tileColorMap) =>
        preRenderRoom(
          grid,
          origin,
          physicalW,
          physicalH,
          dpr,
          undefined,
          undefined,
          undefined,
          undefined,
          'furniture',
          tileColorMap as Map<string, HsbColor> | undefined,
        ),
      createFurnitureRenderables as unknown as ConstructorParameters<typeof RoomLayer>[3],
    );
    // Expose a dev accessor for render/skip counters (O-4).
    (window as unknown as { __canvasStage?: CanvasStage }).__canvasStage = this;
  }

  get context(): CanvasRenderingContext2D | null {
    return this.ctx;
  }

  get didDrag(): boolean {
    return this.drag.didDrag;
  }

  clearDidDrag(): void {
    this.drag.didDrag = false;
  }

  getStats(): StageStats {
    return { ...this.stats };
  }

  /**
   * Request a frame without waiting out the static-scene throttle. Store
   * subscribers call this so state changes (cards, agents, mode) render on the
   * next rAF instead of up to STATIC_INTERVAL_MS later.
   */
  invalidate(): void {
    this.invalidated = true;
  }

  /** (Re)initialize the backing store. Returns the 2D context. */
  init(): CanvasRenderingContext2D {
    this.ctx = initCanvas(this.canvas);
    return this.ctx;
  }

  renderRoom(inputs: RoomLayerInputs): RoomLayerResult {
    return this.roomLayer.render(inputs);
  }

  /** Ensure the notes layer matches the signature; render when invalidated. */
  ensureNotes(
    signature: string,
    size: { w: number; h: number },
    draw: NotesLayerInputs['draw'],
  ): { buffer: OffscreenCanvas | null; size: { w: number; h: number } } {
    const probe: NotesLayerInputs = { signature, size, draw };
    if (this.notesLayer.invalidated(probe)) {
      this.notesLayer.render(probe);
    }
    return { buffer: this.notesLayer.buffer, size: this.notesLayer.size };
  }

  /** Start the rAF loop. `onTick` runs business logic; `onDraw` draws. */
  start(onTick: TickCallback, onDraw: DrawCallback): void {
    this.tick = onTick;
    this.draw = onDraw;
    this.running = true;
    this.attachListeners();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    for (const remove of this.removeListeners) remove();
    this.removeListeners = [];
  }

  private frame = (): void => {
    if (!this.running) return;

    const nowMs = Date.now();
    const dynamic = (this.tick ? this.tick(nowMs) : false) || this.invalidated;
    this.invalidated = false;

    const cam = this.camera;
    const camChanged =
      cam.panX !== this.lastCam.panX ||
      cam.panY !== this.lastCam.panY ||
      cam.zoom !== this.lastCam.zoom;
    const interval = camChanged || dynamic ? 0 : STATIC_INTERVAL_MS;

    if (nowMs - this.lastRenderTime < interval) {
      this.stats.skips++;
      this.rafId = requestAnimationFrame(this.frame);
      return;
    }

    this.lastRenderTime = nowMs;
    this.lastCam = { panX: cam.panX, panY: cam.panY, zoom: cam.zoom };
    this.stats.renders++;
    this.stats.lastRenderAt = nowMs;
    if (this.draw) this.draw(nowMs);

    this.rafId = requestAnimationFrame(this.frame);
  };

  private attachListeners(): void {
    const canvas = this.canvas;

    const onMouseDown = (e: MouseEvent) => {
      if (!this.hooks.canDrag(e)) return;
      this.drag.isDragging = true;
      this.drag.didDrag = false;
      this.drag.startX = e.clientX;
      this.drag.startY = e.clientY;
      this.drag.startPanX = this.camera.panX;
      this.drag.startPanY = this.camera.panY;
    };

    const onMouseMove = (e: MouseEvent) => {
      const drag = this.drag;
      if (drag.isDragging) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 5) {
          drag.didDrag = true;
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.offsetWidth / rect.width;
          const scaleY = canvas.offsetHeight / rect.height;
          this.camera.panX = drag.startPanX + (dx * scaleX) / this.camera.zoom;
          this.camera.panY = drag.startPanY + (dy * scaleY) / this.camera.zoom;
          cameraStore.notify();
        }
      }
      this.hooks.onHover(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      this.drag.isDragging = false;
    };

    const onMouseLeave = () => {
      this.drag.isDragging = false;
      this.hooks.onHoverEnd();
    };

    // Wheel: non-passive so preventDefault() works (React's onWheel is passive).
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.offsetWidth / rect.width;
      const scaleY = canvas.offsetHeight / rect.height;
      const pivotX = (e.clientX - rect.left) * scaleX;
      const pivotY = (e.clientY - rect.top) * scaleY;
      applyZoom(this.camera, e.deltaY, pivotX, pivotY, canvas.offsetWidth, canvas.offsetHeight);
      cameraStore.notify();
    };

    // Touch: 1-finger pan, 2-finger pinch zoom.
    let panStart: { x: number; y: number; panX: number; panY: number } | null = null;
    let pinchStart: { dist: number; zoom: number; midX: number; midY: number } | null = null;

    const canvasPoint = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (canvas.offsetWidth / rect.width),
        y: (clientY - rect.top) * (canvas.offsetHeight / rect.height),
      };
    };
    const touchDist = (t: Touch[]) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const touchMid = (t: Touch[]) => canvasPoint(
      (t[0].clientX + t[1].clientX) / 2,
      (t[0].clientY + t[1].clientY) / 2,
    );

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const p = canvasPoint(t.clientX, t.clientY);
        panStart = { x: p.x, y: p.y, panX: this.camera.panX, panY: this.camera.panY };
        pinchStart = null;
      } else if (e.touches.length === 2) {
        panStart = null;
        pinchStart = {
          dist: touchDist(Array.from(e.touches)),
          zoom: this.camera.zoom,
          midX: touchMid(Array.from(e.touches)).x,
          midY: touchMid(Array.from(e.touches)).y,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const cam = this.camera;
      if (e.touches.length === 2 && pinchStart) {
        const dist = touchDist(Array.from(e.touches));
        const mid = touchMid(Array.from(e.touches));
        const target = pinchStart.zoom * (dist / Math.max(1, pinchStart.dist));
        setZoomWithPivot(cam, target, pinchStart.midX, pinchStart.midY, canvas.offsetWidth, canvas.offsetHeight);
        cameraStore.notify();
      } else if (e.touches.length === 1 && panStart) {
        const t = e.touches[0];
        const p = canvasPoint(t.clientX, t.clientY);
        cam.panX = panStart.panX + (p.x - panStart.x);
        cam.panY = panStart.panY + (p.y - panStart.y);
        cameraStore.notify();
      }
    };

    const onTouchEnd = () => {
      panStart = null;
      pinchStart = null;
    };

    // Window resize: re-init the backing store, then let RoomCanvas re-render
    // the room buffer and recenter.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        this.init();
        this.hooks.onResize();
      }, RESIZE_DEBOUNCE_MS);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('resize', onResize);

    this.removeListeners = [
      () => canvas.removeEventListener('mousedown', onMouseDown),
      () => canvas.removeEventListener('mousemove', onMouseMove),
      () => canvas.removeEventListener('mouseup', onMouseUp),
      () => canvas.removeEventListener('mouseleave', onMouseLeave),
      () => canvas.removeEventListener('wheel', onWheel),
      () => canvas.removeEventListener('touchstart', onTouchStart),
      () => canvas.removeEventListener('touchmove', onTouchMove),
      () => canvas.removeEventListener('touchend', onTouchEnd),
      () => canvas.removeEventListener('touchcancel', onTouchEnd),
      () => window.removeEventListener('resize', onResize),
      () => {
        if (timer) clearTimeout(timer);
      },
    ];
  }
}
