// src/hooks/useRoomInteraction.ts
// Canvas click + context-menu interaction (M008/S04 T03, extracted from
// RoomCanvas under the D021 convention): sticky-note hit testing, editor
// paint/color/furniture placement, avatar selection, and right-click chair
// sit/move with the rAF sit-arrival loop. Behavior-preserving move — every
// branch and early return is unchanged.
import { useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import { kanbanStore } from '../state/kanbanStore.js';
import { screenToWorld } from '../cameraController.js';
import { toggleTileWalkability, setTileColor } from '../isoLayoutEditor.js';
import { isChairType } from '../furnitureRegistry.js';
import { computeBlockedTiles } from '../isoPathfinding.js';
import { pointInQuad, type KanbanRenderState } from '../isoKanbanRenderer.js';
import type { HsbColor } from '../isoTypes.js';
import type { AvatarManager } from '../avatarManager.js';
import type { AvatarSelectionManager } from '../avatarSelection.js';
import type { IdleWanderManager } from '../idleWander.js';
import type { CanvasStage } from '../render/CanvasStage.js';
import type { RoomRenderState } from './useRoomInput.js';

export interface UseRoomInteractionOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stageRef: RefObject<CanvasStage | null>;
  renderState: RefObject<RoomRenderState>;
  avatarManager: AvatarManager;
  selectionManager: AvatarSelectionManager;
  idleWander: IdleWanderManager;
  ensureInitialized: () => Promise<void>;
  mouseToTile: (clientX: number, clientY: number) => { tileX: number; tileY: number } | null;
  reRenderRoom: () => void;
  selectedColor: HsbColor;
  expandedNoteRef: RefObject<string | null>;
  noteOriginRef: RefObject<'todo' | 'done' | null>;
  expandedAggregateRef: RefObject<'todo' | 'done' | null>;
  kanbanRenderStateRef: RefObject<KanbanRenderState>;
  walkableBoothsRef: RefObject<Set<string>>;
}

export function useRoomInteraction({
  canvasRef,
  stageRef,
  renderState,
  avatarManager,
  selectionManager,
  idleWander,
  ensureInitialized,
  mouseToTile,
  reRenderRoom,
  selectedColor,
  expandedNoteRef,
  noteOriginRef,
  expandedAggregateRef,
  kanbanRenderStateRef,
  walkableBoothsRef,
}: UseRoomInteractionOptions) {
  const handleClick = useCallback(
    async (event: ReactMouseEvent<HTMLCanvasElement>) => {
      // Skip click if user was dragging the camera
      const stage = stageRef.current;
      if (stage?.didDrag) {
        stage.clearDidDrag();
        return;
      }

      if (!renderState.current.grid || !canvasRef.current || !stage) return;

      // --- Sticky note click detection (before tile logic) ---
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const cssScaleX = canvas.offsetWidth / rect.width;
      const cssScaleY = canvas.offsetHeight / rect.height;
      const screenX = (event.clientX - rect.left) * cssScaleX;
      const screenY = (event.clientY - rect.top) * cssScaleY;
      // Notes are drawn inside camera transform, so apply inverse to get world-space coords
      const noteWorld = screenToWorld(screenX, screenY, stage.camera, canvas.offsetWidth, canvas.offsetHeight);
      const noteClickX = noteWorld.x;
      const noteClickY = noteWorld.y;

      // If any note overlay is expanded, a click closes it — unless it hits the
      // detail panel's nav bar (prev/back/next), its footer action zone (open the
      // issue in the browser), or an aggregate list row (open that card's panel)
      if (expandedNoteRef.current || expandedAggregateRef.current) {
        if (expandedNoteRef.current) {
          const nav = kanbanRenderStateRef.current.expandedNoteNavRects;
          const inRect = (r: { x: number; y: number; w: number; h: number }) =>
            screenX >= r.x && screenX <= r.x + r.w && screenY >= r.y && screenY <= r.y + r.h;
          const visibleCards = kanbanStore.visibleCards();
          if (nav && visibleCards.length > 0) {
            const idx = Math.max(0, visibleCards.findIndex(c => c.id === expandedNoteRef.current));
            if (inRect(nav.prev)) {
              expandedNoteRef.current = visibleCards[(idx - 1 + visibleCards.length) % visibleCards.length].id;
              return;
            }
            if (inRect(nav.next)) {
              expandedNoteRef.current = visibleCards[(idx + 1) % visibleCards.length].id;
              return;
            }
            if (nav.back && inRect(nav.back) && noteOriginRef.current) {
              expandedAggregateRef.current = noteOriginRef.current;
              noteOriginRef.current = null;
              expandedNoteRef.current = null;
              return;
            }
          }
          const action = kanbanRenderStateRef.current.expandedNoteActionRect;
          if (action && action.url) {
            const inFooter =
              screenX >= action.x && screenX <= action.x + action.w &&
              screenY >= action.y && screenY <= action.y + action.h;
            if (inFooter) {
              window.open(action.url, '_blank', 'noopener');
              return;
            }
          }
        }
        if (expandedAggregateRef.current) {
          const row = kanbanRenderStateRef.current.aggregateRowHitAreas.find(
            (r) => screenX >= r.x && screenX <= r.x + r.w && screenY >= r.y && screenY <= r.y + r.h,
          );
          if (row) {
            noteOriginRef.current = expandedAggregateRef.current;
            expandedAggregateRef.current = null;
            expandedNoteRef.current = row.cardId;
            return;
          }
        }
        expandedNoteRef.current = null;
        expandedAggregateRef.current = null;
        noteOriginRef.current = null;
        return;
      }

      // Check if click hit a wall note
      const hitAreas = kanbanRenderStateRef.current.noteHitAreas;
      for (const area of hitAreas) {
        if (pointInQuad(noteClickX, noteClickY, area.corners)) {
          if (area.aggregateType) {
            expandedAggregateRef.current = area.aggregateType;
          } else {
            expandedNoteRef.current = area.cardId;
            noteOriginRef.current = null;
          }
          return;
        }
      }

      // Furniture placement/selection/move/delete is owned by
      // useRoomFurnitureEditor via mousedown/mousemove/mouseup.
      if (renderState.current.editorState.mode === 'furniture') return;

      const clickedCoords = mouseToTile(event.clientX, event.clientY);
      if (!clickedCoords) return;

      const { tileX, tileY } = clickedCoords;

      // Initialize audio on first click (autoplay policy compliance)
      await ensureInitialized();

      // Editor modes take priority
      if (renderState.current.editorState.mode === 'paint') {
        toggleTileWalkability(renderState.current.grid, tileX, tileY);
        reRenderRoom();
        return;
      }

      if (renderState.current.editorState.mode === 'color') {
        setTileColor(renderState.current.tileColorMap, tileX, tileY, selectedColor);
        reRenderRoom();
        return;
      }

      // View mode: avatar selection only (movement handled by right-click)

      // Check if clicked tile has an avatar standing on it
      const clickedAvatar = avatarManager.getAvatarAtTile(tileX, tileY);

      if (clickedAvatar) {
        // Select this avatar for right-click movement targeting
        selectionManager.selectAvatar(clickedAvatar.id);
        for (const avatar of avatarManager.getAvatars()) {
          avatar.isSelected = (avatar.id === clickedAvatar.id);
        }

        // If avatar is sitting, stand it up
        if (clickedAvatar.state === 'sit') {
          avatarManager.standAvatar(clickedAvatar.id);
          idleWander.startWandering(clickedAvatar.id);
          return;
        }

        // Notify extension for sidebar scroll-to
        const vscodeApi = (window as any).vscodeApi;
        if (vscodeApi) {
          vscodeApi.postMessage({ type: 'agentClicked', agentId: clickedAvatar.id });
        }
        return;
      }

      // Click on empty space — deselect
      selectionManager.deselectAvatar();
      for (const avatar of avatarManager.getAvatars()) {
        avatar.isSelected = false;
      }
    },
    [
      stageRef,
      renderState,
      canvasRef,
      expandedNoteRef,
      expandedAggregateRef,
      kanbanRenderStateRef,
      noteOriginRef,
      mouseToTile,
      ensureInitialized,
      reRenderRoom,
      selectedColor,
      avatarManager,
      selectionManager,
      idleWander,
    ],
  );

  const handleContextMenu = useCallback(
    async (event: ReactMouseEvent<HTMLCanvasElement>) => {
      event.preventDefault(); // Suppress browser context menu

      if (!renderState.current.grid || !canvasRef.current) return;

      // Editor modes don't use right-click
      if (renderState.current.editorState.mode !== 'view') return;

      const clickedCoords = mouseToTile(event.clientX, event.clientY);
      if (!clickedCoords) return;

      const { tileX, tileY } = clickedCoords;

      // Initialize audio on first interaction
      await ensureInitialized();

      // Simulated server round-trip lag
      await new Promise(r => setTimeout(r, 75 + Math.random() * 100));

      // Check if right-clicked tile has a chair — move nearest avatar to sit
      const chairFurniture = renderState.current.furniture.find(
        f => f.tileX === tileX && f.tileY === tileY && isChairType(f.name)
      );
      if (chairFurniture) {
        const occupied = avatarManager.getOccupiedChairs();
        const chairKey = `${tileX},${tileY}`;
        if (!occupied.has(chairKey)) {
          const candidates = avatarManager.getAvatars().filter(
            a => a.state === 'idle' || a.state === 'walk'
          );
          // Prefer selected avatar, then closest
          const selectionMgr = selectionManager;
          let target = selectionMgr.selectedAvatarId
            ? avatarManager.getAvatar(selectionMgr.selectedAvatarId)
            : undefined;
          if (!target || (target.state !== 'idle' && target.state !== 'walk')) {
            target = candidates.sort((a, b) => {
              const distA = Math.abs(a.tileX - tileX) + Math.abs(a.tileY - tileY);
              const distB = Math.abs(b.tileX - tileX) + Math.abs(b.tileY - tileY);
              return distA - distB;
            })[0];
          }
          if (target && renderState.current.grid) {
            const blocked = computeBlockedTiles(
              renderState.current.furniture,
              renderState.current.multiTileFurniture,
              walkableBoothsRef.current,
            );
            if (target.tileX === tileX && target.tileY === tileY) {
              avatarManager.sitAvatar(target.id, tileX, tileY, chairFurniture.direction);
            } else {
              const moved = avatarManager.moveAvatarTo(
                target.id, tileX, tileY, renderState.current.grid, undefined, blocked
              );
              if (moved) {
                idleWander.stopWandering(target.id);
                const checkSitArrival = () => {
                  const av = avatarManager.getAvatar(target!.id);
                  if (!av) return;
                  if (av.state === 'idle' && av.tileX === tileX && av.tileY === tileY) {
                    const occ = avatarManager.getOccupiedChairs();
                    if (!occ.has(chairKey)) {
                      avatarManager.sitAvatar(av.id, tileX, tileY, chairFurniture.direction);
                    }
                    return;
                  }
                  if (av.state === 'walk') {
                    requestAnimationFrame(checkSitArrival);
                  }
                };
                requestAnimationFrame(checkSitArrival);
              }
            }
          }
        }
        return;
      }

      // Right-click on walkable tile — move nearest idle avatar there
      const tile = renderState.current.grid.tiles[tileY]?.[tileX];
      if (tile !== null && tile !== undefined) {
        const blocked = computeBlockedTiles(
          renderState.current.furniture,
          renderState.current.multiTileFurniture,
          walkableBoothsRef.current,
        );
        // Find nearest idle/walk avatar (prefer selected)
        const selectionMgr = selectionManager;
        let target = selectionMgr.selectedAvatarId
          ? avatarManager.getAvatar(selectionMgr.selectedAvatarId)
          : undefined;
        if (!target || (target.state !== 'idle' && target.state !== 'walk')) {
          const candidates = avatarManager.getAvatars().filter(
            a => a.state === 'idle' || a.state === 'walk'
          );
          target = candidates.sort((a, b) => {
            const distA = Math.abs(a.tileX - tileX) + Math.abs(a.tileY - tileY);
            const distB = Math.abs(b.tileX - tileX) + Math.abs(b.tileY - tileY);
            return distA - distB;
          })[0];
        }
        if (target) {
          if (target.state === 'sit') {
            avatarManager.standAvatar(target.id);
          }
          const moved = avatarManager.moveAvatarTo(
            target.id, tileX, tileY, renderState.current.grid, undefined, blocked
          );
          if (moved) {
            idleWander.stopWandering(target.id);
          }
        }
      }
    },
    [
      renderState,
      canvasRef,
      mouseToTile,
      ensureInitialized,
      avatarManager,
      selectionManager,
      walkableBoothsRef,
      idleWander,
    ],
  );

  return { handleClick, handleContextMenu };
}
