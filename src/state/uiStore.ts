// src/state/uiStore.ts
// Session UI flags store (M008/S03, D021): dev mode and audio readiness behind
// one observable state object built on createStore, the same pattern as
// appMode.ts. These flags previously lived as a React-state mirror and inferred
// ref state inside the shell; the store is now their single source of truth and
// consumers read them through useStoreValue.
import { createStore, type Store, type Unsubscribe } from './store.js';

export interface UiState {
  devMode: boolean;
  audioReady: boolean;
}

export const selectDevMode = (state: UiState): boolean => state.devMode;
export const selectAudioReady = (state: UiState): boolean => state.audioReady;

export class UiStore {
  private readonly store: Store<UiState> = createStore<UiState>({
    devMode: false,
    audioReady: false,
  });

  get(): UiState {
    return this.store.get();
  }

  get devMode(): boolean {
    return this.store.get().devMode;
  }

  get audioReady(): boolean {
    return this.store.get().audioReady;
  }

  subscribe(listener: (state: UiState) => void): Unsubscribe {
    return this.store.subscribe(listener);
  }

  subscribeSelector<S>(
    selector: (state: UiState) => S,
    listener: (selected: S) => void,
  ): Unsubscribe {
    return this.store.subscribeSelector(selector, listener);
  }

  /** No-op when the value is unchanged (store.set compares with Object.is). */
  setDevMode(devMode: boolean): void {
    this.store.update((prev) => (prev.devMode === devMode ? prev : { ...prev, devMode }));
  }

  /** No-op when the value is unchanged (store.set compares with Object.is). */
  setAudioReady(audioReady: boolean): void {
    this.store.update((prev) => (prev.audioReady === audioReady ? prev : { ...prev, audioReady }));
  }

  reset(): void {
    this.store.set({ devMode: false, audioReady: false });
  }
}

export const uiStore = new UiStore();
