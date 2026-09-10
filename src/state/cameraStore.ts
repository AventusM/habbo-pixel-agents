// src/state/cameraStore.ts
// Typed camera store (M003/S04, zustand-backed per D005): owns the pan/zoom
// CameraState. CanvasStage exposes this live object as its `camera`; write sites
// call notify() so subscribers (the frame scheduler) can invalidate immediately
// instead of waiting out the static-scene throttle.

import { createCameraState, type CameraState } from '../cameraController.js';
import { createStore, type Store, type Unsubscribe } from './store.js';

export type CameraListener = (camera: CameraState) => void;

interface CameraStoreState {
  camera: CameraState;
  revision: number;
}

export class CameraStore {
  private readonly store: Store<CameraStoreState> = createStore<CameraStoreState>({
    camera: createCameraState(),
    revision: 0,
  });

  get(): CameraState {
    return this.store.get().camera;
  }

  subscribe(listener: CameraListener): Unsubscribe {
    return this.store.subscribeSelector((state) => state.revision, () => listener(this.get()));
  }

  /** Signal that the camera fields changed in place. */
  notify(): void {
    this.store.set({ camera: this.get(), revision: this.store.get().revision + 1 });
  }

  reset(): void {
    // Preserve object identity: consumers (e.g. CanvasStage.camera) hold a
    // reference from get(), so overwrite the fields in place instead of
    // replacing the object and stranding those references on a stale copy.
    Object.assign(this.get(), createCameraState());
    this.notify();
  }
}

export const cameraStore = new CameraStore();
