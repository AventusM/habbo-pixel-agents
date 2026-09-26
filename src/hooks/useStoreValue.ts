// src/hooks/useStoreValue.ts
// The single React read path for src/state store values (M008/S03, D021).
//
// A store is the source of truth; the component only renders. This hook bridges
// a store slice into React with `useSyncExternalStore`: `subscribe` delegates to
// the store's `subscribeSelector` (which delivers the current value immediately,
// so a late subscriber never observes a stale value) and `getSnapshot` reads
// `selector(store.get())`, so there is never a separate React-state copy of a
// store value.
//
// `selector` must be stable — define it at module scope or wrap it in
// `useCallback` — so the subscription and snapshot are not re-created on every
// render. Selectors should return primitives or stable store references; a
// selector that builds a new object every call would make getSnapshot unstable.

import { useCallback, useSyncExternalStore } from 'react';

/** Minimal structural surface of a `src/state/store.js` store used for reading. */
export interface StoreLike<T> {
  get(): T;
  subscribeSelector<S>(selector: (value: T) => S, listener: (selected: S) => void): () => void;
}

export function useStoreValue<T, S>(store: StoreLike<T>, selector: (value: T) => S): S {
  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribeSelector(selector, onStoreChange),
    [store, selector],
  );
  const getSnapshot = useCallback(() => selector(store.get()), [store, selector]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
