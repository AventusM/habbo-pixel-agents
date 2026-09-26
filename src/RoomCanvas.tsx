import React, { useRef, useEffect, useState } from 'react';
import { parseHeightmap } from './isoTypes.js';
import { computeCameraOrigin, createFurnitureRenderables } from './isoTileRenderer.js';
import { CanvasStage } from './render/CanvasStage.js';
import { drawScene, type SceneInputs } from './render/sceneRenderer.js';
import { computeFitZoom } from './render/roomBounds.js';
import type { TileGrid, Renderable, HsbColor } from './isoTypes.js';
import type { FurnitureSpec, MultiTileFurnitureSpec } from './isoFurnitureRenderer.js';
import type { AvatarRenderer } from './avatarRendererTypes.js';
import { pixelLabRenderer } from './pixelLabAvatarRenderer.js';
import type { SpriteCache } from './isoSpriteCache.js';
import { habboRenderer } from './isoAvatarRenderer.js';
import { tileToScreen, screenToTile } from './isometricMath.js';
import { KANBAN_FILTER_LABELS } from './kanbanFilter.js';
import {
  toggleTileWalkability,
  setTileColor,
  placeFurniture,
  rotateFurniture,
  saveLayout,
  loadLayout,
  type EditorMode,
  type EditorState,
} from './isoLayoutEditor.js';
import { getSupportedDirections, isChairType, isTeleportBooth } from './furnitureRegistry.js';
import { onMessage } from './bus.js';
import type { ExtensionMessage, TeamSection } from './agentTypes.js';
import { computeBlockedTiles } from './isoPathfinding.js';
import { drawKanbanNotes, createKanbanRenderState, type KanbanRenderState, pointInQuad } from './isoKanbanRenderer.js';
import { screenToWorld, jumpToSection } from './cameraController.js';
import { SectionManager } from './sectionManager.js';
import { type FloorTemplate, buildSectionColorMap } from './roomLayoutEngine.js';
import { agentStore } from './state/agentStore.js';
import { kanbanStore } from './state/kanbanStore.js';
import { cameraStore } from './state/cameraStore.js';
import { expRunStore } from './state/expRunStore.js';
import { uiStore, selectDevMode } from './state/uiStore.js';
import { syncExpRunsToAgents } from './expFeed.js';
import { useStoreValue } from './hooks/useStoreValue.js';
import { useKanbanFilter } from './hooks/useKanbanFilter.js';
import { useRoomAudio } from './hooks/useRoomAudio.js';
import { useAutoFollowCamera } from './hooks/useAutoFollowCamera.js';
import { useRoomAgents } from './hooks/useRoomAgents.js';
import { KanbanFilterChip } from './components/KanbanFilterChip.js';
import { RoomStage } from './components/RoomStage.js';
import { RoomDevChrome } from './components/RoomDevChrome.js';
import { useRoomHud } from './hooks/useRoomHud.js';

interface RoomCanvasProps {
  heightmap: string;
  editorMode?: EditorMode; // Optional, defaults to 'view'
}

export function RoomCanvas({ heightmap, editorMode: editorModeProp = 'view' }: RoomCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas lifecycle, camera, input, layers and frame scheduling (M003/S03)
  const stageRef = useRef<CanvasStage | null>(null);

  const { ensureInitialized, playSound, availableSounds, ready } = useRoomAudio();

  const { setEnabled: setAutoFollow, tick: autoFollowTick } = useAutoFollowCamera();

  // Dev mode flag (set by extension in Development mode) — uiStore is the single
  // source of truth; the bus writes it, the shell reads it back through the store.
  const devMode = useStoreValue(uiStore, selectDevMode);

  // Kanban source filter (All / GSD only / Non-GSD) — mirrored from kanbanStore for the HUD.
  const kanbanFilter = useKanbanFilter();

  // Per-render kanban hit-test state (replaces renderer module-level state)
  const kanbanRenderStateRef = useRef<KanbanRenderState>(createKanbanRenderState());

  // Active avatar renderer (logged on change; Habbo figures vs PixelLab/RD)
  const activeRendererRef = useRef<AvatarRenderer | null>(null);

  useEffect(() => {
    const handleFilterKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        kanbanStore.cycleFilter();
        return;
      }
      // Kanban traversal keys (only while a detail note is open)
      if (!expandedNoteRef.current) return;
      const visibleCards = kanbanStore.visibleCards();
      if (visibleCards.length === 0) return;
      const idx = Math.max(0, visibleCards.findIndex(c => c.id === expandedNoteRef.current));
      if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
        expandedNoteRef.current = visibleCards[(idx + 1) % visibleCards.length].id;
      } else if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
        expandedNoteRef.current = visibleCards[(idx - 1 + visibleCards.length) % visibleCards.length].id;
      } else if (e.key === 'b' || e.key === 'B') {
        if (noteOriginRef.current) {
          expandedAggregateRef.current = noteOriginRef.current;
          noteOriginRef.current = null;
          expandedNoteRef.current = null;
        } else {
          expandedNoteRef.current = null;
        }
      } else if (e.key === 'Escape') {
        expandedNoteRef.current = null;
        expandedAggregateRef.current = null;
        noteOriginRef.current = null;
      }
    };
    window.addEventListener('keydown', handleFilterKey);
    return () => window.removeEventListener('keydown', handleFilterKey);
  }, []);

  // Expanded sticky note (click-to-open)
  const expandedNoteRef = useRef<string | null>(null);

  // Where the expanded note was opened from ('todo'/'done' aggregate or a wall note)
  const noteOriginRef = useRef<'todo' | 'done' | null>(null);

  // Expanded aggregate note (todo / done)
  const expandedAggregateRef = useRef<'todo' | 'done' | null>(null);

  // Editor UI state
  const [editorMode, setEditorMode] = useState<EditorMode>(editorModeProp);
  const [selectedColor, setSelectedColor] = useState<HsbColor>({ h: 200, s: 50, b: 50 });
  const [selectedFurniture, setSelectedFurniture] = useState<string>('hc_chr');
  const [furnitureDirection, setFurnitureDirection] = useState<number>(0);

  const renderState = useRef<{
    cameraOrigin: { x: number; y: number };
    lastFrameTimeMs: number;
    editorState: EditorState;
    grid: TileGrid | null;
    tileColorMap: Map<string, HsbColor>;
    furniture: FurnitureSpec[];
    multiTileFurniture: MultiTileFurnitureSpec[];
    furnitureRenderables: Renderable[];
  }>({
    cameraOrigin: { x: 0, y: 0 },
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

  /**
   * Convert a pointer position (client coords) to tile coordinates, accounting
   * for camera pan/zoom and the static camera origin offset.
   */
  function mouseToTile(clientX: number, clientY: number): { tileX: number; tileY: number } | null {
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
  }

  /** Update the hovered-tile editor state from a pointer position. */
  function updateHover(clientX: number, clientY: number) {
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
  }

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

  /**
   * Set a teleport booth's frame index (0=closed, 1=open) and rebuild renderables.
   */
  function setBoothFrame(tileX: number, tileY: number, frameIndex: number) {
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
  }

  // Room orchestration hook (M008/S01): owns the lifecycle managers and the
  // agent spawn/despawn/status/tool/wander glue; the shell only consumes it.
  const {
    avatarManager,
    idleWander,
    selectionManager,
    sectionManagerRef,
    teleportEffectsRef,
    walkableBoothsRef,
    ensureSectionManager,
    handleAgentCreated,
    handleAgentRemoved,
    handleAgentStatus,
    handleAgentTool,
    handleAgentLinkedTicket,
    tickIdleWander,
    tickDespawns,
    processPendingStepOuts,
  } = useRoomAgents({
    getGrid: () => renderState.current.grid,
    getFurniture: () => renderState.current.furniture,
    getMultiTileFurniture: () => renderState.current.multiTileFurniture,
    getCameraOrigin: () => renderState.current.cameraOrigin,
    setBoothFrame,
  });

  // Orchestration + experiment-history HUD data wiring (M008/S02 T04)
  const { getOrchState, getExpHistory } = useRoomHud();

  // Listen for extension messages (agent events) via the typed bus
  useEffect(() => {
    function handleExtensionMessage(msg: ExtensionMessage) {
      if (!msg || !msg.type) return;

      // Initialize section manager lazily from global template
      const sectionManager = ensureSectionManager();

      switch (msg.type) {
        case 'clearAgents': {
          // Remove all avatars on reconnect — server will re-send current sessions
          const allIds = avatarManager.getAllAvatarIds();
          for (const id of allIds) {
            avatarManager.removeAvatar(id);
          }
          // Store transition: agents clear, then repopulate as the server re-sends
          agentStore.clear();
          console.log(`[Room] Cleared ${allIds.length} stale agents on reconnect`);
          break;
        }
        case 'agentCreated': {
          handleAgentCreated(msg);
          break;
        }
        case 'agentRemoved': {
          handleAgentRemoved(msg);
          break;
        }
        case 'agentStatus': {
          handleAgentStatus(msg);
          break;
        }
        case 'agentTool': {
          handleAgentTool(msg);
          break;
        }
        case 'agentLinkedTicket': {
          handleAgentLinkedTicket(msg);
          break;
        }
        case 'jumpToSection': {
          const jumpMsg = msg as any;
          const team = jumpMsg.team as TeamSection;
          const stage = stageRef.current;
          if (sectionManager && canvasRef.current && stage) {
            const center = sectionManager.getSectionCenter(team);
            if (center) {
              const { x: sx, y: sy } = tileToScreen(center.x, center.y, 0);
              const ox = renderState.current.cameraOrigin;
              const canvas = canvasRef.current;
              jumpToSection(
                stage.camera,
                sx + ox.x,
                sy + ox.y,
                canvas.offsetWidth,
                canvas.offsetHeight,
              );
              cameraStore.notify();
            }
          }
          break;
        }
        case 'toggleOverlay': {
          agentStore.toggleVisible();
          break;
        }
        case 'autoFollow': {
          setAutoFollow((msg as any).enabled);
          break;
        }
        case 'kanbanCards': {
          kanbanStore.setCards(msg.cards);
          break;
        }
        case 'devMode': {
          uiStore.setDevMode(msg.enabled);
          break;
        }
        // Layout editor commands from sidebar control panel
        case 'editorMode': {
          const mode = (msg as any).mode as EditorMode;
          setEditorMode(mode);
          break;
        }
        case 'editorColor': {
          const { h, s, b } = msg as any;
          setSelectedColor({ h, s, b });
          break;
        }
        case 'editorFurniture': {
          setSelectedFurniture((msg as any).furniture);
          break;
        }
        case 'editorRotate': {
          const sc: SpriteCache | undefined = (window as any).spriteCache;
          const curFurn = renderState.current.editorState.selectedFurniture || 'hc_chr';
          const curDir = renderState.current.editorState.furnitureDirection ?? 0;
          const sup = sc ? getSupportedDirections(curFurn, sc) : undefined;
          setFurnitureDirection(rotateFurniture(curDir, sup));
          break;
        }
        case 'editorSave': {
          handleSave();
          break;
        }
        case 'editorLoad': {
          // Trigger file input click programmatically
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = () => {
            const file = input.files?.[0];
            if (file) handleLoad(file);
          };
          input.click();
          break;
        }
        case 'devCapture': {
          handleDevCapture();
          break;
        }
        case 'playSound': {
          playSound((msg as any).sound || 'notification');
          break;
        }
      }
    }

    const unsubscribe = onMessage(handleExtensionMessage);
    return () => unsubscribe();
  }, []);

  // Stage lifecycle: canvas setup, room/notes layers, camera fit, frame loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stage = new CanvasStage(canvas, {
      canDrag: (e) =>
        e.button === 1 || (e.button === 0 && renderState.current.editorState.mode === 'view'),
      onHover: (clientX, clientY) => updateHover(clientX, clientY),
      onHoverEnd: () => {
        renderState.current.editorState.hoveredTile = null;
      },
      onResize: () => {
        if (renderState.current.grid) {
          renderRoomBuffer();
          const bufSize = stage.roomLayer.size;
          if (bufSize.w > 0) {
            stage.camera.panX = canvas.offsetWidth / 2 - bufSize.w / 2;
            stage.camera.panY = canvas.offsetHeight / 2 - bufSize.h / 2;
            cameraStore.notify();
          }
        }
      },
    });
    stageRef.current = stage;
    stage.init();

    // Stores feed the frame scheduler: any state change invalidates the static
    // throttle so the next rAF renders instead of waiting up to 50ms.
    const unsubscribeStores = [
      kanbanStore.subscribe(() => stage.invalidate()),
      agentStore.subscribe(() => stage.invalidate()),
      cameraStore.subscribe(() => stage.invalidate()),
      expRunStore.subscribe(() => stage.invalidate()),
    ];

    const grid: TileGrid = parseHeightmap(heightmap);
    renderState.current.grid = grid;

    const furniture: FurnitureSpec[] = [];

    // Initialize section manager, apply section floor colors, and place teleport booths
    const tmpl = (window as any).floorTemplate as FloorTemplate | undefined;
    if (tmpl) {
      sectionManagerRef.current = new SectionManager(tmpl);
      renderState.current.tileColorMap = buildSectionColorMap(tmpl);
      for (const section of tmpl.sections) {
        for (const f of section.furniture) {
          furniture.push(f);
        }
      }
    }

    const multiTileFurniture: MultiTileFurnitureSpec[] = [];

    renderState.current.furniture = furniture;
    renderState.current.multiTileFurniture = multiTileFurniture;

    // Pre-render the room into an offscreen buffer sized to the ROOM's world
    // extent (not the viewport), so the full room is always rendered and
    // camera zoom/pan merely navigates the buffer.
    renderRoomBuffer();

    // Camera: center the room buffer on screen, zoomed to fit if needed
    const bufSize = stage.roomLayer.size;
    if (bufSize) {
      stage.camera.zoom = computeFitZoom(grid, canvas.offsetWidth, canvas.offsetHeight);
      stage.camera.panX = canvas.offsetWidth / 2 - bufSize.w / 2;
      stage.camera.panY = canvas.offsetHeight / 2 - bufSize.h / 2;
      cameraStore.notify();
    }

    const onTick = (nowMs: number): boolean => {
      // Tick avatar manager (path following)
      avatarManager.tick(nowMs);

      // Tick idle wander
      tickIdleWander(nowMs);

      // Check despawning agents: if they've reached the booth tile, trigger despawn effect
      tickDespawns(nowMs);

      // Avatar renderer selection: original Habbo figures when the figure
      // assets are loaded locally, PixelLab/RD single-sprites otherwise
      const spriteCache = (window as any).spriteCache as SpriteCache | undefined;
      const activeRenderer: AvatarRenderer =
        spriteCache && habboRenderer.isAvailable(spriteCache) ? habboRenderer : pixelLabRenderer;
      if (activeRenderer !== activeRendererRef.current) {
        console.log(`[Avatars] Renderer: ${activeRenderer.name}`);
        activeRendererRef.current = activeRenderer;
      }

      // Update animation state for all avatars
      const avatars = avatarManager.getAvatars();
      for (const avatar of avatars) {
        activeRenderer.updateAnimation(avatar, nowMs);
      }
      renderState.current.lastFrameTimeMs = nowMs;

      // Scene is dynamic while teleport effects play or agents walk/spawn/despawn
      let anyMoving = teleportEffectsRef.current.length > 0;
      if (!anyMoving) {
        for (const a of avatars) {
          const s = a.state;
          if (s === 'walk' || s === 'spawning' || s === 'despawning') {
            anyMoving = true;
            break;
          }
        }
      }
      return anyMoving;
    };

    const onDraw = (nowMs: number) => {
      const grid = renderState.current.grid;
      const ctx = stage.context;
      if (!grid || !ctx) return;

      // Check pending step-outs: move agent out of booth once spawn animation ends
      processPendingStepOuts();

      // Auto-follow camera: every 3 seconds check most active section
      autoFollowTick(
        nowMs,
        stage.camera,
        canvas.offsetWidth,
        canvas.offsetHeight,
        renderState.current.cameraOrigin,
        sectionManagerRef.current,
      );

      const spriteCache = (window as any).spriteCache as SpriteCache | undefined;
      const avatars = avatarManager.getAvatars();
      const activeRenderer = activeRendererRef.current;
      if (!activeRenderer) return;

      // Notes layer (cached world-space kanban stickies), rendered on change
      let notesBuffer: OffscreenCanvas | null = null;
      let notesSize = { w: 0, h: 0 };
      if (kanbanStore.cards.length > 0) {
        const size = stage.roomLayer.size;
        const origin = renderState.current.cameraOrigin;
        const cards = kanbanStore.visibleCards();
        const ticketIds = agentStore.linkedTicketIds();
        const signature = [
          cards.length,
          cards.map(c => c.id).join(','),
          expandedNoteRef.current ?? '',
          expandedAggregateRef.current ?? '',
          [...ticketIds].sort().join(','),
          `${size.w}x${size.h}`,
          `${origin.x},${origin.y}`,
        ].join('|');
        const notes = stage.ensureNotes(signature, size, (bctx) => {
          drawKanbanNotes(
            bctx,
            cards,
            grid,
            origin,
            expandedNoteRef.current,
            expandedAggregateRef.current,
            ticketIds,
            kanbanRenderStateRef.current,
          );
        });
        notesBuffer = notes.buffer;
        notesSize = notes.size;
      }

      const inputs: SceneInputs = {
        ctx,
        canvasW: canvas.offsetWidth,
        canvasH: canvas.offsetHeight,
        cam: stage.camera,
        cameraOrigin: renderState.current.cameraOrigin,
        roomBuffer: stage.roomLayer.buffer,
        roomSize: stage.roomLayer.size,
        notesBuffer,
        notesSize,
        grid,
        editorState: renderState.current.editorState,
        gridFurniture: renderState.current.furniture,
        multiTileFurniture: renderState.current.multiTileFurniture,
        furnitureRenderables: renderState.current.furnitureRenderables,
        spriteCache,
        avatars,
        activeRenderer,
        agentToolText: agentStore.toolTextMap(),
        sectionManager: sectionManagerRef.current,
        selectionManager,
        teleportEffects: teleportEffectsRef.current,
        orchState: getOrchState(),
        expHistory: getExpHistory(),
        kanbanCards: kanbanStore.cards,
        kanbanFilter: kanbanStore.filter,
        expandedNote: expandedNoteRef.current,
        expandedAggregate: expandedAggregateRef.current,
        noteOrigin: noteOriginRef.current,
        kanbanRenderState: kanbanRenderStateRef.current,
      };
      teleportEffectsRef.current = drawScene(inputs, nowMs);
    };

    stage.start(onTick, onDraw);

    return () => {
      for (const unsubscribe of unsubscribeStores) unsubscribe();
      stage.stop();
      stageRef.current = null;
    };
  }, [heightmap]);

  // Mirror experiment runs as room agents (one avatar per active run).
  useEffect(() => {
    const unsubscribe = expRunStore.subscribe(() => {
      syncExpRunsToAgents(agentStore, expRunStore.all(), agentStore.all().map(a => a.agentId));
      stageRef.current?.invalidate();
    });
    return () => unsubscribe();
  }, []);

  const handleClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
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
  };

  const handleContextMenu = async (event: React.MouseEvent<HTMLCanvasElement>) => {
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
  };

  /**
   * (Re-)render the room layer. The layer is sized to the ROOM's world extent
   * (not the viewport) via src/render/layers.ts; current call sites force a
   * render (init, resize, booth frames, layout edits) — the invalidation key
   * is in place for future incremental use.
   */
  function renderRoomBuffer() {
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
      furniture: renderState.current.furniture,
      multiTileFurniture: renderState.current.multiTileFurniture,
      spriteCache,
    });
    renderState.current.cameraOrigin = result.origin;
    renderState.current.furnitureRenderables =
      result.furnitureRenderables as Renderable[];
  }

  function reRenderRoom() {
    renderRoomBuffer();
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

  const handleDevCapture = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const screenshot = canvas.toDataURL('image/png');
    const logs = [...((window as any).__devLogBuffer || [])];
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ type: 'devCapture', screenshot, logs });
    }
  };

  return (
    <>
      <RoomDevChrome
        editorMode={editorMode}
        onModeChange={setEditorMode}
        selectedColor={selectedColor}
        onColorChange={setSelectedColor}
        selectedFurniture={selectedFurniture}
        onFurnitureChange={setSelectedFurniture}
        furnitureDirection={furnitureDirection}
        devMode={devMode}
        onDevCapture={handleDevCapture}
        onPlaySound={playSound}
        availableSounds={availableSounds}
        audioReady={ready}
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
      <RoomStage canvasRef={canvasRef} onClick={handleClick} onContextMenu={handleContextMenu} />
      {/* Kanban source filter HUD */}
      <KanbanFilterChip label={KANBAN_FILTER_LABELS[kanbanFilter]} />
    </>
  );
}
