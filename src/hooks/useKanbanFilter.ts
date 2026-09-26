// src/hooks/useKanbanFilter.ts
// Mirror the kanban filter store into React state for the room HUD (M008/S01).
// Extracted from RoomCanvas per the D021 convention: store subscriptions live in
// hooks, the component only renders.
import { useEffect, useState } from 'react';
import { kanbanStore } from '../state/kanbanStore.js';
import type { KanbanFilterMode } from '../kanbanFilter.js';

export function useKanbanFilter(): KanbanFilterMode {
  const [filter, setFilter] = useState<KanbanFilterMode>(kanbanStore.filter);
  useEffect(() => kanbanStore.subscribeSelector((state) => state.filter, setFilter), []);
  return filter;
}
