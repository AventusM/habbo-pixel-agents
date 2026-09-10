// src/state/appMode.ts
// Explicit demo/live mode machine (M003/S04): booting -> live | demo | degraded.
// Replaces the ad-hoc `isDemoMode` boolean and the 5s fallback side effect with
// named, logged transitions that other modules react to.

import { createStore, type Store, type Unsubscribe } from './store.js';

export type AppMode = 'booting' | 'live' | 'demo' | 'degraded';

export interface ModeTransition {
  from: AppMode;
  to: AppMode;
  reason: string;
  at: number;
}

export interface AppModeState {
  mode: AppMode;
  transitions: ModeTransition[];
}

/** Allowed transitions per current mode. Self-transitions are always ignored. */
export const MODE_TRANSITIONS: Record<AppMode, AppMode[]> = {
  booting: ['live', 'demo', 'degraded'],
  live: ['degraded', 'demo'],
  degraded: ['live', 'demo'],
  demo: ['live', 'degraded'],
};

export function isValidModeTransition(from: AppMode, to: AppMode): boolean {
  if (from === to) return false;
  return MODE_TRANSITIONS[from].includes(to);
}

export class AppModeMachine {
  private readonly store: Store<AppModeState> = createStore<AppModeState>({
    mode: 'booting',
    transitions: [],
  });

  get mode(): AppMode {
    return this.store.get().mode;
  }

  get state(): AppModeState {
    return this.store.get();
  }

  is(mode: AppMode): boolean {
    return this.mode === mode;
  }

  subscribe(listener: (state: AppModeState) => void): Unsubscribe {
    return this.store.subscribe(listener);
  }

  /**
   * Apply a named transition. Returns true when the mode changed; invalid
   * transitions and no-ops are ignored (and logged).
   */
  transition(to: AppMode, reason: string, now = Date.now()): boolean {
    const current = this.store.get();
    if (current.mode === to) return false;
    if (!isValidModeTransition(current.mode, to)) {
      console.warn(`[Mode] Ignored invalid transition ${current.mode} -> ${to} (${reason})`);
      return false;
    }
    const transition: ModeTransition = { from: current.mode, to, reason, at: now };
    console.log(`[Mode] ${transition.from} -> ${transition.to} (${reason})`);
    this.store.set({
      mode: to,
      transitions: [...current.transitions, transition],
    });
    return true;
  }

  reset(): void {
    this.store.set({ mode: 'booting', transitions: [] });
  }
}

export const appMode = new AppModeMachine();
