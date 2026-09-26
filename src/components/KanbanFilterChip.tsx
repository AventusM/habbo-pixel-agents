// src/components/KanbanFilterChip.tsx
// Presentational kanban source filter HUD chip (M008/S02, D021 convention).
// Props in, JSX out — no store/client imports, no application logic; the shell
// derives the label (useKanbanFilter + KANBAN_FILTER_LABELS) and passes it down.
import type { CSSProperties } from 'react';

/** Fixed-position HUD styling for the kanban source filter chip. */
const chipStyle: CSSProperties = {
  position: 'fixed',
  left: 12,
  bottom: 12,
  zIndex: 10,
  padding: '6px 10px',
  borderRadius: 8,
  background: 'rgba(15, 23, 42, 0.78)',
  color: '#e2e8f0',
  font: '12px/1.4 monospace',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  pointerEvents: 'none',
};

export interface KanbanFilterChipProps {
  /** Human-readable label for the active kanban filter mode (e.g. "GSD only"). */
  label: string;
}

export function KanbanFilterChip({ label }: KanbanFilterChipProps) {
  return (
    <div style={chipStyle}>
      Kanban: {label} &middot; press G
    </div>
  );
}
