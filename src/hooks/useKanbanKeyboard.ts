// src/hooks/useKanbanKeyboard.ts
// Kanban keyboard navigation (M008/S04 T04, extracted from RoomCanvas under the
// D021 convention): the g/G source-filter cycle and the ArrowLeft/Right/n/N/p/P/
// b/B/Escape note traversal while a detail note is open. The three note refs stay
// shell-owned (the frame path reads them); this hook only binds the listener.
import { useEffect } from 'react';
import type { RefObject } from 'react';
import { kanbanStore } from '../state/kanbanStore.js';

export interface UseKanbanKeyboardOptions {
  expandedNoteRef: RefObject<string | null>;
  noteOriginRef: RefObject<'todo' | 'done' | null>;
  expandedAggregateRef: RefObject<'todo' | 'done' | null>;
}

export function useKanbanKeyboard({
  expandedNoteRef,
  noteOriginRef,
  expandedAggregateRef,
}: UseKanbanKeyboardOptions) {
  useEffect(() => {
    const handleFilterKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        kanbanStore.cycleFilter();
        return;
      }
      // Kanban traversal keys (only while a detail note is open)
      if (!expandedNoteRef.current) return;
      const visibleCards = kanbanStore.visibleCards();
      if (visibleCards.length === 0) return;
      const idx = Math.max(0, visibleCards.findIndex(c => c.id === expandedNoteRef.current));
      if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
        expandedNoteRef.current = visibleCards[(idx + 1) % visibleCards.length].id;
      } else if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
        expandedNoteRef.current = visibleCards[(idx - 1 + visibleCards.length) % visibleCards.length].id;
      } else if (e.key === 'b' || e.key === 'B') {
        if (noteOriginRef.current) {
          expandedAggregateRef.current = noteOriginRef.current;
          noteOriginRef.current = null;
          expandedNoteRef.current = null;
        } else {
          expandedNoteRef.current = null;
        }
      } else if (e.key === 'Escape') {
        expandedNoteRef.current = null;
        expandedAggregateRef.current = null;
        noteOriginRef.current = null;
      }
    };
    window.addEventListener('keydown', handleFilterKey);
    return () => window.removeEventListener('keydown', handleFilterKey);
  }, [expandedNoteRef, noteOriginRef, expandedAggregateRef]);
}
