// tests/kanbanStore.test.ts
// Unit tests for the kanban store: card ingestion, source filtering, filter
// cycling, and subscriptions.

import { describe, it, expect } from 'vitest';
import { KanbanStore } from '../src/state/kanbanStore.js';
import type { KanbanCard } from '../src/agentTypes.js';

const CARDS: KanbanCard[] = [
  { id: '1', title: 'gsd task', status: 'Doing', labels: ['gsd'] },
  { id: '2', title: 'other task', status: 'To Do', labels: ['bug'] },
];

describe('kanbanStore', () => {
  it('starts empty with the all filter', () => {
    const store = new KanbanStore();
    expect(store.cards).toEqual([]);
    expect(store.filter).toBe('all');
  });

  it('stores cards from a kanbanCards message', () => {
    const store = new KanbanStore();
    store.setCards(CARDS);
    expect(store.cards).toHaveLength(2);
  });

  it('filters visible cards by source', () => {
    const store = new KanbanStore();
    store.setCards(CARDS);
    store.setFilter('gsd');
    expect(store.visibleCards().map((c) => c.id)).toEqual(['1']);
    store.setFilter('non-gsd');
    expect(store.visibleCards().map((c) => c.id)).toEqual(['2']);
    store.setFilter('all');
    expect(store.visibleCards()).toHaveLength(2);
  });

  it('cycles the filter', () => {
    const store = new KanbanStore();
    expect(store.cycleFilter()).toBe('gsd');
    expect(store.cycleFilter()).toBe('non-gsd');
    expect(store.cycleFilter()).toBe('all');
  });

  it('notifies subscribers on card and filter changes', () => {
    const store = new KanbanStore();
    const sizes: number[] = [];
    store.subscribe((state) => sizes.push(state.cards.length));
    store.setCards(CARDS);
    expect(sizes).toEqual([0, 2]);
  });

  it('reset clears state', () => {
    const store = new KanbanStore();
    store.setCards(CARDS);
    store.setFilter('gsd');
    store.reset();
    expect(store.cards).toEqual([]);
    expect(store.filter).toBe('all');
  });
});
