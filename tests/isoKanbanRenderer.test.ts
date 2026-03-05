// tests/isoKanbanRenderer.test.ts
// Unit tests for isoKanbanRenderer: color mapping and note rendering

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { statusToColor, drawKanbanNotes } from '../src/isoKanbanRenderer.js';
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

  it('returns light grey for "No Status"', () => {
    expect(statusToColor('No Status')).toBe('#e5e7eb');
  });

  it('returns grey fallback for unknown status strings', () => {
    expect(statusToColor('Backlog')).toBe('#e5e7eb');
    expect(statusToColor('')).toBe('#e5e7eb');
    expect(statusToColor('review')).toBe('#e5e7eb');
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

  it('draws notes for 3 cards on a 5x5 grid without throwing', () => {
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
    // save/restore should have been called for each drawn note
    expect(ctx.save).toHaveBeenCalledTimes(3);
    expect(ctx.restore).toHaveBeenCalledTimes(3);
  });

  it('positions notes on the left wall for first tiles', () => {
    const ctx = makeMockCtx();
    const grid = make5x5Grid();
    const cards: KanbanCard[] = [
      { id: '1', title: 'Card One', status: 'Todo' },
    ];
    // Should not throw; left wall column 0, row 0 has a tile
    expect(() =>
      drawKanbanNotes(ctx, cards, grid, { x: 0, y: 0 })
    ).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalledWith('Card One', expect.any(Number), expect.any(Number));
  });

  it('truncates titles longer than 10 characters to 10 chars + ellipsis', () => {
    const ctx = makeMockCtx();
    const grid = make5x5Grid();
    const cards: KanbanCard[] = [
      { id: '1', title: 'This is a very long title', status: 'Todo' },
    ];
    drawKanbanNotes(ctx, cards, grid, { x: 0, y: 0 });
    // fillText should have been called with truncated text
    expect(ctx.fillText).toHaveBeenCalledWith(
      'This is a \u2026',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('respects capacity limit and does not draw more than available wall slots', () => {
    const ctx = makeMockCtx();
    // Tiny 1x1 grid — left wall has 1 tile, right wall has 1 tile => capacity = 4
    const grid: TileGrid = {
      tiles: [[{ height: 0 }]],
      width: 1,
      height: 1,
    };
    // 10 cards but only 4 slots
    const cards: KanbanCard[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      title: `Card ${i}`,
      status: 'Todo',
    }));
    drawKanbanNotes(ctx, cards, grid, { x: 0, y: 0 });
    // Only 4 notes drawn (4 save/restore pairs)
    expect(ctx.save).toHaveBeenCalledTimes(4);
  });
});
