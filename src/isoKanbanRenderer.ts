// src/isoKanbanRenderer.ts
// Renders GitHub Projects kanban cards as wall-mounted sticky notes in the isometric room.
// Notes are drawn with isometric skew transforms to appear "on" wall surfaces,
// with folded corners and click-to-expand interaction.

import type { TileGrid } from './isoTypes.js';
import type { KanbanCard } from './agentTypes.js';
import { tileToScreen, TILE_W_HALF, TILE_H_HALF, WALL_HEIGHT } from './isometricMath.js';

// Status column → sticky note background color
const KANBAN_COLORS: Record<string, string> = {
  'Todo': '#fef08a',
  'In Progress': '#93c5fd',
  'Done': '#86efac',
  'No Status': '#fda4af',
};

// Darker shade for folded corner per status
const KANBAN_FOLD_COLORS: Record<string, string> = {
  'Todo': '#eab308',
  'In Progress': '#3b82f6',
  'Done': '#22c55e',
  'No Status': '#f43f5e',
};

/** Sticky note dimensions (local space, before skew) */
const NOTE_W = 12;
const NOTE_H = 18;
const FOLD_SIZE = 6;

/** Hit area for a rendered note (screen-space quad corners) */
export interface NoteHitArea {
  cardId: string;
  corners: [Point, Point, Point, Point]; // TL, TR, BR, BL in screen space
  wallSide: 'left' | 'right';
}

interface Point { x: number; y: number }

// Module-level hit area cache, rebuilt each frame
let noteHitAreas: NoteHitArea[] = [];

export function getNoteHitAreas(): NoteHitArea[] {
  return noteHitAreas;
}

/**
 * Point-in-quad test using cross-product winding.
 * Assumes corners are in order (CW or CCW).
 */
export function pointInQuad(px: number, py: number, corners: [Point, Point, Point, Point]): boolean {
  let positive = 0;
  let negative = 0;
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (cross > 0) positive++;
    else if (cross < 0) negative++;
  }
  return positive === 0 || negative === 0;
}

/**
 * Map a GitHub Projects status column name to its sticky note color.
 */
export function statusToColor(status: string): string {
  return KANBAN_COLORS[status] ?? '#fda4af';
}

function foldColor(status: string): string {
  return KANBAN_FOLD_COLORS[status] ?? '#f43f5e';
}

/**
 * Compute screen position for a sticky note on the left wall.
 */
export function leftWallNotePosition(
  tx: number,
  ty: number,
  noteSlot: 0 | 1,
  cameraOrigin: { x: number; y: number },
): { x: number; y: number } {
  const { x: sx, y: sy } = tileToScreen(tx, ty, 0);
  const verticalOffset = noteSlot === 0 ? WALL_HEIGHT * 0.3 : WALL_HEIGHT * 0.65;
  return {
    x: sx + cameraOrigin.x - TILE_W_HALF * 0.5,
    y: sy + cameraOrigin.y - verticalOffset,
  };
}

/**
 * Compute screen position for a sticky note on the right wall.
 */
export function rightWallNotePosition(
  tx: number,
  ty: number,
  noteSlot: 0 | 1,
  cameraOrigin: { x: number; y: number },
): { x: number; y: number } {
  const { x: sx, y: sy } = tileToScreen(tx, ty, 0);
  const verticalOffset = noteSlot === 0 ? WALL_HEIGHT * 0.3 : WALL_HEIGHT * 0.65;
  return {
    x: sx + cameraOrigin.x + TILE_W_HALF * 0.5,
    y: sy + cameraOrigin.y - verticalOffset,
  };
}

/**
 * Transform a local-space point through the skew matrix for a wall side.
 * The skew matrix maps the note rectangle onto the wall's isometric angle.
 *
 * Left wall:  ctx.transform(1, 0.5, 0, 1, anchorX, anchorY)
 * Right wall: ctx.transform(1, -0.5, 0, 1, anchorX, anchorY)
 */
function transformPoint(
  lx: number,
  ly: number,
  anchorX: number,
  anchorY: number,
  wallSide: 'left' | 'right',
): Point {
  const slope = wallSide === 'left' ? -0.5 : 0.5;
  return {
    x: anchorX + lx,
    y: anchorY + lx * slope + ly,
  };
}

/**
 * Compute screen-space quad corners for hit detection.
 */
function computeSkewedCorners(
  anchorX: number,
  anchorY: number,
  w: number,
  h: number,
  wallSide: 'left' | 'right',
): [Point, Point, Point, Point] {
  const x0 = -w / 2;
  const y0 = -h / 2;
  return [
    transformPoint(x0, y0, anchorX, anchorY, wallSide),         // TL
    transformPoint(x0 + w, y0, anchorX, anchorY, wallSide),     // TR
    transformPoint(x0 + w, y0 + h, anchorX, anchorY, wallSide), // BR
    transformPoint(x0, y0 + h, anchorX, anchorY, wallSide),     // BL
  ];
}

/**
 * Draw a single sticky note with isometric skew and folded corner.
 * The note is drawn in local space with a canvas transform applied.
 */
function drawStickyNote(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  title: string,
  status: string,
  wallSide: 'left' | 'right',
  isExpanded: boolean,
): void {
  const color = statusToColor(status);
  const fold = foldColor(status);
  const w = NOTE_W;
  const h = NOTE_H;
  const x = -w / 2;
  const y = -h / 2;

  ctx.save();

  // Apply skew transform: shear along Y based on wall side
  // Left wall runs top-right → bottom-left: as X increases, Y decreases (slope -0.5)
  // Right wall runs top-left → bottom-right: as X increases, Y increases (slope 0.5)
  const slope = wallSide === 'left' ? -0.5 : 0.5;
  ctx.transform(1, slope, 0, 1, anchorX, anchorY);

  // Note body polygon (with folded bottom-right corner)
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);                       // top edge
  ctx.lineTo(x + w, y + h - FOLD_SIZE);       // right edge (short)
  ctx.lineTo(x + w - FOLD_SIZE, y + h);       // diagonal fold
  ctx.lineTo(x, y + h);                       // bottom edge
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Folded corner triangle (darker overlay)
  ctx.beginPath();
  ctx.moveTo(x + w, y + h - FOLD_SIZE);
  ctx.lineTo(x + w - FOLD_SIZE, y + h - FOLD_SIZE);
  ctx.lineTo(x + w - FOLD_SIZE, y + h);
  ctx.closePath();
  ctx.fillStyle = fold;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Highlight border if this note is expanded
  if (isExpanded) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - FOLD_SIZE);
    ctx.lineTo(x + w - FOLD_SIZE, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();
}

/** Edge tile with position */
interface EdgeTile { tx: number; ty: number }

/**
 * Draw all kanban cards as sticky notes on the room walls.
 *
 * Cards are distributed left wall first (top-to-bottom, 2 per edge tile),
 * then right wall (left-to-right, 2 per edge tile).
 */
export function drawKanbanNotes(
  ctx: CanvasRenderingContext2D,
  cards: KanbanCard[],
  grid: TileGrid,
  cameraOrigin: { x: number; y: number },
  expandedNoteId?: string | null,
): void {
  if (cards.length === 0) return;

  // Reset hit areas for this frame
  noteHitAreas = [];

  // Left wall edge: leftmost non-void tile per row
  const leftEdge: EdgeTile[] = [];
  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      const tile = grid.tiles[ty][tx];
      if (tile == null) continue;
      if (tx === 0 || grid.tiles[ty][tx - 1] == null) {
        leftEdge.push({ tx, ty });
        break;
      }
    }
  }

  // Right wall edge: topmost non-void tile per column
  const rightEdge: EdgeTile[] = [];
  for (let tx = 0; tx < grid.width; tx++) {
    for (let ty = 0; ty < grid.height; ty++) {
      const tile = grid.tiles[ty][tx];
      if (tile == null) continue;
      if (ty === 0 || grid.tiles[ty - 1]?.[tx] == null) {
        rightEdge.push({ tx, ty });
        break;
      }
    }
  }

  const capacity = (leftEdge.length + rightEdge.length) * 2;
  const cardsToShow = cards.slice(0, capacity);

  let cardIndex = 0;

  // Fill left wall first: 2 notes per edge tile
  for (const { tx, ty } of leftEdge) {
    if (cardIndex >= cardsToShow.length) break;
    for (let slot = 0; slot < 2; slot++) {
      if (cardIndex >= cardsToShow.length) break;
      const card = cardsToShow[cardIndex++];
      const pos = leftWallNotePosition(tx, ty, slot as 0 | 1, cameraOrigin);
      const isExpanded = card.id === expandedNoteId;
      drawStickyNote(ctx, pos.x, pos.y, card.title, card.status, 'left', isExpanded);

      // Cache hit area
      const corners = computeSkewedCorners(pos.x, pos.y, NOTE_W, NOTE_H, 'left');
      noteHitAreas.push({ cardId: card.id, corners, wallSide: 'left' });
    }
  }

  // Fill right wall: 2 notes per edge tile
  for (const { tx, ty } of rightEdge) {
    if (cardIndex >= cardsToShow.length) break;
    for (let slot = 0; slot < 2; slot++) {
      if (cardIndex >= cardsToShow.length) break;
      const card = cardsToShow[cardIndex++];
      const pos = rightWallNotePosition(tx, ty, slot as 0 | 1, cameraOrigin);
      const isExpanded = card.id === expandedNoteId;
      drawStickyNote(ctx, pos.x, pos.y, card.title, card.status, 'right', isExpanded);

      // Cache hit area
      const corners = computeSkewedCorners(pos.x, pos.y, NOTE_W, NOTE_H, 'right');
      noteHitAreas.push({ cardId: card.id, corners, wallSide: 'right' });
    }
  }
}

/**
 * Draw an expanded sticky note overlay centered on the canvas.
 * Shows full title, status badge, and close hint.
 */
export function drawExpandedNote(
  ctx: CanvasRenderingContext2D,
  card: KanbanCard,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const panelW = 200;
  const panelH = 150;
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const px = cx - panelW / 2;
  const py = cy - panelH / 2;

  const color = statusToColor(card.status);
  const fold = foldColor(card.status);
  const foldSize = 16;

  ctx.save();

  // Semi-transparent backdrop
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Panel body with folded bottom-right corner
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + panelW, py);
  ctx.lineTo(px + panelW, py + panelH - foldSize);
  ctx.lineTo(px + panelW - foldSize, py + panelH);
  ctx.lineTo(px, py + panelH);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Fold triangle
  ctx.beginPath();
  ctx.moveTo(px + panelW, py + panelH - foldSize);
  ctx.lineTo(px + panelW - foldSize, py + panelH - foldSize);
  ctx.lineTo(px + panelW - foldSize, py + panelH);
  ctx.closePath();
  ctx.fillStyle = fold;
  ctx.fill();

  // Status badge
  ctx.font = '6px "Press Start 2P"';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const badgeText = card.status.toUpperCase();
  const badgeW = ctx.measureText(badgeText).width + 8;
  const badgeX = px + 8;
  const badgeY = py + 12;
  ctx.fillRect(badgeX, badgeY, badgeW, 12);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(badgeText, badgeX + 4, badgeY + 3);

  // Title (word-wrapped)
  ctx.font = '8px "Press Start 2P"';
  ctx.fillStyle = '#1a1a2e';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const maxLineW = panelW - 24;
  const words = card.title.split(' ');
  let line = '';
  let lineY = py + 34;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxLineW && line) {
      ctx.fillText(line, px + 12, lineY);
      line = word;
      lineY += 14;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, px + 12, lineY);
  }

  // Close hint
  ctx.font = '5px "Press Start 2P"';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('click to close', cx, py + panelH - 10);

  ctx.restore();
}
