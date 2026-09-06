// tests/degradations.test.ts
// Unit tests for the degradation registry (surfaced-state mechanism)

import { describe, it, expect, beforeEach } from 'vitest';
import { reportDegradation, clearDegradation, getDegradations, onDegradations } from '../src/degradations.js';

describe('degradations', () => {
  beforeEach(() => {
    for (const d of getDegradations()) clearDegradation(d.id);
  });

  it('reports and clears degradations', () => {
    reportDegradation('ws', 'connection lost — reconnecting');
    expect(getDegradations().some((d) => d.id === 'ws')).toBe(true);
    clearDegradation('ws');
    expect(getDegradations().some((d) => d.id === 'ws')).toBe(false);
  });

  it('dedupes by id and preserves the original since timestamp', () => {
    reportDegradation('figures', 'incomplete: 1/21');
    const first = getDegradations().find((d) => d.id === 'figures');
    reportDegradation('figures', 'incomplete: 2/21');
    const second = getDegradations().find((d) => d.id === 'figures');
    expect(first?.since).toBe(second?.since);
    expect(second?.detail).toBe('incomplete: 2/21');
  });

  it('notifies subscribers on report and clear (immediate snapshot on subscribe)', () => {
    const events: number[] = [];
    const unsub = onDegradations((list) => events.push(list.length));
    reportDegradation('atlas-chair', 'failed');
    clearDegradation('atlas-chair');
    unsub();
    reportDegradation('atlas-chair', 'failed again');
    expect(events).toEqual([0, 1, 0]);
    expect(getDegradations().some((d) => d.id === 'atlas-chair')).toBe(true);
  });
});
