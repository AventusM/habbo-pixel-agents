// tests/isoKanbanRenderer.test.ts
// Unit tests for isoKanbanRenderer: color mapping, note rendering, aggregate notes

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { statusToColor, drawKanbanNotes, drawExpandedNote, drawExpandedAggregateNote, getNoteHitAreas, getExpandedNoteNavRects, getAggregateRowHitAreas } from '../src/isoKanbanRenderer.js';
import type { KanbanCard } from '../src/agentTypes.js';
import type { TileGrid } from '../src/isoTypes.js';

// ---------------------------------------------------------------------------
// statusToColor
// ---------------------------------------------------------------------------

describe('statusToColor', () => {
  it('returns yellow for "Todo"', () => {
    expect(statusToColor('Todo')).toBe('#fef08a');
  });

  it('returns blue for "In Progress"', () => {
    expect(statusToColor('In Progress')).toBe('#93c5fd');
  });

  it('returns green for "Done"', () => {
    expect(statusToColor('Done')).toBe('#86efac');
  });

  it('returns pink for "No Status"', () => {
    expect(statusToColor('No Status')).toBe('#fda4af');
  });

  it('returns pink fallback for unknown status strings', () => {
    expect(statusToColor('Backlog')).toBe('#fda4af');
    expect(statusToColor('')).toBe('#fda4af');
    expect(statusToColor('review')).toBe('#fda4af');
  });
});

// ---------------------------------------------------------------------------
// drawKanbanNotes
// ---------------------------------------------------------------------------

/** Build a minimal mock CanvasRenderingContext2D */
function makeMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    transform: vi.fn(),
    arc: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D;
}

/** Build a simple 5x5 TileGrid where every cell is non-null */
function make5x5Grid(): TileGrid {
  const tiles: Array<Array<{ height: number } | null>> = [];
  for (let row = 0; row < 5; row++) {
    const rowArr: Array<{ height: number } | null> = [];
    for (let col = 0; col < 5; col++) {
      rowArr.push({ height: 0 });
    }
    tiles.push(rowArr);
  }
  return { tiles, width: 5, height: 5 };
}

describe('drawKanbanNotes', () => {
  it('does not throw when cards array is empty', () => {
    const ctx = makeMockCtx();
    const grid = make5x5Grid();
    expect(() =>
      drawKanbanNotes(ctx, [], grid, { x: 320, y: 100 })
    ).not.toThrow();
  });

  it('does not call any drawing methods when cards is empty', () => {
    const ctx = makeMockCtx();
    const grid = make5x5Grid();
    drawKanbanNotes(ctx, [], grid, { x: 320, y: 100 });
    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('draws notes for mixed-status cards without throwing', () => {
    const ctx = makeMockCtx();
    const grid = make5x5Grid();
    const cards: KanbanCard[] = [
      { id: '1', title: 'Fix the bug', status: 'In Progress' },
      { id: '2', title: 'Write tests', status: 'Todo' },
      { id: '3', title: 'Deploy it', status: 'Done' },
    ];
    expect(() =>
      drawKanbanNotes(ctx, cards, grid, { x: 320, y: 100 })
    ).not.toThrow();
    // save/restore called for: 1 large backlog + 1 large done + 1 small In Progress = 3
    expect(ctx.save).toHaveBeenCalledTimes(3);
    expect(ctx.restore).toHaveBeenCalledTimes(3);
  });

  it('creates aggregate hit areas for backlog and done notes', () => {
    const ctx = makeMockCtx();
    const grid = make5x5Grid();
    const cards: KanbanCard[] = [
      { id: '1', title: 'Task A', status: 'Todo' },
      { id: '2', title: 'Task B', status: 'Done' },
      { id: '3', title: 'Task C', status: 'In Progress' },
    ];
    drawKanbanNotes(ctx, cards, grid, { x: 320, y: 100 });
    const hitAreas = getNoteHitAreas();

    const backlogHit = hitAreas.find(h => h.aggregateType === 'todo');
    expect(backlogHit).toBeDefined();
    expect(backlogHit!.cardId).toBe('__todo__');

    const doneHit = hitAreas.find(h => h.aggregateType === 'done');
    expect(doneHit).toBeDefined();
    expect(doneHit!.cardId).toBe('__done__');

    // In Progress card should have a normal hit area
    const ipHit = hitAreas.find(h => h.cardId === '3');
    expect(ipHit).toBeDefined();
    expect(ipHit!.aggregateType).toBeUndefined();
  });

  it('only draws In Progress cards as small individual notes', () => {
    const ctx = makeMockCtx();
    const grid = make5x5Grid();
    const cards: KanbanCard[] = [
      { id: '1', title: 'IP 1', status: 'In Progress' },
      { id: '2', title: 'IP 2', status: 'In Progress' },
      { id: '3', title: 'Todo 1', status: 'Todo' },
    ];
    drawKanbanNotes(ctx, cards, grid, { x: 320, y: 100 });
    const hitAreas = getNoteHitAreas();

    // 1 aggregate (backlog) + 2 small (In Progress)
    expect(hitAreas.length).toBe(3);
    const smallNotes = hitAreas.filter(h => !h.aggregateType);
    expect(smallNotes.length).toBe(2);
  });

  it('respects capacity limit for In Progress notes on tiny grid', () => {
    const ctx = makeMockCtx();
    // 6x6 grid — left edge has 6 tiles.
    // todoIdx = max(0, 6-2) = 4, doneIdx = min(1, 5) = 1.
    // lo=1, hi=4. Middle tiles at indices 2 and 3 → 2 tiles × 2 slots = 4 capacity.
    // Providing 1 Todo and 1 Done card ensures both aggregates render,
    // then 10 IP cards are capped to the 4 available small note slots.
    const row = Array.from({ length: 6 }, () => ({ height: 0 }));
    const grid: TileGrid = {
      tiles: Array.from({ length: 6 }, () => [...row]),
      width: 6,
      height: 6,
    };
    const cards: KanbanCard[] = [
      { id: 'todo1', title: 'Todo task', status: 'Todo' },
      { id: 'done1', title: 'Done task', status: 'Done' },
      ...Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        title: `Card ${i}`,
        status: 'In Progress' as const,
      })),
    ];
    drawKanbanNotes(ctx, cards, grid, { x: 0, y: 0 });
    const hitAreas = getNoteHitAreas();
    // Small notes are non-aggregate (In Progress only)
    const smallNotes = hitAreas.filter(h => !h.aggregateType);
    // 6x6 grid: 2 middle tiles × 2 slots = 4 capacity; 10 IP cards capped to 4
    expect(smallNotes.length).toBeLessThanOrEqual(4);
    expect(smallNotes.length).toBe(4);
  });

  it('never places In Progress notes on the right wall', () => {
    const ctx = makeMockCtx();
    const grid = make5x5Grid();
    // Provide more In Progress cards than left wall can hold (5 rows × 2 slots = 10 left,
    // minus mid tile for backlog = 8 left slots; give 20 cards to ensure overflow would
    // occur if right wall were still used)
    const cards: KanbanCard[] = [
      { id: 'bl1', title: 'Backlog task', status: 'Todo' },
      { id: 'dn1', title: 'Done task', status: 'Done' },
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `ip${i}`,
        title: `In Progress ${i}`,
        status: 'In Progress' as const,
      })),
    ];
    drawKanbanNotes(ctx, cards, grid, { x: 320, y: 100 });
    const hitAreas = getNoteHitAreas();
    // No small (non-aggregate) note should appear on the right wall
    const rightSmallNotes = hitAreas.filter(h => h.wallSide === 'right' && !h.aggregateType);
    expect(rightSmallNotes.length).toBe(0);
    // All small notes must be on the left wall
    const smallNotes = hitAreas.filter(h => !h.aggregateType);
    expect(smallNotes.every(h => h.wallSide === 'left')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// drawExpandedAggregateNote
// ---------------------------------------------------------------------------

describe('drawExpandedNote nav bar', () => {
  const card: KanbanCard = { id: 'a', title: 'Card A', status: 'Backlog', url: 'https://x.y/1' };

  it('draws prev/next zones and clears state between draws', () => {
    const ctx = makeMockCtx();
    drawExpandedNote(ctx, card, 900, 700, { canBack: false });
    const nav = getExpandedNoteNavRects();
    expect(nav).not.toBeNull();
    expect(nav!.prev.w).toBeGreaterThan(0);
    expect(nav!.next.w).toBeGreaterThan(0);
    expect(nav!.back).toBeNull();

    // Aggregate draw clears stale nav rects
    drawExpandedAggregateNote(ctx, 'todo', [card], 900, 700);
    expect(getExpandedNoteNavRects()).toBeNull();
  });

  it('draws a back zone when the note was opened from an aggregate', () => {
    const ctx = makeMockCtx();
    drawExpandedNote(ctx, card, 900, 700, { canBack: true });
    const nav = getExpandedNoteNavRects();
    expect(nav!.back).not.toBeNull();
    // prev and next don't overlap
    expect(nav!.prev.x + nav!.prev.w).toBeLessThanOrEqual(nav!.back!.x);
    expect(nav!.back!.x + nav!.back!.w).toBeLessThanOrEqual(nav!.next.x);
  });
});

describe('drawExpandedAggregateNote', () => {
  it('draws backlog aggregate overlay without throwing', () => {
    const ctx = makeMockCtx();
    const cards: KanbanCard[] = [
      { id: '1', title: 'Task A', status: 'Todo' },
      { id: '2', title: 'Task B', status: 'No Status' },
    ];
    expect(() =>
      drawExpandedAggregateNote(ctx, 'backlog', cards, 640, 480)
    ).not.toThrow();
    // Should draw backdrop, panel, fold, header, separator, card list, close hint
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('draws done aggregate overlay without throwing', () => {
    const ctx = makeMockCtx();
    const cards: KanbanCard[] = [
      { id: '1', title: 'Completed task', status: 'Done' },
    ];
    expect(() =>
      drawExpandedAggregateNote(ctx, 'done', cards, 640, 480)
    ).not.toThrow();
  });

  it('renders status color dots for each card', () => {
    const ctx = makeMockCtx();
    const cards: KanbanCard[] = [
      { id: '1', title: 'A', status: 'Todo' },
      { id: '2', title: 'B', status: 'No Status' },
      { id: '3', title: 'C', status: 'Todo' },
    ];
    drawExpandedAggregateNote(ctx, 'backlog', cards, 640, 480);
    // arc is called for each card's status dot
    expect(ctx.arc).toHaveBeenCalledTimes(3);
  });

  it('stores a row hit rect per card for click-through', () => {
    const ctx = makeMockCtx();
    const cards: KanbanCard[] = [
      { id: 'a', title: 'Card A', status: 'Todo' },
      { id: 'b', title: 'Card B', status: 'Done' },
    ];
    drawExpandedAggregateNote(ctx, 'todo', cards, 800, 600);
    const rows = getAggregateRowHitAreas();
    expect(rows.map((r) => r.cardId)).toEqual(['a', 'b']);
    for (const r of rows) {
      expect(r.w).toBeGreaterThan(0);
      expect(r.x + r.w).toBeLessThanOrEqual(800);
      expect(r.y + r.h).toBeLessThanOrEqual(600);
    }
  });

  it('clears row hit areas when redrawn with no cards', () => {
    const ctx = makeMockCtx();
    drawExpandedAggregateNote(ctx, 'todo', [{ id: 'a', title: 'A', status: 'Todo' }], 800, 600);
    expect(getAggregateRowHitAreas()).toHaveLength(1);
    drawExpandedAggregateNote(ctx, 'todo', [], 800, 600);
    expect(getAggregateRowHitAreas()).toEqual([]);
  });

  it('truncates long titles in aggregate overlay', () => {
    const ctx = makeMockCtx();
    const cards: KanbanCard[] = [
      { id: '1', title: 'This is a very long title that should be truncated', status: 'Todo' },
    ];
    drawExpandedAggregateNote(ctx, 'backlog', cards, 640, 480);
    // The truncated title should end with ellipsis (22 chars max)
    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const titleCall = fillTextCalls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('\u2026')
    );
    expect(titleCall).toBeDefined();
  });
});
