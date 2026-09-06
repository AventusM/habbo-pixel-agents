// src/kanbanFilter.ts
// Client-side filtering of kanban cards by source: GSD-labeled issues vs the rest.
// GSD issues carry the `gsd` label (see .gsd GitHub mirror convention).

import type { KanbanCard } from './agentTypes.js';

/** Label that marks a work item as managed by GSD */
export const GSD_LABEL = 'gsd';

export type KanbanFilterMode = 'all' | 'gsd' | 'non-gsd';

/** Cycle order for the filter toggle */
export const KANBAN_FILTER_ORDER: readonly KanbanFilterMode[] = ['all', 'gsd', 'non-gsd'] as const;

/** Human-readable label per mode (used by the HUD chip) */
export const KANBAN_FILTER_LABELS: Record<KanbanFilterMode, string> = {
  all: 'All',
  gsd: 'GSD only',
  'non-gsd': 'Non-GSD',
};

export function nextKanbanFilterMode(mode: KanbanFilterMode): KanbanFilterMode {
  const idx = KANBAN_FILTER_ORDER.indexOf(mode);
  return KANBAN_FILTER_ORDER[(idx + 1) % KANBAN_FILTER_ORDER.length];
}

export function isGsdCard(card: KanbanCard): boolean {
  return (card.labels ?? []).includes(GSD_LABEL);
}

export function filterKanbanCards(cards: KanbanCard[], mode: KanbanFilterMode): KanbanCard[] {
  if (mode === 'all') return cards;
  if (mode === 'gsd') return cards.filter(isGsdCard);
  return cards.filter((c) => !isGsdCard(c));
}
