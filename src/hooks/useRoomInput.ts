// src/hooks/useRoomInput.ts
// Pointer→tile input mapping (M008/S04 T01, extracted from RoomCanvas under the
// D021 convention): converts client coordinates to tile coordinates and writes
// the hovered-tile editor state. The returned callbacks are `useCallback`-stable
// so CanvasStage can hold them for the lifetime of the stage without the frame
// path re-creating them per frame.
import { useCallback } from 'react';
import type { RefObject } from 'react';
import { screenToWorld } from '../cameraController.js';
import { screenToTile } from '../isometricMath.js';
import type { CanvasStage } from '../render/CanvasStage.js';
import type { EditorState } from '../isoLayoutEditor.js';
import type { TileGrid, HsbColor, Renderable } from '../isoTypes.js';
import type { FurnitureSpec, MultiTileFurnitureSpec } from '../isoFurnitureRenderer.js';

/** Mutable camera/editor/room scratch owned by the shell and read each frame. */
export interface RoomRenderState {
  cameraOrigin: { x: number; y: number };
  lastFrameTimeMs: number;
  editorState: EditorState;
  grid: TileGrid | null;
  tileColorMap: Map<string, HsbColor>;
  wallColorMap: Map<string, HsbColor>;
  sectionWallColors: Record<string, HsbColor>;
  furniture: FurnitureSpec[];
  multiTileFurniture: MultiTileFurnitureSpec[];
  furnitureRenderables: Renderable[];
}

export interface UseRoomInputOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stageRef: RefObject<CanvasStage | null>;
  renderState: RefObject<RoomRenderState>;
}

export function useRoomInput({ canvasRef, stageRef, renderState }: UseRoomInputOptions) {
  /**
   * Convert a pointer position (client coords) to tile coordinates, accounting
   * for camera pan/zoom and the static camera origin offset.
   */
  const mouseToTile = useCallback(
    (clientX: number, clientY: number): { tileX: number; tileY: number } | null => {
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      if (!canvas || !stage) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.offsetWidth / rect.width;
      const scaleY = canvas.offsetHeight / rect.height;
      const mouseX = (clientX - rect.left) * scaleX;
      const mouseY = (clientY - rect.top) * scaleY;

      // Apply inverse camera transform to get world-space coordinates
      const cam = stage.camera;
      const world = screenToWorld(mouseX, mouseY, cam, canvas.offsetWidth, canvas.offsetHeight);

      // Subtract cameraOrigin (static centering offset) to get isometric coordinates
      const adjX = world.x - renderState.current.cameraOrigin.x;
      const adjY = world.y - renderState.current.cameraOrigin.y;

      const { x, y } = screenToTile(adjX, adjY);
      const tileX = Math.floor(x);
      const tileY = Math.floor(y);

      if (tileX < 0 || tileY < 0) return null;
      return { tileX, tileY };
    },
    [canvasRef, stageRef, renderState],
  );

  /** Update the hovered-tile editor state from a pointer position. */
  const updateHover = useCallback(
    (clientX: number, clientY: number) => {
      const grid = renderState.current.grid;
      if (!grid) return;
      const hoveredCoords = mouseToTile(clientX, clientY);
      if (hoveredCoords) {
        const { tileX, tileY } = hoveredCoords;
        if (tileY >= 0 && tileY < grid.height && tileX >= 0 && tileX < grid.width) {
          const tile = grid.tiles[tileY][tileX];
          const tileZ = tile ? tile.height : 0;
          renderState.current.editorState.hoveredTile = { x: tileX, y: tileY, z: tileZ };
        } else {
          renderState.current.editorState.hoveredTile = null;
        }
      } else {
        renderState.current.editorState.hoveredTile = null;
      }
    },
    [mouseToTile, renderState],
  );

  /** Clear the hovered tile when the pointer leaves the canvas. */
  const onHoverEnd = useCallback(() => {
    renderState.current.editorState.hoveredTile = null;
  }, [renderState]);

  return { mouseToTile, updateHover, onHoverEnd };
}
