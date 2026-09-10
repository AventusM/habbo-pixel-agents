// tests/cameraStore.test.ts
// Unit tests for the camera store: reset must preserve the live mutable
// object identity that consumers (e.g. CanvasStage.camera) capture via get().

import { describe, it, expect } from 'vitest';
import { CameraStore } from '../src/state/cameraStore.js';

describe('cameraStore', () => {
  it('reset overwrites fields in place, preserving object identity', () => {
    const store = new CameraStore();
    const before = store.get();
    before.panX = 120;
    before.zoom = 1.8;

    let notified: unknown = null;
    store.subscribe((camera) => {
      notified = camera;
    });

    store.reset();

    expect(store.get()).toBe(before);
    expect(store.get().panX).toBe(0);
    expect(store.get().zoom).toBe(1.0);
    expect(notified).toBe(before);
  });
});
