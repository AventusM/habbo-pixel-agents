// src/render/sceneRenderer.ts
// World-space + screen-space draw pipeline for the room canvas (M003/S03).
// Extracted out of RoomCanvas so the component keeps heightmap/agent/kanban
// data wiring and the stage keeps canvas/input/frame machinery. Pure with
// respect to component state: every input arrives in SceneInputs.

import { depthSort } from '../isoTypes.js';
import type { Renderable, TileGrid, HsbColor } from '../isoTypes.js';
import { tileToScreen, TILE_W_HALF, TILE_H_HALF } from '../isometricMath.js';
import { applyCameraTransform, type CameraState } from '../cameraController.js';
import { blitVisibleSlice } from './layers.js';
import {
  drawHoverHighlight,
  drawFurnitureFootprint,
  type EditorState,
} from '../isoLayoutEditor.js';
import { getFurnitureDimensions } from '../furnitureRegistry.js';
import { drawFurnitureActiveOverlay } from '../isoFurnitureRenderer.js';
import type { FurnitureSpec, MultiTileFurnitureSpec } from '../isoFurnitureRenderer.js';
import { drawTeleportFlash } from '../teleportEffect.js';
import type { TeleportEffect } from '../teleportEffect.js';
import { drawNameTag } from '../isoNameTagRenderer.js';
import { drawSpeechBubble } from '../isoBubbleRenderer.js';
import {
  drawKanbanNotes,
  drawExpandedNote,
  drawExpandedAggregateNote,
  type KanbanRenderState,
} from '../isoKanbanRenderer.js';
import { drawOrchestrationOverlay, type OrchestrationState } from '../isoOrchestrationOverlay.js';
import { filterKanbanCards, type KanbanFilterMode } from '../kanbanFilter.js';
import type { SectionManager } from '../sectionManager.js';
import type { SpriteCache } from '../isoSpriteCache.js';
import type { AvatarSpec, AvatarRenderer } from '../avatarRendererTypes.js';
import type { AvatarSelectionManager } from '../avatarSelection.js';
import type { KanbanCard } from '../agentTypes.js';

const AVATAR_GROUND_Y = 0;
const AVATAR_HEIGHT = 65;

export interface SceneInputs {
  ctx: CanvasRenderingContext2D;
  canvasW: number;
  canvasH: number;
  cam: CameraState;
  cameraOrigin: { x: number; y: number };
  roomBuffer: OffscreenCanvas | HTMLCanvasElement | null;
  roomSize: { w: number; h: number };
  notesBuffer: OffscreenCanvas | HTMLCanvasElement | null;
  notesSize: { w: number; h: number };
  grid: TileGrid;
  editorState: EditorState;
  gridFurniture: FurnitureSpec[];
  multiTileFurniture: MultiTileFurnitureSpec[];
  furnitureRenderables: Renderable[];
  spriteCache: SpriteCache | undefined;
  avatars: AvatarSpec[];
  activeRenderer: AvatarRenderer;
  agentToolText: Map<string, string>;
  sectionManager: SectionManager | null;
  selectionManager: AvatarSelectionManager;
  teleportEffects: TeleportEffect[];
  orchState: OrchestrationState;
  kanbanCards: KanbanCard[];
  kanbanFilter: KanbanFilterMode;
  expandedNote: string | null;
  expandedAggregate: 'todo' | 'done' | null;
  noteOrigin: 'todo' | 'done' | null;
  kanbanRenderState: KanbanRenderState;
}

/**
 * Draw one frame: camera-transformed world layers + avatars + overlays, then
 * screen-space HUD. Mutates the kanban render state (per-frame hit areas) and
 * returns the surviving teleport effects.
 */
export function drawScene(s: SceneInputs, nowMs: number): TeleportEffect[] {
  const { ctx, canvasW, canvasH, cam, cameraOrigin } = s;

  ctx.clearRect(0, 0, canvasW, canvasH);

  // --- Begin camera-transformed world-space drawing ---
  ctx.save();
  applyCameraTransform(ctx, cam, canvasW, canvasH);

  // Room buffer covers the full room extent; blit only the visible slice
  // (1:1 copy) instead of scaling the whole buffer through the transform
  if (s.roomSize.w > 0 && s.roomBuffer) {
    blitVisibleSlice(ctx, s.roomBuffer, s.roomSize, cam, canvasW, canvasH);
  } else if (s.roomBuffer) {
    ctx.drawImage(s.roomBuffer, 0, 0, canvasW, canvasH);
  }

  // Kanban sticky notes on walls — drawn into a cached world-space layer
  if (s.kanbanCards.length > 0 && s.notesBuffer) {
    blitVisibleSlice(ctx, s.notesBuffer, s.notesSize, cam, canvasW, canvasH);
  }

  // Draw hover highlight if tile is hovered (editor mode)
  if (s.editorState.hoveredTile) {
    const { x, y, z } = s.editorState.hoveredTile;

    if (s.editorState.mode === 'furniture') {
      // Show multi-tile footprint preview for furniture placement
      const furnitureType = s.editorState.selectedFurniture || 'hc_chr';
      const dir = s.editorState.furnitureDirection ?? 0;
      const { widthTiles, heightTiles } = s.spriteCache
        ? getFurnitureDimensions(furnitureType, s.spriteCache, dir)
        : { widthTiles: 1, heightTiles: 1 };

      drawFurnitureFootprint(
        ctx, x, y, z,
        widthTiles, heightTiles,
        s.grid,
        s.gridFurniture,
        s.multiTileFurniture,
        cameraOrigin,
      );

      // Direction arrow at origin tile
      const { x: sx, y: sy } = tileToScreen(x, y, z);
      const arrowCx = sx + cameraOrigin.x;
      const arrowCy = sy + TILE_H_HALF + cameraOrigin.y;
      const arrows: Record<number, string> = { 0: '\u2197', 2: '\u2198', 4: '\u2199', 6: '\u2196' };
      ctx.save();
      ctx.font = '14px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 100, 0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(arrows[dir] || '?', arrowCx, arrowCy - 4);
      ctx.restore();
    } else {
      // Single tile highlight for paint/color modes
      drawHoverHighlight(ctx, x, y, z, cameraOrigin);
    }
  }

  // Render furniture + avatars with unified depth sorting
  const dynamicRenderables = [...s.furnitureRenderables];

  if (s.spriteCache && s.avatars.length > 0) {
    for (const spec of s.avatars) {
      const renderable = s.activeRenderer.createRenderable(spec, s.spriteCache);
      if (!renderable) continue;

      // Camera transform is already applied; just translate by cameraOrigin for avatar world positioning
      const originalDraw = renderable.draw;
      renderable.draw = (drawCtx) => {
        drawCtx.save();
        drawCtx.translate(cameraOrigin.x, cameraOrigin.y);
        originalDraw(drawCtx);
        drawCtx.restore();
      };

      dynamicRenderables.push(renderable);
    }
  }

  const sorted = depthSort(dynamicRenderables);
  for (const r of sorted) {
    r.draw(ctx);
  }

  // Draw furniture activity overlays (lamp glow, monitor screen glow)
  if (s.sectionManager) {
    for (const f of s.gridFurniture) {
      if (f.name === 'tv_flat' || f.name === 'hc_lmp') {
        let isActive = false;
        for (const section of s.sectionManager.getAllSections()) {
          if (section.agentIds.length > 0) {
            const sectionLayout = s.sectionManager.getTemplate().sections.find(sec => sec.team === section.team);
            if (sectionLayout) {
              const inSection = sectionLayout.furniture.some(sf => sf.tileX === f.tileX && sf.tileY === f.tileY);
              if (inSection) {
                isActive = true;
                break;
              }
            }
          }
        }
        const { x: sx, y: sy } = tileToScreen(f.tileX, f.tileY, f.tileZ);
        drawFurnitureActiveOverlay(ctx, f.name, sx + cameraOrigin.x, sy + cameraOrigin.y + TILE_H_HALF, isActive);
      }
    }
  }

  // Draw active teleport effects (after avatars, before UI overlays)
  s.teleportEffects = s.teleportEffects.filter(
    effect => drawTeleportFlash(ctx, effect, performance.now())
  );

  if (s.spriteCache && s.avatars.length > 0) {
    // Draw selection highlight
    const selectedId = s.selectionManager.selectedAvatarId;
    if (selectedId) {
      const selectedAvatar = s.avatars.find(a => a.id === selectedId);
      if (selectedAvatar) {
        drawSelectionHighlight(ctx, selectedAvatar, cameraOrigin, nowMs);
      }
    }

    // UI Overlays: name tags + speech bubbles (world-positioned, inside camera transform)
    ctx.font = '8px "Press Start 2P"';
    for (const avatar of s.avatars) {
      const { x: screenX, y: screenY } = tileToScreen(avatar.tileX, avatar.tileY, avatar.tileZ);
      const offsetX = avatar.screenOffsetX || 0;
      const offsetY = avatar.screenOffsetY || 0;
      const headY = screenY + AVATAR_GROUND_Y - AVATAR_HEIGHT + offsetY;

      const status = avatar.state === 'idle' || avatar.state === 'sit' ? 'idle' : 'active';

      ctx.save();
      ctx.translate(cameraOrigin.x, cameraOrigin.y);
      drawNameTag(ctx, {
        name: avatar.displayName || avatar.id,
        status,
        anchorX: screenX + offsetX,
        anchorY: headY,
      });
      ctx.restore();
    }

    for (const avatar of s.avatars) {
      // Skip speech bubbles during spawn/despawn animations
      if (avatar.state === 'spawning' || avatar.state === 'despawning') continue;

      const { x: screenX, y: screenY } = tileToScreen(avatar.tileX, avatar.tileY, avatar.tileZ);
      const offsetX = avatar.screenOffsetX || 0;
      const offsetY = avatar.screenOffsetY || 0;
      const headY = screenY + AVATAR_GROUND_Y - AVATAR_HEIGHT + offsetY;

      const toolText = s.agentToolText.get(avatar.id);

      ctx.save();
      ctx.translate(cameraOrigin.x, cameraOrigin.y);
      drawSpeechBubble(ctx, {
        text: toolText || '',
        anchorX: screenX + offsetX,
        anchorY: headY - 30,
        isWaiting: !toolText,
      }, nowMs);
      ctx.restore();
    }
  }

  // --- End camera-transformed world-space drawing ---
  ctx.restore();

  // Screen-space overlays (drawn OUTSIDE camera transform)

  // Expanded sticky note overlay (drawn last, on top of everything)
  if (s.expandedNote && s.kanbanCards.length > 0) {
    const visibleCards = filterKanbanCards(s.kanbanCards, s.kanbanFilter);
    const expandedCard = visibleCards.find(c => c.id === s.expandedNote);
    if (expandedCard) {
      drawExpandedNote(
        ctx,
        expandedCard,
        canvasW,
        canvasH,
        { canBack: s.noteOrigin !== null },
        s.kanbanRenderState,
      );
    }
  }

  // Expanded aggregate note overlay
  if (s.expandedAggregate && s.kanbanCards.length > 0) {
    const aggType = s.expandedAggregate;
    const IP = ['In Progress', 'Doing'];
    const DONE = ['Done'];
    const visibleCards = filterKanbanCards(s.kanbanCards, s.kanbanFilter);
    const aggCards = aggType === 'todo'
      ? visibleCards.filter(c => !DONE.includes(c.status) && !IP.includes(c.status))
      : visibleCards.filter(c => DONE.includes(c.status));
    if (aggCards.length > 0) {
      drawExpandedAggregateNote(ctx, aggType, aggCards, canvasW, canvasH, s.kanbanRenderState);
    }
  }

  // Orchestration overlay (right-side HUD)
  drawOrchestrationOverlay(ctx, s.orchState, canvasW, canvasH);

  return s.teleportEffects;
}

/** Draw a pulsing cyan rhombus outline at the selected avatar's tile. */
function drawSelectionHighlight(
  ctx: CanvasRenderingContext2D,
  avatar: AvatarSpec,
  cameraOrigin: { x: number; y: number },
  currentTimeMs: number,
): void {
  const { x: sx, y: sy } = tileToScreen(avatar.tileX, avatar.tileY, avatar.tileZ);
  const ox = avatar.screenOffsetX || 0;
  const oy = avatar.screenOffsetY || 0;
  const cx = sx + ox + cameraOrigin.x;
  const cy = sy + oy + cameraOrigin.y + TILE_H_HALF;

  const pulse = 0.7 + 0.3 * Math.sin(currentTimeMs / 300);

  ctx.save();
  ctx.strokeStyle = `rgba(0, 255, 255, ${pulse})`;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(cx, cy - TILE_H_HALF);
  ctx.lineTo(cx + TILE_W_HALF, cy);
  ctx.lineTo(cx, cy + TILE_H_HALF);
  ctx.lineTo(cx - TILE_W_HALF, cy);
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}
