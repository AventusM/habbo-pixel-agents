// src/expHistoryPanel.ts
// Experiment history panel (M004/S03): renders per-run agent summaries with PR
// links as a screen-space HUD on the LEFT side of the canvas (the
// orchestration overlay owns the right side). Drawn outside the camera
// transform, fed by expFeed.expHistoryFromRuns().

import type { ExpAgentSummary } from './expFeed.js';

export interface ExpHistoryState {
  rows: ExpAgentSummary[];
  visible: boolean;
}

const PANEL_WIDTH = 240;
const PADDING = 8;
const HEADER_HEIGHT = 18;
const ROW_HEIGHT = 26;
const MAX_ROWS_VISIBLE = 8;
const FONT = '7px "Press Start 2P", monospace';
const FONT_SMALL = '6px "Press Start 2P", monospace';

const STATUS_COLORS: Record<string, string> = {
  merged: '#4aff4a',
  approved: '#4aff4a',
  done: '#4a9eff',
  rework: '#ffaa4a',
  blocked: '#ff5555',
  failed: '#ff5555',
  idle: '#555555',
};

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#4a9eff';
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 2) + '..' : str;
}

function prRef(row: ExpAgentSummary): string | null {
  if (row.prUrl) {
    const m = /\/pull\/(\d+)/.exec(row.prUrl);
    if (m) return `PR #${m[1]}`;
    return 'PR';
  }
  if (row.branch) {
    const short = row.branch.split('/').pop() ?? row.branch;
    return truncate(short, 18);
  }
  return null;
}

export interface ExpHistoryLayout {
  visibleRows: number;
  panelHeight: number;
}

/** Pure layout math (unit-testable without a canvas). */
export function computeExpHistoryLayout(rowCount: number, canvasH: number): ExpHistoryLayout {
  const visibleRows = Math.max(0, Math.min(rowCount, MAX_ROWS_VISIBLE));
  const panelHeight = PADDING + HEADER_HEIGHT + visibleRows * ROW_HEIGHT + PADDING;
  return { visibleRows, panelHeight: Math.min(panelHeight, Math.max(0, canvasH - 16)) };
}

/**
 * Draw the experiment history panel on the left side of the canvas.
 * Called in screen-space (outside camera transform).
 */
export function drawExpHistoryPanel(
  ctx: CanvasRenderingContext2D,
  state: ExpHistoryState,
  canvasW: number,
  canvasH: number,
): void {
  if (!state.visible) return;
  if (canvasW < PANEL_WIDTH + 16) return;

  const x = 8;
  const y = 8;
  const { visibleRows, panelHeight } = computeExpHistoryLayout(state.rows.length, canvasH);

  // Panel background
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#14141f';
  ctx.fillRect(x, y, PANEL_WIDTH, panelHeight);
  ctx.globalAlpha = 1;

  // Panel border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, PANEL_WIDTH, panelHeight);

  let curY = y + PADDING;

  // Header
  ctx.font = FONT;
  ctx.fillStyle = '#888';
  ctx.fillText('EXPERIMENTS', x + PADDING, curY + 12);
  ctx.fillStyle = '#333';
  ctx.fillRect(x + PADDING, curY + 15, PANEL_WIDTH - PADDING * 2, 1);
  curY += HEADER_HEIGHT;

  if (state.rows.length === 0) {
    ctx.font = FONT_SMALL;
    ctx.fillStyle = '#555';
    ctx.fillText('No experiment runs', x + PADDING + 20, curY + 10);
    ctx.restore();
    return;
  }

  // One row per run (newest last is fine; rows arrive in store order)
  const rows = state.rows.slice(0, visibleRows);
  for (const row of rows) {
    // Status dot
    ctx.beginPath();
    ctx.arc(x + PADDING + 4, curY + 6, 3, 0, Math.PI * 2);
    ctx.fillStyle = statusColor(row.status);
    ctx.fill();

    // Label (first line): model + issue
    ctx.font = FONT_SMALL;
    ctx.fillStyle = '#ccc';
    ctx.fillText(truncate(row.label, 24), x + PADDING + 12, curY + 8);

    // Summary + PR ref (second line)
    const ref = prRef(row);
    const second = ref ? `${truncate(row.summary, 16)} ${ref}` : truncate(row.summary, 26);
    ctx.fillStyle = row.prUrl ? '#4a9eff' : '#666';
    ctx.fillText(second, x + PADDING + 12, curY + 19);

    curY += ROW_HEIGHT;
  }

  ctx.restore();
}
