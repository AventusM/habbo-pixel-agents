// src/isoKanbanRenderer.ts
// Renders GitHub Projects kanban cards as wall-mounted sticky notes in the isometric room.
// Notes are drawn with isometric skew transforms to appear "on" wall surfaces,
// with folded corners and click-to-expand interaction.
// Large aggregate notes for Todo and Done columns;
// small individual notes for In Progress cards.

import type { TileGrid } from './isoTypes.js';
import type { KanbanCard } from './agentTypes.js';
import { tileToScreen, TILE_W_HALF, TILE_H_HALF, WALL_HEIGHT } from './isometricMath.js';

// Status column → sticky note background color
const KANBAN_COLORS: Record<string, string> = {
  'Todo': '#fef08a',
  'In Progress': '#93c5fd',
  'Done': '#86efac',
  'No Status': '#fda4af',
  // Azure DevOps status names
  'To Do': '#fef08a',
  'Doing': '#93c5fd',
};

// Darker shade for folded corner per status
const KANBAN_FOLD_COLORS: Record<string, string> = {
  'Todo': '#eab308',
  'In Progress': '#3b82f6',
  'Done': '#22c55e',
  'No Status': '#f43f5e',
  // Azure DevOps status names
  'To Do': '#eab308',
  'Doing': '#3b82f6',
};

/** Sticky note dimensions (local space, before skew) */
const NOTE_W = 12;
const NOTE_H = 18;
const FOLD_SIZE = 6;

/** Large aggregate note dimensions */
const LARGE_NOTE_W = 58;
const LARGE_NOTE_H = 90;
const LARGE_FOLD_SIZE = 12;
const LARGE_NOTE_MAX_CHARS = 9;
const LARGE_NOTE_MAX_LINES = 6;

/** Sentinel card IDs for aggregate notes */
const TODO_ID = '__todo__';
const DONE_ID = '__done__';

/** Hit area for a rendered note (screen-space quad corners) */
export interface NoteHitArea {
  cardId: string;
  corners: [Point, Point, Point, Point]; // TL, TR, BR, BL in screen space
  wallSide: 'left' | 'right';
  aggregateType?: 'todo' | 'done';
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

/** Map work item type to a badge background color */
function workItemTypeColor(type: string): string {
  switch (type?.toLowerCase()) {
    case 'user story': return '#3b82f6';
    case 'bug': return '#ef4444';
    case 'task': return '#8b5cf6';
    case 'feature': return '#f59e0b';
    case 'epic': return '#06b6d4';
    default: return '#6b7280';
  }
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


/** Edge tile with position */
interface EdgeTile { tx: number; ty: number }


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
  isLinked?: boolean,
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

  // Glow effect for linked notes (agent actively working on this ticket)
  if (isLinked) {
    ctx.shadowColor = '#4aff4a';
    ctx.shadowBlur = 8;
  }

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
  ctx.strokeStyle = isLinked ? '#4aff4a' : 'rgba(0,0,0,0.5)';
  ctx.lineWidth = isLinked ? 2 : 1;
  ctx.stroke();

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

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

  // "WORKING" badge for linked notes
  if (isLinked) {
    ctx.font = '4px "Press Start 2P"';
    ctx.fillStyle = '#22c55e';
    const badgeText = 'WORKING';
    const badgeW = ctx.measureText(badgeText).width + 4;
    ctx.fillStyle = '#166534';
    ctx.fillRect(x + w - badgeW - 2, y + 2, badgeW, 7);
    ctx.fillStyle = '#4aff4a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(badgeText, x + w - badgeW, y + 3);
  }

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

/**
 * Draw a large aggregate sticky note with isometric skew.
 * Displays a header label, list of card titles, and overflow indicator.
 */
function drawLargeNote(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  label: string,
  cards: KanbanCard[],
  color: string,
  fold: string,
  wallSide: 'left' | 'right',
  isExpanded: boolean,
): void {
  const w = LARGE_NOTE_W;
  const h = LARGE_NOTE_H;
  const x = -w / 2;
  const y = -h / 2;

  ctx.save();

  const slope = wallSide === 'left' ? -0.5 : 0.5;
  ctx.transform(1, slope, 0, 1, anchorX, anchorY);

  // Note body polygon (with folded bottom-right corner)
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - LARGE_FOLD_SIZE);
  ctx.lineTo(x + w - LARGE_FOLD_SIZE, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Folded corner triangle
  ctx.beginPath();
  ctx.moveTo(x + w, y + h - LARGE_FOLD_SIZE);
  ctx.lineTo(x + w - LARGE_FOLD_SIZE, y + h - LARGE_FOLD_SIZE);
  ctx.lineTo(x + w - LARGE_FOLD_SIZE, y + h);
  ctx.closePath();
  ctx.fillStyle = fold;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Header label
  ctx.font = '5px "Press Start 2P"';
  ctx.fillStyle = '#1a1a2e';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + 3, y + 3);

  // Separator line under header
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 12);
  ctx.lineTo(x + w - 2, y + 12);
  ctx.stroke();

  // Card title list
  ctx.font = '4px "Press Start 2P"';
  ctx.fillStyle = '#333';
  const visibleCards = cards.slice(0, LARGE_NOTE_MAX_LINES);
  for (let i = 0; i < visibleCards.length; i++) {
    let title = visibleCards[i].title;
    if (title.length > LARGE_NOTE_MAX_CHARS) {
      title = title.substring(0, LARGE_NOTE_MAX_CHARS - 1) + '\u2026';
    }
    ctx.fillText(title, x + 3, y + 16 + i * 8);
  }

  // Overflow indicator
  if (cards.length > LARGE_NOTE_MAX_LINES) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(`+${cards.length - LARGE_NOTE_MAX_LINES} more`, x + 3, y + 16 + LARGE_NOTE_MAX_LINES * 8);
  }

  // Highlight border if expanded
  if (isExpanded) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - LARGE_FOLD_SIZE);
    ctx.lineTo(x + w - LARGE_FOLD_SIZE, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw all kanban cards as sticky notes on the room walls.
 *
 * Todo → large aggregate note on left wall.
 * Done → large aggregate note on left wall (near corner).
 * In Progress → small individual notes distributed across remaining edge tiles.
 */
export function drawKanbanNotes(
  ctx: CanvasRenderingContext2D,
  cards: KanbanCard[],
  grid: TileGrid,
  cameraOrigin: { x: number; y: number },
  expandedNoteId?: string | null,
  expandedAggregateType?: 'todo' | 'done' | null,
  activeLinkedTicketIds?: Set<string>,
): void {
  if (cards.length === 0) return;

  // Reset hit areas for this frame
  noteHitAreas = [];

  // Partition cards into three groups.
  // GitHub Projects: 'Todo', 'In Progress', 'Done', 'No Status'
  // Azure DevOps:    'To Do', 'Doing', 'Done', 'No Status'
  const TODO_STATUSES = ['Todo', 'To Do', 'No Status'];
  const IP_STATUSES = ['In Progress', 'Doing'];
  const DONE_STATUSES = ['Done'];

  const todoCards = cards.filter(c => TODO_STATUSES.includes(c.status));
  const inProgressCards = cards.filter(c => IP_STATUSES.includes(c.status));
  const doneCards = cards.filter(c => DONE_STATUSES.includes(c.status));
  // Unrecognised statuses fall into todo
  const unmatchedCards = cards.filter(c => !TODO_STATUSES.includes(c.status) && !IP_STATUSES.includes(c.status) && !DONE_STATUSES.includes(c.status));
  const allTodoCards = [...todoCards, ...unmatchedCards];

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

  // TODO at the far left of the left wall (near front)
  const todoIdx = Math.max(0, leftEdge.length - 2);
  // DONE at the far right of the left wall (near back corner)
  const doneIdx = Math.min(1, leftEdge.length - 1);

  // Helper: compute left-wall large note position for a given edge tile
  function largeNotePos(tile: EdgeTile) {
    const { x: sx, y: sy } = tileToScreen(tile.tx, tile.ty, 0);
    return {
      x: sx + cameraOrigin.x - TILE_W_HALF * 0.5,
      y: sy + cameraOrigin.y - WALL_HEIGHT * 0.5,
    };
  }

  // Pixel offset to push large notes away from the small note zone
  // Left wall slope: moving toward front = -X, +0.5Y
  const LARGE_NOTE_OFFSET = 10;

  // Draw large todo note at far left of left wall (pushed toward front)
  if (allTodoCards.length > 0 && leftEdge.length > 0) {
    const pos = largeNotePos(leftEdge[todoIdx]);
    pos.x -= LARGE_NOTE_OFFSET;
    pos.y += LARGE_NOTE_OFFSET * 0.5;
    const isExpanded = expandedAggregateType === 'todo';
    drawLargeNote(ctx, pos.x, pos.y, 'TODO', allTodoCards, '#fef08a', '#eab308', 'left', isExpanded);
    const corners = computeSkewedCorners(pos.x, pos.y, LARGE_NOTE_W, LARGE_NOTE_H, 'left');
    noteHitAreas.push({ cardId: TODO_ID, corners, wallSide: 'left', aggregateType: 'todo' });
  }

  // Draw large done note at far right of left wall (pushed toward back corner)
  if (doneCards.length > 0 && leftEdge.length > 0 && doneIdx !== todoIdx) {
    const pos = largeNotePos(leftEdge[doneIdx]);
    pos.x += LARGE_NOTE_OFFSET;
    pos.y -= LARGE_NOTE_OFFSET * 0.5;
    const isExpanded = expandedAggregateType === 'done';
    drawLargeNote(ctx, pos.x, pos.y, 'DONE', doneCards, '#86efac', '#22c55e', 'left', isExpanded);
    const corners = computeSkewedCorners(pos.x, pos.y, LARGE_NOTE_W, LARGE_NOTE_H, 'left');
    noteHitAreas.push({ cardId: DONE_ID, corners, wallSide: 'left', aggregateType: 'done' });
  }

  // Distribute small In Progress notes between the DONE and TODO positions.
  const lo = Math.min(doneIdx, todoIdx);
  const hi = Math.max(doneIdx, todoIdx);
  const leftSmallTiles = leftEdge.filter((_, i) => i > lo && i < hi).reverse();

  const smallCapacity = leftSmallTiles.length * 2;
  const ipCardsToShow = inProgressCards.slice(0, smallCapacity);
  let cardIndex = 0;

  for (const { tx, ty } of leftSmallTiles) {
    if (cardIndex >= ipCardsToShow.length) break;
    for (let slot = 0; slot < 2; slot++) {
      if (cardIndex >= ipCardsToShow.length) break;
      const card = ipCardsToShow[cardIndex++];
      const pos = leftWallNotePosition(tx, ty, slot as 0 | 1, cameraOrigin);
      const isExpanded = card.id === expandedNoteId;
      const isLinked = activeLinkedTicketIds?.has(card.id) ?? false;
      drawStickyNote(ctx, pos.x, pos.y, card.title, card.status, 'left', isExpanded, isLinked);
      const corners = computeSkewedCorners(pos.x, pos.y, NOTE_W, NOTE_H, 'left');
      noteHitAreas.push({ cardId: card.id, corners, wallSide: 'left' });
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
  // Calculate dynamic panel height based on content
  const baseHeight = 100;
  const childrenHeight = card.children ? (card.children.length * 14 + 20) : 0;
  const prsHeight = card.linkedPrs ? (card.linkedPrs.length * 14 + 20) : 0;
  const assigneeHeight = card.assignee ? 16 : 0;

  const panelW = 240;
  const panelH = Math.min(350, baseHeight + childrenHeight + prsHeight + assigneeHeight);
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

  let curY = py + 10;

  // Work item type badge + status badge (side by side)
  ctx.font = '6px "Press Start 2P"';
  if (card.workItemType) {
    const typeText = card.workItemType.toUpperCase();
    const typeW = ctx.measureText(typeText).width + 8;
    ctx.fillStyle = workItemTypeColor(card.workItemType);
    ctx.fillRect(px + 8, curY, typeW, 12);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(typeText, px + 12, curY + 3);

    // Status badge after type
    const badgeText = card.status.toUpperCase();
    const badgeW = ctx.measureText(badgeText).width + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(px + 8 + typeW + 4, curY, badgeW, 12);
    ctx.fillStyle = '#fff';
    ctx.fillText(badgeText, px + 12 + typeW + 4, curY + 3);
  } else {
    const badgeText = card.status.toUpperCase();
    const badgeW = ctx.measureText(badgeText).width + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(px + 8, curY, badgeW, 12);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(badgeText, px + 12, curY + 3);
  }
  curY += 18;

  // Title (word-wrapped)
  ctx.font = '8px "Press Start 2P"';
  ctx.fillStyle = '#1a1a2e';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const maxLineW = panelW - 24;
  const words = card.title.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxLineW && line) {
      ctx.fillText(line, px + 12, curY);
      line = word;
      curY += 14;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, px + 12, curY);
    curY += 14;
  }

  // Assignee
  if (card.assignee) {
    curY += 4;
    ctx.font = '6px "Press Start 2P"';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(`👤 ${card.assignee}`, px + 12, curY);
    curY += 14;
  }

  // Children (sub-tasks)
  if (card.children && card.children.length > 0) {
    curY += 6;
    ctx.font = '6px "Press Start 2P"';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const completed = card.children.filter(c => c.completed).length;
    ctx.fillText(`SUB-TASKS (${completed}/${card.children.length})`, px + 12, curY);
    curY += 12;

    // Progress bar
    const barW = panelW - 24;
    const barH = 4;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(px + 12, curY, barW, barH);
    if (card.children.length > 0) {
      ctx.fillStyle = completed === card.children.length ? '#22c55e' : '#3b82f6';
      ctx.fillRect(px + 12, curY, barW * (completed / card.children.length), barH);
    }
    curY += 8;

    for (const child of card.children) {
      const check = child.completed ? '✓' : '○';
      const childColor = child.completed ? 'rgba(0,0,0,0.35)' : '#1a1a2e';
      ctx.fillStyle = childColor;
      const childTitle = child.title.length > 28
        ? child.title.slice(0, 26) + '..'
        : child.title;
      ctx.fillText(`${check} ${childTitle}`, px + 14, curY);
      curY += 12;
    }
  }

  // Linked PRs
  if (card.linkedPrs && card.linkedPrs.length > 0) {
    curY += 6;
    ctx.font = '6px "Press Start 2P"';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(`PULL REQUESTS (${card.linkedPrs.length})`, px + 12, curY);
    curY += 12;

    for (const pr of card.linkedPrs) {
      const prIcon = pr.status === 'completed' ? '✓' : pr.status === 'abandoned' ? '✗' : '⬤';
      const prColor = pr.status === 'completed' ? '#22c55e' :
                       pr.status === 'abandoned' ? '#ef4444' : '#3b82f6';
      ctx.fillStyle = prColor;
      ctx.beginPath();
      ctx.arc(px + 18, curY + 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a2e';
      const prTitle = pr.title.length > 26
        ? pr.title.slice(0, 24) + '..'
        : pr.title;
      ctx.fillText(prTitle, px + 24, curY);
      curY += 12;
    }
  }

  // Close hint
  ctx.font = '5px "Press Start 2P"';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('click to close', cx, py + panelH - 10);

  ctx.restore();
}

/**
 * Draw an expanded aggregate note overlay centered on the canvas.
 * Shows all cards in the aggregate with status color dots and titles.
 */
export function drawExpandedAggregateNote(
  ctx: CanvasRenderingContext2D,
  aggregateType: 'todo' | 'done',
  cards: KanbanCard[],
  canvasWidth: number,
  canvasHeight: number,
): void {
  const label = aggregateType === 'todo' ? 'TODO' : 'DONE';
  const color = aggregateType === 'todo' ? '#fef08a' : '#86efac';
  const fold = aggregateType === 'todo' ? '#eab308' : '#22c55e';

  const panelW = 220;
  const lineHeight = 16;
  const headerHeight = 40;
  const footerHeight = 20;
  const panelH = Math.min(300, headerHeight + cards.length * lineHeight + footerHeight);
  const foldSize = 16;

  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const px = cx - panelW / 2;
  const py = cy - panelH / 2;

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

  // Header label + count badge
  ctx.font = '7px "Press Start 2P"';
  ctx.fillStyle = '#1a1a2e';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, px + 10, py + 10);

  // Count badge
  ctx.font = '5px "Press Start 2P"';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const countText = `${cards.length}`;
  const countW = ctx.measureText(countText).width + 6;
  const countX = px + 10 + ctx.measureText(label).width + 8;
  ctx.fillRect(countX, py + 10, countW, 10);
  // Re-set font since measureText may have been affected
  ctx.font = '5px "Press Start 2P"';
  ctx.fillStyle = '#fff';
  ctx.fillText(countText, countX + 3, py + 12);

  // Separator
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 8, py + 28);
  ctx.lineTo(px + panelW - 8, py + 28);
  ctx.stroke();

  // Card list
  ctx.font = '6px "Press Start 2P"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const maxVisibleCards = Math.floor((panelH - headerHeight - footerHeight) / lineHeight);
  const visibleCards = cards.slice(0, maxVisibleCards);

  for (let i = 0; i < visibleCards.length; i++) {
    const card = visibleCards[i];
    const itemY = py + headerHeight + i * lineHeight;

    // Status color dot
    ctx.fillStyle = statusToColor(card.status);
    ctx.beginPath();
    ctx.arc(px + 14, itemY + 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Title (truncated to 22 chars)
    let title = card.title;
    if (title.length > 22) {
      title = title.substring(0, 21) + '\u2026';
    }
    ctx.fillStyle = '#1a1a2e';
    ctx.fillText(title, px + 22, itemY + 2);
  }

  // Close hint
  ctx.font = '5px "Press Start 2P"';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('click to close', cx, py + panelH - 10);

  ctx.restore();
}
