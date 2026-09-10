// tests/store.test.ts
// Unit tests for the typed store primitive (zustand-backed, D005): get/set/update,
// state-sync subscribe, unsubscribe, no-op set, and selector subscriptions.

import { describe, it, expect } from 'vitest';
import { createStore } from '../src/state/store.js';

describe('store', () => {
  it('returns the initial value', () => {
    const store = createStore({ count: 0 });
    expect(store.get()).toEqual({ count: 0 });
  });

  it('set replaces the value and notifies subscribers', () => {
    const store = createStore(1);
    const seen: number[] = [];
    store.subscribe((v) => seen.push(v));
    store.set(2);
    expect(store.get()).toBe(2);
    expect(seen).toEqual([1, 2]);
  });

  it('update derives the next value from the previous one', () => {
    const store = createStore<{ n: number }>({ n: 1 });
    store.update((prev) => ({ n: prev.n + 1 }));
    expect(store.get()).toEqual({ n: 2 });
  });

  it('subscribe calls immediately with current state (state sync)', () => {
    const store = createStore('ready');
    const seen: string[] = [];
    store.subscribe((v) => seen.push(v));
    expect(seen).toEqual(['ready']);
  });

  it('unsubscribe stops further notifications', () => {
    const store = createStore(0);
    const seen: number[] = [];
    const unsubscribe = store.subscribe((v) => seen.push(v));
    store.set(1);
    unsubscribe();
    store.set(2);
    expect(seen).toEqual([0, 1]);
  });

  it('notifies every subscriber', () => {
    const store = createStore(0);
    const a: number[] = [];
    const b: number[] = [];
    store.subscribe((v) => a.push(v));
    store.subscribe((v) => b.push(v));
    store.set(9);
    expect(a).toEqual([0, 9]);
    expect(b).toEqual([0, 9]);
  });

  it('treats a referentially-equal set as a no-op', () => {
    const initial = { n: 1 };
    const store = createStore(initial);
    const seen: { n: number }[] = [];
    store.subscribe((v) => seen.push(v));
    store.set(initial);
    expect(seen).toEqual([initial]);
  });

  it('update that returns the previous value does not bump or notify', () => {
    const store = createStore({ n: 1 });
    const seen: { n: number }[] = [];
    store.subscribe((v) => seen.push(v));
    store.update((prev) => prev);
    expect(seen).toHaveLength(1);
  });

  it('subscribeSelector fires only when the selected slice changes', () => {
    const store = createStore({ a: 1, b: 1 });
    const seen: number[] = [];
    store.subscribeSelector((state) => state.a, (a) => seen.push(a));
    store.set({ a: 1, b: 2 });
    store.set({ a: 2, b: 2 });
    expect(seen).toEqual([1, 2]);
  });
});
