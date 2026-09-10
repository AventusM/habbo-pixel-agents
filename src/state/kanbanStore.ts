// src/state/kanbanStore.ts
// Typed kanban store (M003/S04): cards plus the source filter behind one
// observable state object, replacing the kanbanCardsRef/kanbanFilterRef pair.

import type { KanbanCard } from '../agentTypes.js';
import {
  filterKanbanCards,
  nextKanbanFilterMode,
  type KanbanFilterMode,
} from '../kanbanFilter.js';
import { createStore, type Store, type Unsubscribe } from './store.js';

export interface KanbanState {
  cards: KanbanCard[];
  filter: KanbanFilterMode;
}

export class KanbanStore {
  private readonly store: Store<KanbanState> = createStore<KanbanState>({
    cards: [],
    filter: 'all',
  });

  get cards(): KanbanCard[] {
    return this.store.get().cards;
  }

  get filter(): KanbanFilterMode {
    return this.store.get().filter;
  }

  get state(): KanbanState {
    return this.store.get();
  }

  subscribe(listener: (state: KanbanState) => void): Unsubscribe {
    return this.store.subscribe(listener);
  }

  subscribeSelector<S>(
    selector: (state: KanbanState) => S,
    listener: (selected: S) => void,
  ): Unsubscribe {
    return this.store.subscribeSelector(selector, listener);
  }

  setCards(cards: KanbanCard[]): void {
    this.store.update((prev) => ({ ...prev, cards }));
  }

  setFilter(filter: KanbanFilterMode): void {
    this.store.update((prev) => ({ ...prev, filter }));
  }

  cycleFilter(): KanbanFilterMode {
    const next = nextKanbanFilterMode(this.filter);
    this.setFilter(next);
    return next;
  }

  visibleCards(): KanbanCard[] {
    const { cards, filter } = this.store.get();
    return filterKanbanCards(cards, filter);
  }

  reset(): void {
    this.store.set({ cards: [], filter: 'all' });
  }
}

export const kanbanStore = new KanbanStore();
