// tests/store-wiring.test.ts
// M008/S03 — locks the store-wiring refactor.
//
// The store is the single source of truth for the values S03 rewired: the kanban
// filter, dev mode and audio readiness. These tests are source-level + store-level
// (the suite runs in the `node` environment with no react-test-renderer), and they
// pin the contracts:
//   1. useStoreValue reads through the store: `selector(store.get())` always
//      reflects the latest store value and it subscribes via subscribeSelector.
//   2. The hooks/components hold no React-state mirror of a store value.
//   3. Audio readiness is written to uiStore only after initialization succeeds.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createStore } from '../src/state/store.js';
import { kanbanStore } from '../src/state/kanbanStore.js';
import { UiStore } from '../src/state/uiStore.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');

describe('useStoreValue read-through contract', () => {
  it('selector(store.get()) reflects the latest store value', () => {
    const store = createStore<{ filter: string }>({ filter: 'all' });
    const selector = (s: { filter: string }): string => s.filter;
    expect(selector(store.get())).toBe('all');
    store.set({ filter: 'gsd' });
    expect(selector(store.get())).toBe('gsd');
  });

  it('reads kanbanStore through get()', () => {
    kanbanStore.setFilter('gsd');
    expect(kanbanStore.get().filter).toBe('gsd');
    kanbanStore.reset();
    expect(kanbanStore.get().filter).toBe('all');
  });

  it('useStoreValue is built on useSyncExternalStore + subscribeSelector + store.get()', () => {
    const src = read('hooks/useStoreValue.ts');
    expect(src).toContain('useSyncExternalStore');
    expect(src).toContain('store.subscribeSelector');
    expect(src).toContain('selector(store.get())');
  });
});

describe('kanban filter mirror removal', () => {
  it('useKanbanFilter has no React state mirror', () => {
    const src = read('hooks/useKanbanFilter.ts');
    expect(src).not.toMatch(/\buseState\b/);
    expect(src).not.toMatch(/\buseEffect\b/);
    expect(src).toContain('useStoreValue');
    expect(src).toContain('kanbanStore');
  });
});

describe('dev mode mirror removal', () => {
  it('RoomCanvas holds no devMode React state and reads it from uiStore', () => {
    const src = read('RoomCanvas.tsx');
    expect(src).not.toMatch(/\[\s*devMode\s*,\s*setDevMode\s*\]/);
    expect(src).toContain('useStoreValue(uiStore, selectDevMode)');
  });

  it('the message dispatcher writes devMode through uiStore', () => {
    const src = read('hooks/useRoomMessages.ts');
    expect(src).toContain('uiStore.setDevMode');
  });
});

describe('audio readiness store path', () => {
  it('useRoomAudio marks readiness only after init succeeds and reads it via the store', () => {
    const src = read('hooks/useRoomAudio.ts');
    const initIdx = src.indexOf('await managerRef.current.init()');
    const readyIdx = src.indexOf('uiStore.setAudioReady(true)');
    expect(initIdx).toBeGreaterThan(-1);
    expect(readyIdx).toBeGreaterThan(initIdx);
    expect(src).toContain('useStoreValue(uiStore, selectAudioReady)');
  });

  it('flips audio readiness and notifies only on change', () => {
    const store = new UiStore();
    const seen: boolean[] = [];
    store.subscribeSelector((s) => s.audioReady, (v) => seen.push(v));
    expect(seen).toEqual([false]);
    store.setAudioReady(true);
    expect(seen).toEqual([false, true]);
    store.setAudioReady(true);
    expect(seen).toEqual([false, true]);
    expect(store.audioReady).toBe(true);
  });
});
