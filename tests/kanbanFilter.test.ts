// tests/kanbanFilter.test.ts
// Unit tests for kanban source filtering (GSD-labeled vs rest)

import { describe, it, expect } from 'vitest';
import {
  GSD_LABEL,
  KANBAN_FILTER_ORDER,
  KANBAN_FILTER_LABELS,
  nextKanbanFilterMode,
  isGsdCard,
  filterKanbanCards,
} from '../src/kanbanFilter.js';
import type { KanbanCard } from '../src/agentTypes.js';

function card(id: string, labels?: string[]): KanbanCard {
  return { id, title: `card-${id}`, status: 'Backlog', ...(labels ? { labels } : {}) };
}

describe('kanbanFilter', () => {
  it('marks the GSD label constant', () => {
    expect(GSD_LABEL).toBe('gsd');
  });

  it('cycles filter modes in order and wraps around', () => {
    expect(KANBAN_FILTER_ORDER).toEqual(['all', 'gsd', 'non-gsd']);
    expect(nextKanbanFilterMode('all')).toBe('gsd');
    expect(nextKanbanFilterMode('gsd')).toBe('non-gsd');
    expect(nextKanbanFilterMode('non-gsd')).toBe('all');
  });

  it('provides a human-readable label per mode', () => {
    expect(KANBAN_FILTER_LABELS.all).toBe('All');
    expect(KANBAN_FILTER_LABELS.gsd).toBe('GSD only');
    expect(KANBAN_FILTER_LABELS['non-gsd']).toBe('Non-GSD');
  });

  it('isGsdCard is true only for cards carrying the gsd label', () => {
    expect(isGsdCard(card('a', ['gsd']))).toBe(true);
    expect(isGsdCard(card('b', ['gsd', 'M001']))).toBe(true);
    expect(isGsdCard(card('c', ['other']))).toBe(false);
    expect(isGsdCard(card('d'))).toBe(false);
  });

  it('filterKanbanCards "all" returns the input list', () => {
    const cards = [card('a', ['gsd']), card('b')];
    expect(filterKanbanCards(cards, 'all')).toEqual(cards);
  });

  it('filterKanbanCards "gsd" keeps only GSD-labeled cards', () => {
    const cards = [card('a', ['gsd']), card('b'), card('c', ['M001'])];
    expect(filterKanbanCards(cards, 'gsd').map((c) => c.id)).toEqual(['a']);
  });

  it('filterKanbanCards "non-gsd" excludes GSD-labeled cards', () => {
    const cards = [card('a', ['gsd']), card('b'), card('c', ['M001'])];
    expect(filterKanbanCards(cards, 'non-gsd').map((c) => c.id)).toEqual(['b', 'c']);
  });

  it('filterKanbanCards handles missing labels arrays', () => {
    const cards = [card('a')];
    expect(filterKanbanCards(cards, 'gsd')).toEqual([]);
    expect(filterKanbanCards(cards, 'non-gsd')).toEqual(cards);
  });
});
