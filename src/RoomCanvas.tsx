import React, { useRef, useEffect } from 'react';
import { parseHeightmap, depthSort } from './isoTypes.js';
import { initCanvas, computeCameraOrigin, preRenderRoom } from './isoTileRenderer.js';
import type { TileGrid, Renderable } from './isoTypes.js';
import type { FurnitureSpec, MultiTileFurnitureSpec } from './isoFurnitureRenderer.js';
import { createFurnitureRenderable, createMultiTileFurnitureRenderable } from './isoFurnitureRenderer.js';
import type { AvatarSpec } from './isoAvatarRenderer.js';
import { createAvatarRenderable, updateAvatarAnimation } from './isoAvatarRenderer.js';
import type { SpriteCache } from './isoSpriteCache.js';
import { pathToIsometricPositions, updateAvatarAlongPath, drawParentChildLine } from './isoAgentBehavior.js';
import type { TilePath, IsometricPosition } from './isoAgentBehavior.js';

interface RoomCanvasProps {
  heightmap: string;
}

export function RoomCanvas({ heightmap }: RoomCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(false);
  const rafIdRef = useRef(0);
  const renderState = useRef<{
    offscreenCanvas: OffscreenCanvas | null;
    cameraOrigin: { x: number; y: number };
    mainCtx: CanvasRenderingContext2D | null;
    avatars: AvatarSpec[];
    lastFrameTimeMs: number;
    avatarPaths: Map<string, { path: IsometricPosition[]; startTimeMs: number; durationMs: number }>;
    parentChildPairs: Array<{ parent: AvatarSpec; child: AvatarSpec }>;
  }>({
    offscreenCanvas: null,
    cameraOrigin: { x: 0, y: 0 },
    mainCtx: null,
    avatars: [],
    lastFrameTimeMs: Date.now(),
    avatarPaths: new Map(),
    parentChildPairs: [],
  });

  useEffect(() => {
    // Step 1: Get canvas from canvasRef.current — return early if null
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Step 2: Call initCanvas(canvas) -> mainCtx; store in renderState.current.mainCtx
    const mainCtx = initCanvas(canvas);
    renderState.current.mainCtx = mainCtx;

    // Step 3: Parse the heightmap
    const grid: TileGrid = parseHeightmap(heightmap);

    // Step 4: Compute camera origin
    renderState.current.cameraOrigin = computeCameraOrigin(
      grid,
      canvas.offsetWidth,
      canvas.offsetHeight
    );

    // Step 4.5: ALL 8 furniture types in 2 rows (Y=2,3) for maximum visibility
    const furniture: FurnitureSpec[] = [
      { name: 'chair', tileX: 1, tileY: 2, tileZ: 0, direction: 0 },      // 1-RED
      { name: 'lamp', tileX: 3, tileY: 2, tileZ: 0, direction: 0 },       // 4-ORANGE
      { name: 'plant', tileX: 5, tileY: 2, tileZ: 0, direction: 0 },      // 5-GREEN
      { name: 'computer', tileX: 7, tileY: 2, tileZ: 0, direction: 0 },   // 3-BLUE
      { name: 'whiteboard', tileX: 8, tileY: 3, tileZ: 0, direction: 0 }, // 8-WHITE
      { name: 'rug', tileX: 6, tileY: 3, tileZ: 0, direction: 0 },        // 7-YELLOW
    ];

    const multiTileFurniture: MultiTileFurnitureSpec[] = [
      { name: 'desk', tileX: 1, tileY: 3, tileZ: 0, widthTiles: 2, heightTiles: 1, direction: 0 },      // 2-CYAN (spans 1,3 and 2,3)
      { name: 'bookshelf', tileX: 3, tileY: 3, tileZ: 0, widthTiles: 2, heightTiles: 1, direction: 0 }, // 6-MAGENTA (spans 3,3 and 4,3)
    ];

    console.log('Placing 8 furniture items:', {
      singleTile: furniture.length,
      multiTile: multiTileFurniture.length,
      total: furniture.length + multiTileFurniture.length
    });

    // Get sprite cache from window (loaded in webview.tsx)
    const spriteCache: SpriteCache | undefined = (window as any).spriteCache;

    // Step 4.6: Create test avatars with pathfinding demonstration
    const now = Date.now();

    // Define demo BFS-style tile paths
    const demoPaths: Record<string, TilePath> = {
      path1: [
        { tileX: 2, tileY: 2, tileZ: 0 },
        { tileX: 3, tileY: 2, tileZ: 0 },
        { tileX: 4, tileY: 2, tileZ: 0 },
        { tileX: 5, tileY: 3, tileZ: 0 },
        { tileX: 6, tileY: 4, tileZ: 0 },
      ],
      path2: [
        { tileX: 8, tileY: 2, tileZ: 0 },
        { tileX: 7, tileY: 3, tileZ: 0 },
        { tileX: 6, tileY: 4, tileZ: 0 },
        { tileX: 5, tileY: 5, tileZ: 0 },
        { tileX: 4, tileY: 5, tileZ: 0 },
      ],
      path3: [
        { tileX: 2, tileY: 6, tileZ: 0 },
        { tileX: 3, tileY: 6, tileZ: 0 },
        { tileX: 4, tileY: 6, tileZ: 0 },
        { tileX: 5, tileY: 6, tileZ: 0 },
      ],
    };

    // Convert tile paths to isometric positions with directions
    const isoPaths: Record<string, IsometricPosition[]> = {
      path1: pathToIsometricPositions(demoPaths.path1),
      path2: pathToIsometricPositions(demoPaths.path2),
      path3: pathToIsometricPositions(demoPaths.path3),
    };

    console.log('Path1 converted:', isoPaths.path1.length, 'positions');
    console.log('First position:', isoPaths.path1[0]);

    const avatars: AvatarSpec[] = [
      {
        id: 'walker1',
        tileX: 2, tileY: 2, tileZ: 0,
        direction: 2,
        variant: 0,
        state: 'walk',
        frame: 0,
        lastUpdateMs: now,
        nextBlinkMs: now + 5000,
        blinkFrame: 0,
        spawnProgress: 0,
      },
      {
        id: 'walker2',
        tileX: 8, tileY: 2, tileZ: 0,
        direction: 6,
        variant: 0,
        state: 'walk',
        frame: 0,
        lastUpdateMs: now,
        nextBlinkMs: now + 6000,
        blinkFrame: 0,
        spawnProgress: 0,
      },
      {
        id: 'walker3',
        tileX: 2, tileY: 6, tileZ: 0,
        direction: 2,
        variant: 0,
        state: 'walk',
        frame: 0,
        lastUpdateMs: now,
        nextBlinkMs: now + 7000,
        blinkFrame: 0,
        spawnProgress: 0,
      },
      {
        id: 'idle1',
        tileX: 5, tileY: 7, tileZ: 0,
        direction: 0,
        variant: 0,
        state: 'idle',
        frame: 0,
        lastUpdateMs: now,
        nextBlinkMs: now + 5500,
        blinkFrame: 0,
        spawnProgress: 0,
      },
    ];

    console.log(`Placing ${avatars.length} avatars (3 walkers on paths, 1 idle)`);

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
      'furniture'
      // NO avatars - they render dynamically in frame()
    );

    // Step 5.5: Store avatars in renderState for animation loop
    renderState.current.avatars = avatars;

    // Step 5.6: Assign paths to walking avatars
    renderState.current.avatarPaths.set('walker1', {
      path: isoPaths.path1,
      startTimeMs: now,
      durationMs: 3000, // 3 seconds to traverse path
    });
    renderState.current.avatarPaths.set('walker2', {
      path: isoPaths.path2,
      startTimeMs: now,
      durationMs: 3500, // 3.5 seconds
    });
    renderState.current.avatarPaths.set('walker3', {
      path: isoPaths.path3,
      startTimeMs: now,
      durationMs: 2500, // 2.5 seconds
    });

    // Step 5.7: Set up parent-child relationship for demo
    const parent = avatars.find(a => a.id === 'walker1');
    const child = avatars.find(a => a.id === 'idle1');
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

        // Update position along path if assigned
        const pathData = renderState.current.avatarPaths.get(avatar.id);
        if (pathData) {
          updateAvatarAlongPath(
            avatar,
            pathData.path,
            currentTimeMs,
            pathData.startTimeMs,
            pathData.durationMs
          );

          // Loop path (restart when complete)
          const elapsed = currentTimeMs - pathData.startTimeMs;
          if (elapsed >= pathData.durationMs) {
            pathData.startTimeMs = currentTimeMs; // Restart
          }
        }
      }
      renderState.current.lastFrameTimeMs = currentTimeMs;

      // Console logging for validation (first time only)
      if (!(window as any)._loggedMovement && currentTimeMs - now > 500) {
        console.log('✓ Avatars moving along paths');
        const walker1 = renderState.current.avatars.find(a => a.id === 'walker1');
        if (walker1) {
          console.log('walker1 direction:', walker1.direction, 'state:', walker1.state);
        }
        (window as any)._loggedMovement = true;
      }

      // Clear canvas: ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Blit: ctx.drawImage(offscreen, 0, 0) — single drawImage per frame (ROOM-08)
      ctx.drawImage(offscreen, 0, 0);

      // Render avatars dynamically (NOT pre-rendered - animation state changes each frame)
      if (spriteCache && renderState.current.avatars.length > 0) {
        const avatarRenderables = renderState.current.avatars.map(spec => {
          const renderable = createAvatarRenderable(spec, spriteCache, 'avatar');

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
  }, [heightmap]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
