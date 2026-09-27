// src/hooks/useRoomEditorIO.ts
// Layout editor + dev IO (M008/S04 T02, extracted from RoomCanvas under the D021
// convention): the room-buffer (re)render, teleport-booth frame swaps, and the
// save/load/dev-capture commands. The returned callbacks are `useCallback`-stable
// so the shell can pass them across hooks and into the stage effect without
// churning identities.
import { useCallback } from 'react';
import type { RefObject } from 'react';
import { computeCameraOrigin, createFurnitureRenderables } from '../isoTileRenderer.js';
import { saveLayout, loadLayout } from '../isoLayoutEditor.js';
import { buildWallColorMap, type FloorTemplate } from '../roomLayoutEngine.js';
import { isTeleportBooth } from '../furnitureRegistry.js';
import { parseHeightmap, type HsbColor, type Renderable } from '../isoTypes.js';
import {
  buildDevCaptureFilename,
  buildDevCapturePayload,
  copyTextBestEffort,
  downloadJson,
  triggerDownload,
} from '../devCapture.js';
import type { SpriteCache } from '../isoSpriteCache.js';
import type { CanvasStage } from '../render/CanvasStage.js';
import type { RoomRenderState } from './useRoomInput.js';

export interface UseRoomEditorIOOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stageRef: RefObject<CanvasStage | null>;
  renderState: RefObject<RoomRenderState>;
  onWallColorsLoaded?: (colors: Record<string, HsbColor>) => void;
}

export function useRoomEditorIO({
  canvasRef,
  stageRef,
  renderState,
  onWallColorsLoaded,
}: UseRoomEditorIOOptions) {
  /**
   * (Re-)render the room layer. The layer is sized to the ROOM's world extent
   * (not the viewport) via src/render/layers.ts; current call sites force a
   * render (init, resize, booth frames, layout edits) — the invalidation key
   * is in place for future incremental use.
   */
  const renderRoomBuffer = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const grid = renderState.current.grid;
    if (!canvas || !stage || !grid) return;
    const spriteCache: SpriteCache | undefined = (window as any).spriteCache;
    const result = stage.renderRoom({
      grid,
      canvasCssW: canvas.offsetWidth,
      canvasCssH: canvas.offsetHeight,
      version: `manual-${renderState.current.lastFrameTimeMs}-${grid.width}x${grid.height}`,
      tileColorMap: renderState.current.tileColorMap,
      wallColorMap: renderState.current.wallColorMap,
      furniture: renderState.current.furniture,
      multiTileFurniture: renderState.current.multiTileFurniture,
      spriteCache,
    });
    renderState.current.cameraOrigin = result.origin;
    renderState.current.furnitureRenderables =
      result.furnitureRenderables as Renderable[];
  }, [canvasRef, stageRef, renderState]);

  const reRenderRoom = useCallback(() => {
    renderRoomBuffer();
  }, [renderRoomBuffer]);

  /**
   * Set a teleport booth's frame index (0=closed, 1=open) and rebuild renderables.
   */
  const setBoothFrame = useCallback(
    (tileX: number, tileY: number, frameIndex: number) => {
      const furniture = renderState.current.furniture;
      const booth = furniture.find(
        f => f.tileX === tileX && f.tileY === tileY && isTeleportBooth(f.name)
      );
      if (!booth) return;
      booth.frameIndex = frameIndex;
      const spriteCache: SpriteCache | undefined = (window as any).spriteCache;
      if (spriteCache) {
        renderState.current.furnitureRenderables = createFurnitureRenderables(
          furniture,
          renderState.current.multiTileFurniture,
          spriteCache,
          renderState.current.cameraOrigin,
        );
      }
    },
    [renderState],
  );

  const handleSave = useCallback(() => {
    if (!renderState.current.grid) return;

    const json = saveLayout(
      renderState.current.grid,
      renderState.current.tileColorMap,
      renderState.current.furniture,
      renderState.current.multiTileFurniture,
      { x: 0, y: 0, z: 0, dir: 2 },
      renderState.current.sectionWallColors,
    );

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'layout.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [renderState]);

  const handleLoad = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text || !canvasRef.current) return;

      try {
        const data = loadLayout(text);

        const newGrid = parseHeightmap(data.heightmap);
        renderState.current.grid = newGrid;
        renderState.current.tileColorMap = new Map(Object.entries(data.tileColors));
        renderState.current.furniture = data.furniture;
        renderState.current.multiTileFurniture = data.multiTileFurniture;

        const sectionWallColors = data.sectionWallColors ?? {};
        renderState.current.sectionWallColors = sectionWallColors;
        const tmpl = (window as unknown as { floorTemplate?: FloorTemplate }).floorTemplate;
        renderState.current.wallColorMap = tmpl
          ? buildWallColorMap(tmpl, sectionWallColors)
          : new Map();
        onWallColorsLoaded?.(sectionWallColors);

        renderState.current.cameraOrigin = computeCameraOrigin(
          newGrid,
          canvasRef.current.offsetWidth,
          canvasRef.current.offsetHeight
        );

        reRenderRoom();
        console.log('Layout loaded successfully');
      } catch (error) {
        console.error('Failed to load layout:', error);
      }
    };
    reader.readAsText(file);
  }, [canvasRef, renderState, reRenderRoom, onWallColorsLoaded]);

  const handleDevCapture = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const screenshot = canvas.toDataURL('image/png');
    const logs = [...(window.__devLogBuffer ?? [])];
    const vscodeApi = window.vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ type: 'devCapture', screenshot, logs });
      return;
    }

    // Standalone web build: no extension host — deliver the same payload through
    // browser-native downloads (PNG + JSON) and a best-effort clipboard copy.
    const payload = buildDevCapturePayload(screenshot, logs);
    const pngName = buildDevCaptureFilename(payload.timestamp, 'png');
    const jsonName = buildDevCaptureFilename(payload.timestamp, 'json');
    triggerDownload(payload.screenshot, pngName);
    downloadJson(payload, jsonName);
    void copyTextBestEffort(payload.logs.join('\n')).then((copied) => {
      console.log(`Dev capture saved: ${pngName}, ${jsonName} (logs copied: ${copied ? 'yes' : 'no'})`);
    });
  }, [canvasRef]);

  return { renderRoomBuffer, reRenderRoom, setBoothFrame, handleSave, handleLoad, handleDevCapture };
}
