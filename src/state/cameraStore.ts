// src/state/cameraStore.ts
// Typed camera store (M003/S04): owns the pan/zoom CameraState. CanvasStage
// exposes this live object as its `camera`; write sites call notify() so
// subscribers (the frame scheduler) can invalidate immediately instead of
// waiting out the static-scene throttle.

import { createCameraState, type CameraState } from '../cameraController.js';
import type { Unsubscribe } from './store.js';

export type CameraListener = (camera: CameraState) => void;

export class CameraStore {
  private camera: CameraState = createCameraState();
  private readonly listeners = new Set<CameraListener>();

  get(): CameraState {
    return this.camera;
  }

  subscribe(listener: CameraListener): Unsubscribe {
    this.listeners.add(listener);
    listener(this.camera);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Signal that the camera fields changed in place. */
  notify(): void {
    for (const listener of [...this.listeners]) listener(this.camera);
  }

  reset(): void {
    // Preserve object identity: consumers (e.g. CanvasStage.camera) hold a
    // reference from get(), so overwrite the fields in place instead of
    // replacing the object and stranding those references on a stale copy.
    Object.assign(this.camera, createCameraState());
    this.notify();
  }
}

export const cameraStore = new CameraStore();
