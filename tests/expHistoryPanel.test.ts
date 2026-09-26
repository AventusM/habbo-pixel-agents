// tests/expHistoryPanel.test.ts
// Unit tests for the experiment history panel: pure layout math plus draw
// behavior against a mock 2d context (mirrors isoKanbanRenderer.test.ts).

import { describe, it, expect, vi } from 'vitest';
import {
  computeExpHistoryLayout,
  drawExpHistoryPanel,
  type ExpHistoryState,
} from '../src/expHistoryPanel.js';

/** Build a minimal mock CanvasRenderingContext2D */
function makeMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
  } as unknown as CanvasRenderingContext2D;
}

function row(runId: string, status = 'done', summary = 'working on it') {
  return {
    runId,
    label: `deepseek-flash #80`,
    model: 'opencode-go/deepseek-flash',
    issue: 80,
    status,
    currentSection: 'build' as const,
    summary,
    prUrl: null,
    branch: 'exp/80-x',
  };
}

describe('computeExpHistoryLayout', () => {
  it('sizes the panel from the visible row count', () => {
    const empty = computeExpHistoryLayout(0, 900);
    expect(empty.visibleRows).toBe(0);
    expect(empty.panelHeight).toBeGreaterThan(0);
    const three = computeExpHistoryLayout(3, 900);
    expect(three.visibleRows).toBe(3);
    expect(three.panelHeight).toBeGreaterThan(empty.panelHeight);
  });

  it('caps visible rows at 8 and clamps to canvas height', () => {
    const many = computeExpHistoryLayout(20, 900);
    expect(many.visibleRows).toBe(8);
    const tiny = computeExpHistoryLayout(20, 40);
    expect(tiny.panelHeight).toBeLessThanOrEqual(40 - 16);
  });
});

describe('drawExpHistoryPanel', () => {
  it('draws nothing when hidden', () => {
    const ctx = makeMockCtx();
    const state: ExpHistoryState = { rows: [row('a')], visible: false };
    drawExpHistoryPanel(ctx, state, 1280, 900);
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('draws nothing on a too-narrow canvas', () => {
    const ctx = makeMockCtx();
    const state: ExpHistoryState = { rows: [row('a')], visible: true };
    drawExpHistoryPanel(ctx, state, 100, 900);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('renders the empty state', () => {
    const ctx = makeMockCtx();
    drawExpHistoryPanel(ctx, { rows: [], visible: true }, 1280, 900);
    expect(ctx.fillRect).toHaveBeenCalled();
    const texts = (ctx.fillText as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      (c) => String(c[0]),
    );
    expect(texts.some((t) => t.includes('No experiment runs'))).toBe(true);
  });

  it('renders one row per run with label, summary, and PR ref', () => {
    const ctx = makeMockCtx();
    const state: ExpHistoryState = {
      rows: [
        { ...row('a', 'approved', 'looks good'), prUrl: 'https://example.com/pull/99' },
        row('b', 'rework', 'needs fixes'),
      ],
      visible: true,
    };
    drawExpHistoryPanel(ctx, state, 1280, 900);
    const texts = (ctx.fillText as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      (c) => String(c[0]),
    );
    const joined = texts.join('\n');
    expect(joined).toContain('EXPERIMENTS');
    expect(joined).toContain('deepseek-flash #80');
    expect(joined).toContain('PR #99');
  });
});
