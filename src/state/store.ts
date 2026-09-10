// src/state/store.ts
// Typed observable store built on zustand/vanilla (D005). M003/S04's hand-rolled
// listener/revision machinery is replaced by zustand; this thin wrapper preserves
// the small surface the domain stores and consumers use, and adds selector
// subscriptions. Subscribers receive the current value immediately (state-sync
// semantics, matching src/bus.ts) and again on change, so late subscribers never
// observe a stale store.
//
// Values are treated immutably: `set()` compares with Object.is and treats a
// referentially-equal value as a no-op (zustand skips notification for a
// same-reference replace), so `update()` may return `prev` to signal no change.

import { createStore as createZustandStore, type Mutate, type StoreApi } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';

export type Unsubscribe = () => void;
export type Listener<T> = (value: T) => void;

type Api<T> = Mutate<StoreApi<T>, [['zustand/subscribeWithSelector', never]]>;

export class Store<T> {
  private readonly api: Api<T>;

  constructor(initial: T) {
    this.api = createZustandStore<T>()(
      subscribeWithSelector<T>(() => initial),
    );
  }

  get(): T {
    return this.api.getState();
  }

  set(next: T): void {
    if (Object.is(next, this.api.getState())) return;
    this.api.setState(next, true);
  }

  update(updater: (prev: T) => T): void {
    this.set(updater(this.api.getState()));
  }

  /** Subscribe to the whole value; delivers the current value immediately. */
  subscribe(listener: Listener<T>): Unsubscribe {
    return this.api.subscribe((value: T) => value, listener, { fireImmediately: true });
  }

  /**
   * Subscribe to a derived slice; delivers the current selected value
   * immediately and then only fires when the selected value changes.
   */
  subscribeSelector<S>(selector: (value: T) => S, listener: (selected: S) => void): Unsubscribe {
    return this.api.subscribe(selector, listener, { fireImmediately: true });
  }
}

export function createStore<T>(initial: T): Store<T> {
  return new Store<T>(initial);
}
