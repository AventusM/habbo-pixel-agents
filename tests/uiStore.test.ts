// tests/uiStore.test.ts
// M008/S03 — session UI flags store semantics: defaults, setters, subscriber
// delivery (current value immediately, then on change) and no-op on same value.

import { describe, it, expect, beforeEach } from 'vitest';
import { UiStore, uiStore } from '../src/state/uiStore.js';

describe('uiStore', () => {
  let store: UiStore;

  beforeEach(() => {
    store = new UiStore();
  });

  it('starts with dev mode and audio readiness off', () => {
    expect(store.get()).toEqual({ devMode: false, audioReady: false });
  });

  it('sets dev mode', () => {
    store.setDevMode(true);
    expect(store.devMode).toBe(true);
  });

  it('sets audio readiness', () => {
    store.setAudioReady(true);
    expect(store.audioReady).toBe(true);
  });

  it('delivers the current value to a new subscriber then fires on change', () => {
    store.setDevMode(true);
    const seen: boolean[] = [];
    store.subscribeSelector((s) => s.devMode, (v) => seen.push(v));
    expect(seen).toEqual([true]);
    store.setDevMode(false);
    expect(seen).toEqual([true, false]);
  });

  it('is a no-op with no notification when the value is unchanged', () => {
    const seen: boolean[] = [];
    store.subscribeSelector((s) => s.devMode, (v) => seen.push(v));
    seen.length = 0;
    store.setDevMode(false);
    expect(seen).toEqual([]);
    expect(store.devMode).toBe(false);
  });

  it('resets both flags', () => {
    store.setDevMode(true);
    store.setAudioReady(true);
    store.reset();
    expect(store.get()).toEqual({ devMode: false, audioReady: false });
  });

  it('exposes the shared singleton in its default state', () => {
    uiStore.reset();
    expect(uiStore.get()).toEqual({ devMode: false, audioReady: false });
  });
});
