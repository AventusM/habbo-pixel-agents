// src/hooks/useKanbanFilter.ts
// Read the kanban filter straight from kanbanStore (M008/S03, D021 convention):
// the store is the single source of truth for the filter, so the hook subscribes
// through useStoreValue — there is no separate React-state copy and no manual
// sync effect. The shell's consumption (KanbanFilterChip label via
// KANBAN_FILTER_LABELS) is byte-identical to the previous mirror.
import { kanbanStore } from '../state/kanbanStore.js';
import type { KanbanState } from '../state/kanbanStore.js';
import type { KanbanFilterMode } from '../kanbanFilter.js';
import { useStoreValue } from './useStoreValue.js';

const selectFilter = (state: KanbanState): KanbanFilterMode => state.filter;

export function useKanbanFilter(): KanbanFilterMode {
  return useStoreValue(kanbanStore, selectFilter);
}
