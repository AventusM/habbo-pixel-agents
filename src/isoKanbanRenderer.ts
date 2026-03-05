// src/isoKanbanRenderer.ts
// Renders GitHub Projects kanban cards as wall-mounted sticky notes in the isometric room.
// Notes are drawn as screen-space overlays after the depth-sorted render pass.

import type { TileGrid } from './isoTypes.js';
import type { KanbanCard } from './agentTypes.js';
import { tileToScreen, TILE_W_HALF, TILE_H_HALF } from './isometricMath.js';
import { WALL_HEIGHT } from './isoTileRenderer.js';

// Status column → sticky note background color
const KANBAN_COLORS: Record<string, string> = {
  'Todo': '#fef08a',
  'In Progress': '#93c5fd',
  'Done': '#86efac',
  'No Status': '#e5e7eb',
};

/**
 * Map a GitHub Projects status column name to its sticky note color.
 * Unknown status columns fall back to a neutral grey.
 */
export function statusToColor(status: string): string {
  return KANBAN_COLORS[status] ?? '#e5e7eb';
}

/**
 * Compute screen position for a sticky note on the left wall (column 0 tiles).
 * @param ty - Tile row index on the left wall edge
 * @param noteSlot - 0 for upper note in tile, 1 for lower note in tile
 * @param cameraOrigin - Canvas camera offset
 */
export function leftWallNotePosition(
  ty: number,
  noteSlot: 0 | 1,
  cameraOrigin: { x: number; y: number },
): { x: number; y: number } {
  const { x: sx, y: sy } = tileToScreen(0, ty, 0);
  const verticalOffset = noteSlot === 0 ? WALL_HEIGHT * 0.3 : WALL_HEIGHT * 0.6;
  return {
    x: sx + cameraOrigin.x - TILE_W_HALF * 0.5,
    y: sy + cameraOrigin.y + TILE_H_HALF + verticalOffset,
  };
}

/**
 * Compute screen position for a sticky note on the right wall (row 0 tiles).
 * @param tx - Tile column index on the right wall edge
 * @param noteSlot - 0 for upper note in tile, 1 for lower note in tile
 * @param cameraOrigin - Canvas camera offset
 */
export function rightWallNotePosition(
  tx: number,
  noteSlot: 0 | 1,
  cameraOrigin: { x: number; y: number },
): { x: number; y: number } {
  const { x: sx, y: sy } = tileToScreen(tx, 0, 0);
  const verticalOffset = noteSlot === 0 ? WALL_HEIGHT * 0.3 : WALL_HEIGHT * 0.6;
  return {
    x: sx + cameraOrigin.x + TILE_W_HALF * 0.5,
    y: sy + cameraOrigin.y + TILE_H_HALF + verticalOffset,
  };
}

/** Sticky note dimensions */
const NOTE_W = 48;
const NOTE_H = 36;
const NOTE_RADIUS = 3;

/**
 * Draw a single sticky note centered at (screenX, screenY).
 */
function drawStickyNote(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  title: string,
  color: string,
): void {
  const x = screenX - NOTE_W / 2;
  const y = screenY - NOTE_H / 2;
  const r = NOTE_RADIUS;

  ctx.save();

  // Rounded rectangle background
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + NOTE_W - r, y);
  ctx.arcTo(x + NOTE_W, y, x + NOTE_W, y + r, r);
  ctx.lineTo(x + NOTE_W, y + NOTE_H - r);
  ctx.arcTo(x + NOTE_W, y + NOTE_H, x + NOTE_W - r, y + NOTE_H, r);
  ctx.lineTo(x + r, y + NOTE_H);
  ctx.arcTo(x, y + NOTE_H, x, y + NOTE_H - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Truncate title to 10 chars
  const displayText = title.length > 10 ? title.slice(0, 10) + '\u2026' : title;

  ctx.font = '5px "Press Start 2P"';
  ctx.fillStyle = '#1a1a2e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayText, screenX, screenY);

  ctx.restore();
}

/**
 * Draw all kanban cards as sticky notes on the room walls.
 *
 * Cards are distributed left wall first (top-to-bottom, 2 per tile row),
 * then right wall (left-to-right, 2 per tile column).
 *
 * If cards is empty, returns immediately (no-op).
 */
export function drawKanbanNotes(
  ctx: CanvasRenderingContext2D,
  cards: KanbanCard[],
  grid: TileGrid,
  cameraOrigin: { x: number; y: number },
): void {
  if (cards.length === 0) return;

  // Collect left wall tile rows (non-void tiles in column 0)
  const leftWallTileRows: number[] = [];
  for (let ty = 0; ty < grid.height; ty++) {
    if (grid.tiles[ty]?.[0] !== null && grid.tiles[ty]?.[0] !== undefined) {
      leftWallTileRows.push(ty);
    }
  }

  // Collect right wall tile columns (non-void tiles in row 0)
  const rightWallTileCols: number[] = [];
  for (let tx = 0; tx < grid.width; tx++) {
    if (grid.tiles[0]?.[tx] !== null && grid.tiles[0]?.[tx] !== undefined) {
      rightWallTileCols.push(tx);
    }
  }

  const capacity = (leftWallTileRows.length + rightWallTileCols.length) * 2;
  const cardsToShow = cards.slice(0, capacity);

  let cardIndex = 0;

  // Fill left wall first: 2 notes per tile row
  for (const ty of leftWallTileRows) {
    if (cardIndex >= cardsToShow.length) break;
    for (let slot = 0; slot < 2; slot++) {
      if (cardIndex >= cardsToShow.length) break;
      const card = cardsToShow[cardIndex++];
      const pos = leftWallNotePosition(ty, slot as 0 | 1, cameraOrigin);
      drawStickyNote(ctx, pos.x, pos.y, card.title, statusToColor(card.status));
    }
  }

  // Fill right wall: 2 notes per tile column
  for (const tx of rightWallTileCols) {
    if (cardIndex >= cardsToShow.length) break;
    for (let slot = 0; slot < 2; slot++) {
      if (cardIndex >= cardsToShow.length) break;
      const card = cardsToShow[cardIndex++];
      const pos = rightWallNotePosition(tx, slot as 0 | 1, cameraOrigin);
      drawStickyNote(ctx, pos.x, pos.y, card.title, statusToColor(card.status));
    }
  }
}
