import React, { useRef, useEffect, useState } from 'react';
import { parseHeightmap, depthSort } from './isoTypes.js';
import { initCanvas, computeCameraOrigin, preRenderRoom } from './isoTileRenderer.js';
import type { TileGrid } from './isoTypes.js';
import type { FurnitureSpec, MultiTileFurnitureSpec } from './isoFurnitureRenderer.js';
import type { AvatarSpec } from './isoAvatarRenderer.js';
import { createAvatarRenderable, createNitroAvatarRenderable, updateAvatarAnimation } from './isoAvatarRenderer.js';
import type { SpriteCache } from './isoSpriteCache.js';
import { drawParentChildLine } from './isoAgentBehavior.js';
import { drawSpeechBubble } from './isoBubbleRenderer.js';
import { drawNameTag } from './isoNameTagRenderer.js';
import { tileToScreen } from './isometricMath.js';
import {
  getHoveredTile,
  drawHoverHighlight,
  toggleTileWalkability,
  setTileColor,
  placeFurniture,
  rotateFurniture,
  saveLayout,
  loadLayout,
  type EditorMode,
  type EditorState,
} from './isoLayoutEditor.js';
import type { HsbColor } from './isoTypes.js';
import { LayoutEditorPanel } from './LayoutEditorPanel.js';
import { AudioManager } from './isoAudioManager.js';

interface RoomCanvasProps {
  heightmap: string;
  editorMode?: EditorMode; // Optional, defaults to 'view'
}

// Avatar sprite height for name tag positioning (Nitro figure sprites)
const AVATAR_HEIGHT = 100;

export function RoomCanvas({ heightmap, editorMode: editorModeProp = 'view' }: RoomCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(false);
  const rafIdRef = useRef(0);

  // Audio manager (Phase 8)
  const audioManagerRef = useRef<AudioManager | null>(null);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const notificationSoundRef = useRef<AudioBuffer | null>(null);

  // Editor UI state
  const [editorMode, setEditorMode] = useState<EditorMode>(editorModeProp);
  const [selectedColor, setSelectedColor] = useState<HsbColor>({ h: 200, s: 50, b: 50 });
  const [selectedFurniture, setSelectedFurniture] = useState<string>('chair');
  const [furnitureDirection, setFurnitureDirection] = useState<number>(0);
  const renderState = useRef<{
    offscreenCanvas: OffscreenCanvas | null;
    cameraOrigin: { x: number; y: number };
    mainCtx: CanvasRenderingContext2D | null;
    avatars: AvatarSpec[];
    lastFrameTimeMs: number;
    parentChildPairs: Array<{ parent: AvatarSpec; child: AvatarSpec }>;
    editorState: EditorState;
    grid: TileGrid | null;
    tileColorMap: Map<string, HsbColor>;
    furniture: FurnitureSpec[];
    multiTileFurniture: MultiTileFurnitureSpec[];
  }>({
    offscreenCanvas: null,
    cameraOrigin: { x: 0, y: 0 },
    mainCtx: null,
    avatars: [],
    lastFrameTimeMs: Date.now(),
    parentChildPairs: [],
    editorState: {
      mode: 'view',
      hoveredTile: null,
      selectedColor: { h: 200, s: 50, b: 50 },
    },
    grid: null,
    tileColorMap: new Map(),
    furniture: [],
    multiTileFurniture: [],
  });

  // Sync React editor state to renderState (no re-init)
  useEffect(() => {
    renderState.current.editorState.mode = editorMode;
    renderState.current.editorState.selectedColor = selectedColor;
    renderState.current.editorState.selectedFurniture = selectedFurniture;
    renderState.current.editorState.furnitureDirection = furnitureDirection;
  }, [editorMode, selectedColor, selectedFurniture, furnitureDirection]);

  useEffect(() => {
    // Step 1: Get canvas from canvasRef.current — return early if null
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Step 2: Call initCanvas(canvas) -> mainCtx; store in renderState.current.mainCtx
    const mainCtx = initCanvas(canvas);
    renderState.current.mainCtx = mainCtx;

    // Step 3: Parse the heightmap
    const grid: TileGrid = parseHeightmap(heightmap);

    // Store grid in renderState for editor mutations
    renderState.current.grid = grid;

    // Step 4: Compute camera origin
    renderState.current.cameraOrigin = computeCameraOrigin(
      grid,
      canvas.offsetWidth,
      canvas.offsetHeight
    );

    // Office layout — directions MUST match each item's supported directions:
    // exe_plant: dir [0] only | exe_chair: [0,2,4,6] | exe_light: dir [0] only
    // exe_globe: dir [0] only | exe_copier: dir [2,4] | exe_sofa: [0,2,4,6] (3×1)
    // exe_table: [0,2,4,6] (3×2)
    const furniture: FurnitureSpec[] = [
      // Corner plant (only supports dir 0)
      { name: 'plant', tileX: 1, tileY: 1, tileZ: 0, direction: 0 },

      // Chair at desk (dir 2 = facing SE)
      { name: 'chair', tileX: 5, tileY: 3, tileZ: 0, direction: 2 },

      // Floor lamp (only supports dir 0)
      { name: 'lamp', tileX: 1, tileY: 4, tileZ: 0, direction: 0 },

      // Globe decoration (only supports dir 0)
      { name: 'bookshelf', tileX: 8, tileY: 2, tileZ: 0, direction: 0 },

      // Copier (only supports dir 2,4)
      { name: 'computer', tileX: 8, tileY: 7, tileZ: 0, direction: 2 },
    ];

    const multiTileFurniture: MultiTileFurnitureSpec[] = [
      // Big desk (3×2 tiles, dir 0)
      { name: 'desk', tileX: 2, tileY: 1, tileZ: 0, widthTiles: 3, heightTiles: 2, direction: 0 },
      // Sofa (3×1 tiles, dir 2)
      { name: 'whiteboard', tileX: 1, tileY: 6, tileZ: 0, widthTiles: 3, heightTiles: 1, direction: 2 },
    ];

    // Store furniture in renderState for editor mutations
    renderState.current.furniture = furniture;
    renderState.current.multiTileFurniture = multiTileFurniture;

    // Get sprite cache from window (loaded in webview.tsx)
    const spriteCache: SpriteCache | undefined = (window as any).spriteCache;

    // Step 4.6: Create test avatars with pathfinding demonstration
    const now = Date.now();

    const avatars: AvatarSpec[] = [
      {
        id: 'avatar1',
        tileX: 3, tileY: 4, tileZ: 0,
        direction: 0,
        variant: 0, // Blue outfit, facing NE
        state: 'idle',
        frame: 0,
        lastUpdateMs: now,
        nextBlinkMs: now + 5000,
        blinkFrame: 0,
        spawnProgress: 0,
      },
      {
        id: 'avatar2',
        tileX: 7, tileY: 4, tileZ: 0,
        direction: 2,
        variant: 1, // Red outfit, facing SE
        state: 'idle',
        frame: 0,
        lastUpdateMs: now,
        nextBlinkMs: now + 6000,
        blinkFrame: 0,
        spawnProgress: 0,
      },
      {
        id: 'avatar3',
        tileX: 2, tileY: 8, tileZ: 0,
        direction: 4,
        variant: 2, // Green outfit, facing SW
        state: 'idle',
        frame: 0,
        lastUpdateMs: now,
        nextBlinkMs: now + 7000,
        blinkFrame: 0,
        spawnProgress: 0,
      },
      {
        id: 'avatar4',
        tileX: 3, tileY: 5, tileZ: 0,
        direction: 6,
        variant: 3, // Purple outfit, facing NW
        state: 'idle',
        frame: 0,
        lastUpdateMs: now,
        nextBlinkMs: now + 5500,
        blinkFrame: 0,
        spawnProgress: 0,
      },
    ];

    // Step 5: Pre-render room with furniture (NOT avatars - they animate)
    renderState.current.offscreenCanvas = preRenderRoom(
      grid,
      renderState.current.cameraOrigin,
      canvas.width,
      canvas.height,
      window.devicePixelRatio || 1,
      undefined, // defaultHsb
      furniture,
      multiTileFurniture,
      spriteCache,
      'furniture',
      renderState.current.tileColorMap // Pass tileColorMap for per-tile colors
    );

    // Step 5.5: Store avatars in renderState for animation loop
    renderState.current.avatars = avatars;

    // Step 5.7: Set up parent-child relationship for demo
    const parent = avatars.find(a => a.id === 'avatar1');
    const child = avatars.find(a => a.id === 'avatar4');
    if (parent && child) {
      renderState.current.parentChildPairs = [{ parent, child }];
    }

    // Step 6: Set runningRef.current = true
    runningRef.current = true;

    // Step 7: Define frame()
    function frame() {
      // FIRST LINE: if (!runningRef.current) return — StrictMode guard
      if (!runningRef.current) return;

      // Get ctx and offscreen from renderState.current
      const ctx = renderState.current.mainCtx;
      const offscreen = renderState.current.offscreenCanvas;

      if (!ctx || !offscreen || !canvas) return;

      // Update animation state for all avatars
      const currentTimeMs = Date.now();
      for (const avatar of renderState.current.avatars) {
        updateAvatarAnimation(avatar, currentTimeMs);

        // Play notification sound on spawn start (demo hook - Phase 8)
        if (avatar.state === 'spawning' && avatar.spawnProgress === 0 && audioManagerRef.current && !( window as any)._audioPlayed) {
          audioManagerRef.current.play(notificationSoundRef.current);
          (window as any)._audioPlayed = true; // Play once per session
        }

        // Path-following is handled by the agent behavior system when paths are assigned
      }
      renderState.current.lastFrameTimeMs = currentTimeMs;

      // Clear canvas: ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Blit: ctx.drawImage(offscreen, 0, 0) — single drawImage per frame (ROOM-08)
      ctx.drawImage(offscreen, 0, 0);

      // Draw hover highlight if tile is hovered (editor mode)
      if (renderState.current.editorState.hoveredTile) {
        const { x, y, z } = renderState.current.editorState.hoveredTile;
        drawHoverHighlight(ctx, x, y, z, renderState.current.cameraOrigin);
      }

      // Render avatars dynamically (NOT pre-rendered - animation state changes each frame)
      // Nitro body with per-variant color tinting; fall back to placeholder if not loaded
      if (spriteCache && renderState.current.avatars.length > 0) {
        const avatarRenderables = renderState.current.avatars.map(spec => {
          const renderable = createNitroAvatarRenderable(spec, spriteCache)
            || createAvatarRenderable(spec, spriteCache, 'avatar');

          // Wrap draw function to apply camera origin offset
          const originalDraw = renderable.draw;
          renderable.draw = (ctx) => {
            ctx.save();
            ctx.translate(renderState.current.cameraOrigin.x, renderState.current.cameraOrigin.y);
            originalDraw(ctx);
            ctx.restore();
          };

          return renderable;
        });

        // Depth sort avatars for correct overlap
        const sorted = depthSort(avatarRenderables);
        for (const avatar of sorted) {
          avatar.draw(ctx);
        }

        // Draw parent-child relationship lines
        if (renderState.current.parentChildPairs.length > 0) {
          ctx.save();
          ctx.translate(renderState.current.cameraOrigin.x, renderState.current.cameraOrigin.y);
          for (const pair of renderState.current.parentChildPairs) {
            drawParentChildLine(ctx, pair.parent, pair.child);
          }
          ctx.restore();
        }

        // UI Overlays (UI-06): Render after all depth-sorted elements
        // Order: name tags → speech bubbles (name tags closest to avatar head)

        // Render name tags (above avatars, before speech bubbles)
        ctx.font = '8px "Press Start 2P"'; // Set font for measureText
        for (const avatar of renderState.current.avatars) {
          const { x: screenX, y: screenY } = tileToScreen(avatar.tileX, avatar.tileY, avatar.tileZ);
          const headY = screenY - AVATAR_HEIGHT; // Avatar head position (top of sprite)

          // Map avatar state to name tag status
          const status = avatar.state === 'idle' ? 'idle' : 'active'; // walk/spawning = active

          ctx.save();
          ctx.translate(renderState.current.cameraOrigin.x, renderState.current.cameraOrigin.y);
          drawNameTag(ctx, {
            name: avatar.id,
            status,
            anchorX: screenX,
            anchorY: headY,
          });
          ctx.restore();
        }

        // Render speech bubbles (below name tags)
        for (const avatar of renderState.current.avatars) {
          const { x: screenX, y: screenY } = tileToScreen(avatar.tileX, avatar.tileY, avatar.tileZ);
          const headY = screenY - AVATAR_HEIGHT; // Avatar head position (top of sprite)

          // TODO(Phase 7): Replace demo text with real agent log line from JSONL watcher
          const text = `${avatar.id}: ${avatar.state}`; // Demo placeholder

          ctx.save();
          ctx.translate(renderState.current.cameraOrigin.x, renderState.current.cameraOrigin.y);
          drawSpeechBubble(ctx, {
            text,
            anchorX: screenX,
            anchorY: headY,
            isWaiting: avatar.state === 'idle', // Demo: idle avatars show waiting bubble
          }, currentTimeMs);
          ctx.restore();
        }
      }

      // Schedule next: rafIdRef.current = requestAnimationFrame(frame)
      rafIdRef.current = requestAnimationFrame(frame);
    }

    // Step 8: rafIdRef.current = requestAnimationFrame(frame)
    rafIdRef.current = requestAnimationFrame(frame);

    // Step 9: Return cleanup function
    return () => {
      // runningRef.current = false — MUST happen BEFORE cancelAnimationFrame
      runningRef.current = false;
      // cancelAnimationFrame(rafIdRef.current)
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [heightmap]); // Only re-init when heightmap changes, not editor state

  // Mouse event handlers for editor mode
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!renderState.current.grid) return;

    const hoveredCoords = getHoveredTile(event, renderState.current.cameraOrigin);

    if (hoveredCoords) {
      const { tileX, tileY } = hoveredCoords;
      // Check if tile exists in grid
      if (
        tileY >= 0 && tileY < renderState.current.grid.height &&
        tileX >= 0 && tileX < renderState.current.grid.width
      ) {
        const tile = renderState.current.grid.tiles[tileY][tileX];
        const tileZ = tile ? tile.height : 0;
        renderState.current.editorState.hoveredTile = { x: tileX, y: tileY, z: tileZ };
      } else {
        renderState.current.editorState.hoveredTile = null;
      }
    } else {
      renderState.current.editorState.hoveredTile = null;
    }
  };

  const handleClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Initialize audio on first click (autoplay policy compliance)
    if (!audioInitialized && !audioManagerRef.current) {
      audioManagerRef.current = new AudioManager();
      await audioManagerRef.current.init();
      setAudioInitialized(true);

      // Load notification sound
      const notificationUri = (window as any).ASSET_URIS?.notificationSound;
      if (notificationUri) {
        notificationSoundRef.current = await audioManagerRef.current.loadSound(notificationUri);
      }

      console.log('AudioManager initialized, notification sound loaded:', notificationSoundRef.current !== null);
    }

    if (!renderState.current.grid || !canvasRef.current) return;

    const clickedCoords = getHoveredTile(event, renderState.current.cameraOrigin);
    if (!clickedCoords) return;

    const { tileX, tileY } = clickedCoords;

    // Paint mode: toggle tile walkability
    if (renderState.current.editorState.mode === 'paint') {
      toggleTileWalkability(renderState.current.grid, tileX, tileY);

      // Re-render offscreen canvas with updated grid
      renderState.current.offscreenCanvas = preRenderRoom(
        renderState.current.grid,
        renderState.current.cameraOrigin,
        canvasRef.current.width,
        canvasRef.current.height,
        window.devicePixelRatio || 1,
        undefined,
        renderState.current.furniture,
        renderState.current.multiTileFurniture,
        (window as any).spriteCache,
        undefined,
        renderState.current.tileColorMap
      );
    }

    // Color mode: set tile color
    if (renderState.current.editorState.mode === 'color') {
      setTileColor(
        renderState.current.tileColorMap,
        tileX,
        tileY,
        selectedColor // Use React state directly, not renderState
      );

      // Re-render offscreen canvas with updated colors
      renderState.current.offscreenCanvas = preRenderRoom(
        renderState.current.grid,
        renderState.current.cameraOrigin,
        canvasRef.current.width,
        canvasRef.current.height,
        window.devicePixelRatio || 1,
        undefined,
        renderState.current.furniture,
        renderState.current.multiTileFurniture,
        (window as any).spriteCache,
        undefined,
        renderState.current.tileColorMap
      );
    }

    // Furniture mode: place furniture
    if (renderState.current.editorState.mode === 'furniture') {
      const furnitureType = renderState.current.editorState.selectedFurniture || 'chair';
      const direction = renderState.current.editorState.furnitureDirection || 0;

      const placed = placeFurniture(
        renderState.current.grid,
        renderState.current.furniture,
        renderState.current.multiTileFurniture,
        tileX,
        tileY,
        furnitureType,
        direction
      );

      if (placed) {
        // Re-render offscreen canvas with new furniture
        renderState.current.offscreenCanvas = preRenderRoom(
          renderState.current.grid,
          renderState.current.cameraOrigin,
          canvasRef.current.width,
          canvasRef.current.height,
          window.devicePixelRatio || 1,
          undefined,
          renderState.current.furniture,
          renderState.current.multiTileFurniture,
          (window as any).spriteCache,
          undefined,
          renderState.current.tileColorMap
        );
      }
    }
  };

  const handleMouseLeave = () => {
    renderState.current.editorState.hoveredTile = null;
  };

  const handleSave = () => {
    if (!renderState.current.grid) return;

    const json = saveLayout(
      renderState.current.grid,
      renderState.current.tileColorMap,
      renderState.current.furniture,
      renderState.current.multiTileFurniture,
      { x: 0, y: 0, z: 0, dir: 2 } // Default door coords
    );

    // Create blob and trigger download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'layout.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text || !canvasRef.current) return;

      try {
        const data = loadLayout(text);

        // Update grid
        const newGrid = parseHeightmap(data.heightmap);
        renderState.current.grid = newGrid;

        // Update tile colors
        renderState.current.tileColorMap = new Map(Object.entries(data.tileColors));

        // Update furniture
        renderState.current.furniture = data.furniture;
        renderState.current.multiTileFurniture = data.multiTileFurniture;

        // Recompute camera origin for new grid
        renderState.current.cameraOrigin = computeCameraOrigin(
          newGrid,
          canvasRef.current.offsetWidth,
          canvasRef.current.offsetHeight
        );

        // Re-render offscreen canvas
        renderState.current.offscreenCanvas = preRenderRoom(
          newGrid,
          renderState.current.cameraOrigin,
          canvasRef.current.width,
          canvasRef.current.height,
          window.devicePixelRatio || 1,
          undefined,
          renderState.current.furniture,
          renderState.current.multiTileFurniture,
          (window as any).spriteCache,
          undefined,
          renderState.current.tileColorMap
        );

        console.log('Layout loaded successfully');
      } catch (error) {
        console.error('Failed to load layout:', error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <LayoutEditorPanel
        editorMode={editorMode}
        onModeChange={setEditorMode}
        selectedColor={selectedColor}
        onColorChange={setSelectedColor}
        selectedFurniture={selectedFurniture}
        onFurnitureChange={setSelectedFurniture}
        furnitureDirection={furnitureDirection}
        onRotate={() => setFurnitureDirection(rotateFurniture(furnitureDirection))}
        onSave={handleSave}
        onLoad={handleLoad}
      />
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={handleMouseLeave}
      />
    </>
  );
}
