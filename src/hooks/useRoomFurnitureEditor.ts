// src/hooks/useRoomFurnitureEditor.ts
// Furniture-mode pointer interaction (M009/S02, D021 convention): select a
// placed item, drag it to a new tile, move it to a click-destination (armed
// from the panel), place new furniture on empty tiles, and delete the
// selection. Application logic lives here, not in RoomCanvas — the shell owns
// the selection / move-armed React state and the panel reads it back.
import { useCallback, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import {
  findFurnitureAtTile,
  getFurnitureInfoById,
  moveFurniture,
  deleteFurniture,
  placeFurniture,
  type PlacedFurnitureInfo,
} from '../isoLayoutEditor.js';
import type { SpriteCache } from '../isoSpriteCache.js';
import type { RoomRenderState } from './useRoomInput.js';

const DRAG_THRESHOLD_PX = 5;

export interface UseRoomFurnitureEditorOptions {
  renderState: RefObject<RoomRenderState>;
  mouseToTile: (clientX: number, clientY: number) => { tileX: number; tileY: number } | null;
  reRenderRoom: () => void;
  ensureInitialized: () => Promise<void>;
  moveArmed: boolean;
  onSelectionChange: (info: PlacedFurnitureInfo | null) => void;
  onMoveConsumed: () => void;
}

interface FurnitureDragState {
  id: string;
  startX: number;
  startY: number;
  moved: boolean;
  wasSelected: boolean;
}

function getSpriteCache(): SpriteCache | undefined {
  return (window as unknown as { spriteCache?: SpriteCache }).spriteCache;
}

export function useRoomFurnitureEditor({
  renderState,
  mouseToTile,
  reRenderRoom,
  ensureInitialized,
  moveArmed,
  onSelectionChange,
  onMoveConsumed,
}: UseRoomFurnitureEditorOptions) {
  const dragRef = useRef<FurnitureDragState | null>(null);

  const select = useCallback(
    (info: PlacedFurnitureInfo | null) => {
      renderState.current.editorState.selectedFurnitureId = info ? info.id : null;
      renderState.current.editorState.selectedFurnitureTile = info
        ? { x: info.tileX, y: info.tileY, z: info.tileZ }
        : null;
      onSelectionChange(info);
    },
    [renderState, onSelectionChange],
  );

  const onFurnitureMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      if (event.button !== 0) return;
      if (renderState.current.editorState.mode !== 'furniture') return;
      const grid = renderState.current.grid;
      if (!grid) return;
      const coords = mouseToTile(event.clientX, event.clientY);
      if (!coords) return;

      void ensureInitialized();
      const { tileX, tileY } = coords;

      const hit = findFurnitureAtTile(
        renderState.current.furniture,
        renderState.current.multiTileFurniture,
        tileX,
        tileY,
      );

      if (hit) {
        dragRef.current = {
          id: hit.id,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
          wasSelected: renderState.current.editorState.selectedFurnitureId === hit.id,
        };
        select(hit);
        return;
      }

      const selectedId = renderState.current.editorState.selectedFurnitureId;

      if (selectedId && moveArmed) {
        const moved = moveFurniture(
          grid,
          renderState.current.furniture,
          renderState.current.multiTileFurniture,
          selectedId,
          tileX,
          tileY,
        );
        if (moved) {
          select(getFurnitureInfoById(
            renderState.current.furniture,
            renderState.current.multiTileFurniture,
            selectedId,
          ));
          onMoveConsumed();
          reRenderRoom();
        }
        return;
      }

      const furnitureType = renderState.current.editorState.selectedFurniture || 'hc_chr';
      const direction = renderState.current.editorState.furnitureDirection ?? 0;
      const placed = placeFurniture(
        grid,
        renderState.current.furniture,
        renderState.current.multiTileFurniture,
        tileX,
        tileY,
        furnitureType,
        direction,
        getSpriteCache(),
      );
      if (placed) {
        select(null);
        reRenderRoom();
      }
    },
    [renderState, mouseToTile, ensureInitialized, moveArmed, select, onMoveConsumed, reRenderRoom],
  );

  const onFurnitureMouseMove = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.moved) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX) {
      drag.moved = true;
    }
  }, []);

  const onFurnitureMouseUp = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;

      if (!drag.moved) {
        if (drag.wasSelected) select(null);
        return;
      }

      const grid = renderState.current.grid;
      const coords = mouseToTile(event.clientX, event.clientY);
      if (!grid || !coords) return;

      const moved = moveFurniture(
        grid,
        renderState.current.furniture,
        renderState.current.multiTileFurniture,
        drag.id,
        coords.tileX,
        coords.tileY,
      );
      if (moved) {
        select(getFurnitureInfoById(
          renderState.current.furniture,
          renderState.current.multiTileFurniture,
          drag.id,
        ));
        reRenderRoom();
      }
    },
    [renderState, mouseToTile, select, reRenderRoom],
  );

  const onFurnitureMouseLeave = useCallback(() => {
    dragRef.current = null;
  }, []);

  const deleteSelected = useCallback(() => {
    const id = renderState.current.editorState.selectedFurnitureId;
    if (!id) return;
    const removed = deleteFurniture(
      renderState.current.furniture,
      renderState.current.multiTileFurniture,
      id,
    );
    if (removed) {
      select(null);
      reRenderRoom();
    }
  }, [renderState, select, reRenderRoom]);

  return {
    onFurnitureMouseDown,
    onFurnitureMouseMove,
    onFurnitureMouseUp,
    onFurnitureMouseLeave,
    deleteSelected,
  };
}
