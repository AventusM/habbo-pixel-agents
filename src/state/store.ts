// src/state/store.ts
// Minimal typed observable store (M003/S04): get/set/update plus subscribe with
// a monotonically increasing version. Subscribers receive the current value
// immediately (state-sync semantics, matching src/bus.ts) and again on change,
// so late subscribers never observe a stale store.

export type Unsubscribe = () => void;
export type Listener<T> = (value: T) => void;

export class Store<T> {
  private value: T;
  private readonly listeners = new Set<Listener<T>>();
  private revision = 0;

  constructor(initial: T) {
    this.value = initial;
  }

  get(): T {
    return this.value;
  }

  get version(): number {
    return this.revision;
  }

  set(next: T): void {
    this.value = next;
    this.revision++;
    for (const listener of [...this.listeners]) listener(this.value);
  }

  update(updater: (prev: T) => T): void {
    this.set(updater(this.value));
  }

  subscribe(listener: Listener<T>): Unsubscribe {
    this.listeners.add(listener);
    listener(this.value);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export function createStore<T>(initial: T): Store<T> {
  return new Store<T>(initial);
}
