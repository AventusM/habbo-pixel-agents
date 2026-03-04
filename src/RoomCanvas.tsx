import React, { useRef, useEffect, useState } from 'react';
import { parseHeightmap, depthSort } from './isoTypes.js';
import { initCanvas, computeCameraOrigin, preRenderRoom, createFurnitureRenderables } from './isoTileRenderer.js';
import type { TileGrid, Renderable } from './isoTypes.js';
import type { FurnitureSpec, MultiTileFurnitureSpec } from './isoFurnitureRenderer.js';
import type { AvatarSpec } from './isoAvatarRenderer.js';
import { createAvatarRenderable, createNitroAvatarRenderable, updateAvatarAnimation, AVATAR_GROUND_Y } from './isoAvatarRenderer.js';
import type { SpriteCache } from './isoSpriteCache.js';
import { drawSpeechBubble } from './isoBubbleRenderer.js';
import { drawNameTag } from './isoNameTagRenderer.js';
import { tileToScreen, TILE_W_HALF, TILE_H_HALF } from './isometricMath.js';
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
import { getSupportedDirections } from './furnitureRegistry.js';
import { LayoutEditorPanel } from './LayoutEditorPanel.js';
import { AudioManager } from './isoAudioManager.js';
import { AvatarManager } from './avatarManager.js';
import { IdleWanderManager } from './idleWander.js';
import { AvatarSelectionManager } from './avatarSelection.js';
import type { ExtensionMessage } from './agentTypes.js';
import { computeBlockedTiles } from './isoPathfinding.js';

interface RoomCanvasProps {
  heightmap: string;
  editorMode?: EditorMode; // Optional, defaults to 'view'
}

// Avatar sprite height for name tag positioning (Nitro figure sprites)
const AVATAR_HEIGHT = 65;

/** Tiles where active agents walk to when working */
const DESK_TILES = [
  { x: 9, y: 5, dir: 0 as const },
  { x: 10, y: 5, dir: 0 as const },
  { x: 9, y: 6, dir: 0 as const },
  { x: 10, y: 6, dir: 0 as const },
];

export function RoomCanvas({ heightmap, editorMode: editorModeProp = 'view' }: RoomCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(false);
  const rafIdRef = useRef(0);

  // Audio manager (Phase 8)
  const audioManagerRef = useRef<AudioManager | null>(null);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const notificationSoundRef = useRef<AudioBuffer | null>(null);

  // Avatar management (v2)
  const avatarManagerRef = useRef<AvatarManager>(new AvatarManager());
  const idleWanderRef = useRef<IdleWanderManager>(new IdleWanderManager());
  const selectionManagerRef = useRef<AvatarSelectionManager>(new AvatarSelectionManager());

  // Track agent speech bubble text
  const agentToolTextRef = useRef<Map<string, string>>(new Map());

  // Editor UI state
  const [editorMode, setEditorMode] = useState<EditorMode>(editorModeProp);
  const [selectedColor, setSelectedColor] = useState<HsbColor>({ h: 200, s: 50, b: 50 });
  const [selectedFurniture, setSelectedFurniture] = useState<string>('hc_chr');
  const [furnitureDirection, setFurnitureDirection] = useState<number>(0);
  const renderState = useRef<{
    offscreenCanvas: OffscreenCanvas | null;
    cameraOrigin: { x: number; y: number };
    mainCtx: CanvasRenderingContext2D | null;
    lastFrameTimeMs: number;
    editorState: EditorState;
    grid: TileGrid | null;
    tileColorMap: Map<string, HsbColor>;
    furniture: FurnitureSpec[];
    multiTileFurniture: MultiTileFurnitureSpec[];
    furnitureRenderables: Renderable[];
  }>({
    offscreenCanvas: null,
    cameraOrigin: { x: 0, y: 0 },
    mainCtx: null,
    lastFrameTimeMs: Date.now(),
    editorState: {
      mode: 'view',
      hoveredTile: null,
      selectedColor: { h: 200, s: 50, b: 50 },
    },
    grid: null,
    tileColorMap: new Map(),
    furniture: [],
    multiTileFurniture: [],
    furnitureRenderables: [],
  });

  // Reset direction to first supported direction when furniture type changes
  useEffect(() => {
    const spriteCache: SpriteCache | undefined = (window as any).spriteCache;
    if (spriteCache) {
      const supported = getSupportedDirections(selectedFurniture, spriteCache);
      if (supported.length > 0 && !supported.includes(furnitureDirection)) {
        setFurnitureDirection(supported[0]);
      }
    }
  }, [selectedFurniture]);

  // Sync React editor state to renderState (no re-init)
  useEffect(() => {
    renderState.current.editorState.mode = editorMode;
    renderState.current.editorState.selectedColor = selectedColor;
    renderState.current.editorState.selectedFurniture = selectedFurniture;
    renderState.current.editorState.furnitureDirection = furnitureDirection;
  }, [editorMode, selectedColor, selectedFurniture, furnitureDirection]);

  // Listen for extension messages (agent events)
  useEffect(() => {
    function handleExtensionMessage(event: Event) {
      const msg = (event as CustomEvent<ExtensionMessage>).detail;
      if (!msg || !msg.type) return;

      const avatarManager = avatarManagerRef.current;
      const idleWander = idleWanderRef.current;
      const grid = renderState.current.grid;

      const blocked = computeBlockedTiles(
        renderState.current.furniture,
        renderState.current.multiTileFurniture,
      );

      switch (msg.type) {
        case 'agentCreated': {
          if (grid) {
            avatarManager.spawnAvatar(msg.agentId, msg.variant, grid, msg.terminalName, blocked);
            // New agents start wandering until they become active
            idleWander.startWandering(msg.agentId);
          }
          break;
        }
        case 'agentRemoved': {
          avatarManager.despawnAvatar(msg.agentId);
          idleWander.stopWandering(msg.agentId);
          selectionManagerRef.current.deselectAvatar();
          break;
        }
        case 'agentStatus': {
          if (msg.status === 'active' && grid) {
            idleWander.stopWandering(msg.agentId);
            // Move to a desk tile
            const deskTile = DESK_TILES.find(
              t => !avatarManager.getAvatarAtTile(t.x, t.y)
            ) || DESK_TILES[0];
            avatarManager.moveAvatarTo(msg.agentId, deskTile.x, deskTile.y, grid, deskTile.dir, blocked);
          } else if (msg.status === 'idle') {
            agentToolTextRef.current.delete(msg.agentId);
            idleWander.startWandering(msg.agentId);
          }
          break;
        }
        case 'agentTool': {
          agentToolTextRef.current.set(msg.agentId, msg.displayText);
          break;
        }
      }
    }

    window.addEventListener('extensionMessage', handleExtensionMessage);
    return () => window.removeEventListener('extensionMessage', handleExtensionMessage);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mainCtx = initCanvas(canvas);
    renderState.current.mainCtx = mainCtx;

    const grid: TileGrid = parseHeightmap(heightmap);
    renderState.current.grid = grid;

    renderState.current.cameraOrigin = computeCameraOrigin(
      grid,
      canvas.offsetWidth,
      canvas.offsetHeight
    );

    const furniture: FurnitureSpec[] = [];

    const multiTileFurniture: MultiTileFurnitureSpec[] = [];

    renderState.current.furniture = furniture;
    renderState.current.multiTileFurniture = multiTileFurniture;

    const spriteCache: SpriteCache | undefined = (window as any).spriteCache;

    renderState.current.offscreenCanvas = preRenderRoom(
      grid,
      renderState.current.cameraOrigin,
      canvas.width,
      canvas.height,
      window.devicePixelRatio || 1,
      undefined,
      undefined,
      undefined,
      undefined,
      'furniture',
      renderState.current.tileColorMap
    );

    if (spriteCache) {
      renderState.current.furnitureRenderables = createFurnitureRenderables(
        furniture,
        multiTileFurniture,
        spriteCache,
        renderState.current.cameraOrigin,
      );
    }

    runningRef.current = true;

    function frame() {
      if (!runningRef.current) return;

      const ctx = renderState.current.mainCtx;
      const offscreen = renderState.current.offscreenCanvas;

      if (!ctx || !offscreen || !canvas) return;

      const currentTimeMs = Date.now();

      // Tick avatar manager (path following)
      avatarManagerRef.current.tick(currentTimeMs);

      // Tick idle wander
      if (renderState.current.grid) {
        const blocked = computeBlockedTiles(
          renderState.current.furniture,
          renderState.current.multiTileFurniture,
        );
        idleWanderRef.current.tick(currentTimeMs, avatarManagerRef.current, renderState.current.grid, blocked);
      }

      // Update animation state for all avatars
      const avatars = avatarManagerRef.current.getAvatars();
      for (const avatar of avatars) {
        updateAvatarAnimation(avatar, currentTimeMs);
      }
      renderState.current.lastFrameTimeMs = currentTimeMs;

      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      ctx.drawImage(offscreen, 0, 0);

      // Draw hover highlight if tile is hovered (editor mode)
      if (renderState.current.editorState.hoveredTile) {
        const { x, y, z } = renderState.current.editorState.hoveredTile;
        drawHoverHighlight(ctx, x, y, z, renderState.current.cameraOrigin);

        // Show direction arrow when in furniture mode
        if (renderState.current.editorState.mode === 'furniture') {
          const dir = renderState.current.editorState.furnitureDirection ?? 0;
          const { x: sx, y: sy } = tileToScreen(x, y, z);
          const cx = sx + renderState.current.cameraOrigin.x;
          const cy = sy + TILE_H_HALF + renderState.current.cameraOrigin.y;
          // Direction arrows: 0=NE, 2=SE, 4=SW, 6=NW
          const arrows: Record<number, string> = { 0: '\u2197', 2: '\u2198', 4: '\u2199', 6: '\u2196' };
          ctx.save();
          ctx.font = '14px sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 100, 0.9)';
          ctx.textAlign = 'center';
          ctx.fillText(arrows[dir] || '?', cx, cy - 4);
          ctx.restore();
        }
      }

      // Render furniture + avatars with unified depth sorting
      const dynamicRenderables = [...renderState.current.furnitureRenderables];

      if (spriteCache && avatars.length > 0) {
        for (const spec of avatars) {
          const renderable = createNitroAvatarRenderable(spec, spriteCache)
            || createAvatarRenderable(spec, spriteCache, 'avatar');

          const originalDraw = renderable.draw;
          renderable.draw = (ctx) => {
            ctx.save();
            ctx.translate(renderState.current.cameraOrigin.x, renderState.current.cameraOrigin.y);
            originalDraw(ctx);
            ctx.restore();
          };

          dynamicRenderables.push(renderable);
        }
      }

      const sorted = depthSort(dynamicRenderables);
      for (const r of sorted) {
        r.draw(ctx);
      }

      if (spriteCache && avatars.length > 0) {
        // Draw selection highlight
        const selectedId = selectionManagerRef.current.selectedAvatarId;
        if (selectedId) {
          const selectedAvatar = avatarManagerRef.current.getAvatar(selectedId);
          if (selectedAvatar) {
            drawSelectionHighlight(ctx, selectedAvatar, renderState.current.cameraOrigin, currentTimeMs);
          }
        }

        // UI Overlays: name tags + speech bubbles
        ctx.font = '8px "Press Start 2P"';
        for (const avatar of avatars) {
          const { x: screenX, y: screenY } = tileToScreen(avatar.tileX, avatar.tileY, avatar.tileZ);
          const offsetX = avatar.screenOffsetX || 0;
          const offsetY = avatar.screenOffsetY || 0;
          const headY = screenY + AVATAR_GROUND_Y - AVATAR_HEIGHT + offsetY;

          const status = avatar.state === 'idle' ? 'idle' : 'active';

          ctx.save();
          ctx.translate(renderState.current.cameraOrigin.x, renderState.current.cameraOrigin.y);
          drawNameTag(ctx, {
            name: avatar.displayName || avatar.id,
            status,
            anchorX: screenX + offsetX,
            anchorY: headY,
          });
          ctx.restore();
        }

        for (const avatar of avatars) {
          // Skip speech bubbles during spawn/despawn animations
          if (avatar.state === 'spawning' || avatar.state === 'despawning') continue;

          const { x: screenX, y: screenY } = tileToScreen(avatar.tileX, avatar.tileY, avatar.tileZ);
          const offsetX = avatar.screenOffsetX || 0;
          const offsetY = avatar.screenOffsetY || 0;
          const headY = screenY + AVATAR_GROUND_Y - AVATAR_HEIGHT + offsetY;

          const toolText = agentToolTextRef.current.get(avatar.id);

          ctx.save();
          ctx.translate(renderState.current.cameraOrigin.x, renderState.current.cameraOrigin.y);
          drawSpeechBubble(ctx, {
            text: toolText || '',
            anchorX: screenX + offsetX,
            anchorY: headY,
            isWaiting: !toolText,
          }, currentTimeMs);
          ctx.restore();
        }
      }

      rafIdRef.current = requestAnimationFrame(frame);
    }

    rafIdRef.current = requestAnimationFrame(frame);

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [heightmap]);

  // Mouse event handlers for editor mode
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!renderState.current.grid) return;

    const hoveredCoords = getHoveredTile(event, renderState.current.cameraOrigin);

    if (hoveredCoords) {
      const { tileX, tileY } = hoveredCoords;
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
    if (!renderState.current.grid || !canvasRef.current) return;

    // Read event.currentTarget BEFORE any await (React clears it after)
    const clickedCoords = getHoveredTile(event, renderState.current.cameraOrigin);
    if (!clickedCoords) return;

    const { tileX, tileY } = clickedCoords;

    // Initialize audio on first click (autoplay policy compliance)
    if (!audioInitialized && !audioManagerRef.current) {
      audioManagerRef.current = new AudioManager();
      await audioManagerRef.current.init();
      setAudioInitialized(true);

      const notificationUri = (window as any).ASSET_URIS?.notificationSound;
      if (notificationUri) {
        notificationSoundRef.current = await audioManagerRef.current.loadSound(notificationUri);
      }
    }

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

    if (renderState.current.editorState.mode === 'furniture') {
      const furnitureType = renderState.current.editorState.selectedFurniture || 'exe_chair';
      const direction = renderState.current.editorState.furnitureDirection ?? 0;
      const spriteCache: SpriteCache | undefined = (window as any).spriteCache;
      console.log(`[Furniture] Placing ${furnitureType} at (${tileX},${tileY}) dir=${direction}`);
      const placed = placeFurniture(
        renderState.current.grid,
        renderState.current.furniture,
        renderState.current.multiTileFurniture,
        tileX, tileY, furnitureType, direction,
        spriteCache,
      );
      if (placed) reRenderRoom();
      return;
    }

    // View mode: avatar selection + click-to-move
    const selectionMgr = selectionManagerRef.current;
    const avatarManager = avatarManagerRef.current;

    // Check if clicked tile has an avatar standing on it
    const clickedAvatar = avatarManager.getAvatarAtTile(tileX, tileY);

    if (clickedAvatar) {
      // Toggle selection
      if (selectionMgr.isSelected(clickedAvatar.id)) {
        selectionMgr.deselectAvatar();
      } else {
        selectionMgr.selectAvatar(clickedAvatar.id);
      }
      // Update isSelected on all avatars
      for (const avatar of avatarManager.getAvatars()) {
        avatar.isSelected = selectionMgr.isSelected(avatar.id);
      }
      return;
    }

    // If an avatar is selected and clicked a walkable tile, move there
    if (selectionMgr.selectedAvatarId && renderState.current.grid) {
      const tile = renderState.current.grid.tiles[tileY]?.[tileX];
      if (tile !== null && tile !== undefined) {
        const blocked = computeBlockedTiles(
          renderState.current.furniture,
          renderState.current.multiTileFurniture,
        );
        const moved = avatarManager.moveAvatarTo(
          selectionMgr.selectedAvatarId, tileX, tileY, renderState.current.grid, undefined, blocked
        );
        if (moved) {
          // Stop idle wandering for this avatar while it walks to clicked tile
          idleWanderRef.current.stopWandering(selectionMgr.selectedAvatarId);
        }
        selectionMgr.deselectAvatar();
        for (const avatar of avatarManager.getAvatars()) {
          avatar.isSelected = false;
        }
      }
      return;
    }

    // Click on empty space — deselect
    selectionMgr.deselectAvatar();
    for (const avatar of avatarManager.getAvatars()) {
      avatar.isSelected = false;
    }
  };

  const handleMouseLeave = () => {
    renderState.current.editorState.hoveredTile = null;
  };

  function reRenderRoom() {
    if (!canvasRef.current || !renderState.current.grid) return;
    renderState.current.offscreenCanvas = preRenderRoom(
      renderState.current.grid,
      renderState.current.cameraOrigin,
      canvasRef.current.width,
      canvasRef.current.height,
      window.devicePixelRatio || 1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      renderState.current.tileColorMap
    );

    const spriteCache: SpriteCache | undefined = (window as any).spriteCache;
    if (spriteCache) {
      renderState.current.furnitureRenderables = createFurnitureRenderables(
        renderState.current.furniture,
        renderState.current.multiTileFurniture,
        spriteCache,
        renderState.current.cameraOrigin,
      );
    }
  }

  const handleSave = () => {
    if (!renderState.current.grid) return;

    const json = saveLayout(
      renderState.current.grid,
      renderState.current.tileColorMap,
      renderState.current.furniture,
      renderState.current.multiTileFurniture,
      { x: 0, y: 0, z: 0, dir: 2 }
    );

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

        const newGrid = parseHeightmap(data.heightmap);
        renderState.current.grid = newGrid;
        renderState.current.tileColorMap = new Map(Object.entries(data.tileColors));
        renderState.current.furniture = data.furniture;
        renderState.current.multiTileFurniture = data.multiTileFurniture;

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
        onRotate={() => {
          const spriteCache: SpriteCache | undefined = (window as any).spriteCache;
          const supported = spriteCache
            ? getSupportedDirections(selectedFurniture, spriteCache)
            : undefined;
          setFurnitureDirection(rotateFurniture(furnitureDirection, supported));
        }}
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

/**
 * Draw a pulsing cyan rhombus outline at the selected avatar's tile.
 */
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
  const cy = sy + oy + cameraOrigin.y + TILE_H_HALF; // Center of tile

  // Pulse alpha between 0.4 and 1.0
  const pulse = 0.7 + 0.3 * Math.sin(currentTimeMs / 300);

  ctx.save();
  ctx.strokeStyle = `rgba(0, 255, 255, ${pulse})`;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(cx, cy - TILE_H_HALF);           // top
  ctx.lineTo(cx + TILE_W_HALF, cy);           // right
  ctx.lineTo(cx, cy + TILE_H_HALF);           // bottom
  ctx.lineTo(cx - TILE_W_HALF, cy);           // left
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}
