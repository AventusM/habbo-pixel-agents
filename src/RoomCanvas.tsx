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
import { tileToScreen, TILE_H_HALF, screenToTile } from './isometricMath.js';
import { KANBAN_FILTER_LABELS, type KanbanFilterMode } from './kanbanFilter.js';
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
import { LayoutEditorPanel } from './LayoutEditorPanel.js';
import { AudioManager } from './isoAudioManager.js';
import { AvatarManager } from './avatarManager.js';
import { IdleWanderManager } from './idleWander.js';
import { AvatarSelectionManager } from './avatarSelection.js';
import { onMessage } from './bus.js';
import type { ExtensionMessage, TeamSection } from './agentTypes.js';
import { computeBlockedTiles } from './isoPathfinding.js';
import { drawKanbanNotes, createKanbanRenderState, type KanbanRenderState, pointInQuad } from './isoKanbanRenderer.js';
import { screenToWorld, jumpToSection } from './cameraController.js';
import { SectionManager } from './sectionManager.js';
import { type FloorTemplate, buildSectionColorMap } from './roomLayoutEngine.js';
import { createTeleportEffect } from './teleportEffect.js';
import type { TeleportEffect } from './teleportEffect.js';
import { agentStore } from './state/agentStore.js';
import { kanbanStore } from './state/kanbanStore.js';
import { cameraStore } from './state/cameraStore.js';

interface RoomCanvasProps {
  heightmap: string;
  editorMode?: EditorMode; // Optional, defaults to 'view'
}

export function RoomCanvas({ heightmap, editorMode: editorModeProp = 'view' }: RoomCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas lifecycle, camera, input, layers and frame scheduling (M003/S03)
  const stageRef = useRef<CanvasStage | null>(null);

  // Audio manager (Phase 8)
  const audioManagerRef = useRef<AudioManager | null>(null);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const soundBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());

  // Avatar management (v2)
  const avatarManagerRef = useRef<AvatarManager>(new AvatarManager());
  const idleWanderRef = useRef<IdleWanderManager>(new IdleWanderManager());
  const selectionManagerRef = useRef<AvatarSelectionManager>(new AvatarSelectionManager());

  // Section manager for team-based agent placement
  const sectionManagerRef = useRef<SectionManager | null>(null);

  // Active teleport effects (spawn/despawn flash)
  const teleportEffectsRef = useRef<TeleportEffect[]>([]);

  // Agents mid-despawn (walking to booth before removal)
  const despawningAgentsRef = useRef<Set<string>>(new Set());

  // Booth tiles temporarily made walkable during spawn/despawn
  const walkableBoothsRef = useRef<Set<string>>(new Set());

  // Agents waiting to step out of booth after spawn animation completes
  // Maps agentId → booth tile {x, y}
  const pendingStepOutRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Agent popup card (shows role/team info on click)
  const popupAgentRef = useRef<string | null>(null); // kept for click handling
  const popupTimeRef = useRef<number>(0); // kept for click handling

  // Auto-follow camera toggle and state
  const autoFollowRef = useRef(false);
  const lastAutoFollowCheckRef = useRef<number>(0);
  const autoFollowTargetRef = useRef<{ panX: number; panY: number } | null>(null);

  // Dev mode flag (set by extension in Development mode)
  const [devMode, setDevMode] = useState(false);

  // Kanban source filter (All / GSD only / Non-GSD) — toggle with the G key.
  // Mirrored from kanbanStore (source of truth) for the HUD.
  const [kanbanFilter, setKanbanFilter] = useState<KanbanFilterMode>(kanbanStore.filter);

  // Per-render kanban hit-test state (replaces renderer module-level state)
  const kanbanRenderStateRef = useRef<KanbanRenderState>(createKanbanRenderState());

  // Active avatar renderer (logged on change; Habbo figures vs PixelLab/RD)
  const activeRendererRef = useRef<AvatarRenderer | null>(null);

  // Mirror the kanban filter store into React state for the HUD
  useEffect(() => kanbanStore.subscribe((state) => setKanbanFilter(state.filter)), []);

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

  // Listen for extension messages (agent events) via the typed bus
  useEffect(() => {
    function handleExtensionMessage(msg: ExtensionMessage) {
      if (!msg || !msg.type) return;

      const avatarManager = avatarManagerRef.current;
      const idleWander = idleWanderRef.current;
      const grid = renderState.current.grid;

      const blocked = computeBlockedTiles(
        renderState.current.furniture,
        renderState.current.multiTileFurniture,
        walkableBoothsRef.current,
      );

      // Initialize section manager lazily from global template
      if (!sectionManagerRef.current) {
        const tmpl = (window as any).floorTemplate as FloorTemplate | undefined;
        if (tmpl) {
          sectionManagerRef.current = new SectionManager(tmpl);
        }
      }
      const sectionManager = sectionManagerRef.current;

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
          // Guard: skip if avatar already exists (prevents duplicate side effects from re-broadcast)
          if (avatarManager.getAvatar(msg.agentId)) {
            console.log(`[Room] agentCreated: ${msg.agentId} already exists, skipping`);
            break;
          }
          if (grid) {
            const team: TeamSection = (msg as any).team || 'core-dev';
            console.log(`[Room] agentCreated: ${msg.agentId} team=${team}`);

            // Try to spawn at section teleport booth
            const spawnTile = sectionManager?.getSpawnTile(team);
            console.log(`[Room] spawnTile for ${team}:`, spawnTile);
            let avatar;
            if (spawnTile) {
              // Temporarily make booth tile walkable and open door
              const boothKey = `${spawnTile.x},${spawnTile.y}`;
              walkableBoothsRef.current.add(boothKey);
              setBoothFrame(spawnTile.x, spawnTile.y, 1);
              avatar = avatarManager.spawnAvatarAt(msg.agentId, msg.variant, spawnTile.x, spawnTile.y, 0, grid, msg.terminalName, team);
              console.log(`[Room] spawnAvatarAt result:`, avatar ? 'ok' : 'null');
              // Create teleport flash effect at spawn position
              if (avatar) {
                const { x: sx, y: sy } = tileToScreen(spawnTile.x, spawnTile.y, 0);
                const ox = renderState.current.cameraOrigin;
                console.log(`[Room] Creating teleport flash at sx=${sx + ox.x}, sy=${sy + TILE_H_HALF + ox.y}`);
                teleportEffectsRef.current.push(
                  createTeleportEffect(sx + ox.x, sy + TILE_H_HALF + ox.y, 'spawn')
                );
                // Register pending step-out (handled in render loop when spawn animation ends)
                pendingStepOutRef.current.set(msg.agentId, { ...spawnTile });
              } else {
                // Spawn failed, revert walkability
                walkableBoothsRef.current.delete(boothKey);
                setBoothFrame(spawnTile.x, spawnTile.y, 0);
              }
            } else {
              // Fallback: random tile
              avatar = avatarManager.spawnAvatar(msg.agentId, msg.variant, grid, msg.terminalName, blocked, team);
            }

            // Assign agent to section and record initial activity
            if (sectionManager) {
              sectionManager.assignAgent(msg.agentId, team);
              sectionManager.updateActivity(team, Date.now());
            }

            // Track in agent store (drives the orchestration overlay)
            agentStore.addAgent(msg.agentId, msg.terminalName || msg.agentId, team);

            // Set role-specific idle behavior before starting wander
            idleWander.setAgentRole(msg.agentId, team);

            // New agents start wandering until they become active
            idleWander.startWandering(msg.agentId);
          }
          break;
        }
        case 'agentRemoved': {
          console.log(`[Room] agentRemoved: ${msg.agentId}`);
          agentStore.removeAgent(msg.agentId);
          const agentTeam = sectionManager?.getAgentTeam(msg.agentId);
          const boothTile = agentTeam ? sectionManager?.getSpawnTile(agentTeam) : null;
          const avatar = avatarManager.getAvatar(msg.agentId);
          console.log(`[Room] despawn: team=${agentTeam}, boothTile=`, boothTile, `avatar=`, avatar ? `at(${avatar.tileX},${avatar.tileY})` : 'null');

          if (boothTile && avatar && grid) {
            // Walk-to-booth despawn flow — temporarily make booth walkable
            const despawnBoothKeyOuter = `${boothTile.x},${boothTile.y}`;
            walkableBoothsRef.current.add(despawnBoothKeyOuter);
            despawningAgentsRef.current.add(msg.agentId);
            idleWander.stopWandering(msg.agentId);

            // Stand up if sitting
            if (avatar.state === 'sit') {
              avatarManager.standAvatar(msg.agentId);
            }

            // If already at booth tile, trigger despawn immediately
            if (avatar.tileX === boothTile.x && avatar.tileY === boothTile.y) {
              // Open booth door for despawn
              const despawnBoothKey = `${boothTile.x},${boothTile.y}`;
              walkableBoothsRef.current.add(despawnBoothKey);
              setBoothFrame(boothTile.x, boothTile.y, 1);
              const { x: sx, y: sy } = tileToScreen(boothTile.x, boothTile.y, 0);
              const ox = renderState.current.cameraOrigin;
              teleportEffectsRef.current.push(
                createTeleportEffect(sx + ox.x, sy + TILE_H_HALF + ox.y, 'despawn')
              );
              // Schedule removal after effect duration, then close booth and re-block
              const capturedBooth = { ...boothTile };
              const capturedKey = despawnBoothKey;
              setTimeout(() => {
                avatarManager.removeAvatar(msg.agentId);
                sectionManager?.removeAgent(msg.agentId);
                despawningAgentsRef.current.delete(msg.agentId);
                setBoothFrame(capturedBooth.x, capturedBooth.y, 0);
                walkableBoothsRef.current.delete(capturedKey);
              }, 500);
            } else {
              // Pathfind to booth — recompute blocked with booth tile now walkable
              const despawnBlocked = computeBlockedTiles(
                renderState.current.furniture,
                renderState.current.multiTileFurniture,
                walkableBoothsRef.current,
              );
              avatarManager.moveAvatarTo(msg.agentId, boothTile.x, boothTile.y, grid, undefined, despawnBlocked);
            }
          } else {
            // No team or no booth: immediate despawn
            avatarManager.despawnAvatar(msg.agentId);
            idleWander.stopWandering(msg.agentId);
            sectionManager?.removeAgent(msg.agentId);
          }
          selectionManagerRef.current.deselectAvatar();
          break;
        }
        case 'agentStatus': {
          // Skip status updates for despawning agents
          if (despawningAgentsRef.current.has(msg.agentId)) break;

          agentStore.setStatus(msg.agentId, msg.status as 'active' | 'idle');

          if (msg.status === 'active' && grid) {
            idleWander.stopWandering(msg.agentId);
            // Stand up if sitting before moving to desk
            const activeAvatar = avatarManager.getAvatar(msg.agentId);
            if (activeAvatar?.state === 'sit') {
              avatarManager.standAvatar(msg.agentId);
            }
            // Record section activity for furniture glow overlays
            const agentTeam = sectionManager?.getAgentTeam(msg.agentId) || 'core-dev';
            sectionManager?.updateActivity(agentTeam, Date.now());
            const occupiedDesks = new Set<string>();
            for (const a of avatarManager.getAvatars()) {
              if (a.id !== msg.agentId && a.state !== 'idle' && a.state !== 'spawning' && a.state !== 'despawning') {
                occupiedDesks.add(`${a.tileX},${a.tileY}`);
              }
            }
            const deskTile = sectionManager?.getDeskTile(agentTeam, occupiedDesks);
            if (deskTile) {
              avatarManager.moveAvatarTo(msg.agentId, deskTile.x, deskTile.y, grid, deskTile.dir as 0 | 2 | 4 | 6, blocked);
            }
          } else if (msg.status === 'idle') {
            idleWander.startWandering(msg.agentId);
          }
          break;
        }
        case 'agentTool': {
          agentStore.setTool(msg.agentId, msg.displayText);
          // Track activity for auto-follow
          if (sectionManager) {
            const agentTeam = sectionManager.getAgentTeam(msg.agentId);
            if (agentTeam) {
              sectionManager.updateActivity(agentTeam, Date.now());
            }
          }
          break;
        }
        case 'agentLinkedTicket': {
          const linkMsg = msg as any;
          agentStore.setLinkedTicket(linkMsg.agentId, linkMsg.ticketId, linkMsg.ticketTitle);
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
          autoFollowRef.current = (msg as any).enabled ?? !autoFollowRef.current;
          if (!autoFollowRef.current) {
            autoFollowTargetRef.current = null;
          }
          break;
        }
        case 'kanbanCards': {
          kanbanStore.setCards(msg.cards);
          break;
        }
        case 'devMode': {
          setDevMode(msg.enabled);
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
          handlePlaySound((msg as any).sound || 'notification');
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
      avatarManagerRef.current.tick(nowMs);

      // Tick idle wander
      if (renderState.current.grid) {
        const blocked = computeBlockedTiles(
          renderState.current.furniture,
          renderState.current.multiTileFurniture,
          walkableBoothsRef.current,
        );
        idleWanderRef.current.tick(
          nowMs,
          avatarManagerRef.current,
          renderState.current.grid,
          blocked,
          renderState.current.furniture,
          renderState.current.multiTileFurniture,
          sectionManagerRef.current,
        );
      }

      // Check despawning agents: if they've reached the booth tile, trigger despawn effect
      if (despawningAgentsRef.current.size > 0 && sectionManagerRef.current) {
        for (const agentId of despawningAgentsRef.current) {
          const avatar = avatarManagerRef.current.getAvatar(agentId);
          if (!avatar) {
            despawningAgentsRef.current.delete(agentId);
            continue;
          }
          // Check if avatar has arrived at booth (idle and not moving)
          if (avatar.state === 'idle' && !avatarManagerRef.current.isMoving(agentId)) {
            const team = sectionManagerRef.current.getAgentTeam(agentId);
            const boothTile = team ? sectionManagerRef.current.getSpawnTile(team) : null;
            if (boothTile && avatar.tileX === boothTile.x && avatar.tileY === boothTile.y) {
              // Open booth door for despawn
              setBoothFrame(boothTile.x, boothTile.y, 1);
              // Create despawn teleport effect
              const { x: sx, y: sy } = tileToScreen(boothTile.x, boothTile.y, 0);
              const ox = renderState.current.cameraOrigin;
              teleportEffectsRef.current.push(
                createTeleportEffect(sx + ox.x, sy + TILE_H_HALF + ox.y, 'despawn')
              );
              // Schedule removal after effect, then close booth and re-block tile
              const capturedAgentId = agentId;
              const capturedBooth = { ...boothTile };
              const capturedBoothKey = `${boothTile.x},${boothTile.y}`;
              setTimeout(() => {
                avatarManagerRef.current.removeAvatar(capturedAgentId);
                sectionManagerRef.current?.removeAgent(capturedAgentId);
                despawningAgentsRef.current.delete(capturedAgentId);
                setBoothFrame(capturedBooth.x, capturedBooth.y, 0);
                walkableBoothsRef.current.delete(capturedBoothKey);
              }, 500);
              // Remove from despawning set immediately to prevent re-triggering
              despawningAgentsRef.current.delete(agentId);
            }
          }
        }
      }

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
      const avatars = avatarManagerRef.current.getAvatars();
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
      if (pendingStepOutRef.current.size > 0) {
        for (const [agentId, boothPos] of pendingStepOutRef.current) {
          const av = avatarManagerRef.current.getAvatar(agentId);
          if (!av) {
            pendingStepOutRef.current.delete(agentId);
            continue;
          }
          if (av.state === 'idle') {
            pendingStepOutRef.current.delete(agentId);
            const stepBlocked = computeBlockedTiles(
              renderState.current.furniture,
              renderState.current.multiTileFurniture,
              walkableBoothsRef.current,
            );
            // Prefer stepping out in booth facing direction (dir 2 = +x, bottom-right)
            const offsets = [
              { dx: 1, dy: 0 }, { dx: 0, dy: 1 },
              { dx: -1, dy: 0 }, { dx: 0, dy: -1 },
            ];
            for (const off of offsets) {
              const nx = boothPos.x + off.dx;
              const ny = boothPos.y + off.dy;
              if (nx >= 0 && ny >= 0 && nx < grid.width && ny < grid.height
                  && grid.tiles[ny][nx] !== null && !stepBlocked.has(`${nx},${ny}`)) {
                avatarManagerRef.current.moveAvatarTo(agentId, nx, ny, grid, undefined, stepBlocked);
                break;
              }
            }
            // Close booth door and re-block after agent steps out
            const capturedPos = { ...boothPos };
            const capturedKey = `${boothPos.x},${boothPos.y}`;
            setTimeout(() => {
              setBoothFrame(capturedPos.x, capturedPos.y, 0);
              walkableBoothsRef.current.delete(capturedKey);
            }, 800);
          }
        }
      }

      // Auto-follow camera: every 3 seconds check most active section
      if (autoFollowRef.current && sectionManagerRef.current) {
        if (nowMs - lastAutoFollowCheckRef.current > 3000) {
          lastAutoFollowCheckRef.current = nowMs;
          const activeTeam = sectionManagerRef.current.getMostActiveSection();
          if (activeTeam) {
            const center = sectionManagerRef.current.getSectionCenter(activeTeam);
            if (center) {
              const { x: sx, y: sy } = tileToScreen(center.x, center.y, 0);
              const ox = renderState.current.cameraOrigin;
              // Compute target pan values
              const targetPanX = canvas.offsetWidth / 2 - (sx + ox.x);
              const targetPanY = canvas.offsetHeight / 2 - (sy + ox.y);
              autoFollowTargetRef.current = { panX: targetPanX, panY: targetPanY };
            }
          }
        }
        // Lerp camera toward target (10% per frame for smooth pan)
        if (autoFollowTargetRef.current) {
          const cam = stage.camera;
          const target = autoFollowTargetRef.current;
          cam.panX += (target.panX - cam.panX) * 0.1;
          cam.panY += (target.panY - cam.panY) * 0.1;
          // Stop lerping when close enough
          if (Math.abs(target.panX - cam.panX) < 0.5 && Math.abs(target.panY - cam.panY) < 0.5) {
            cam.panX = target.panX;
            cam.panY = target.panY;
            autoFollowTargetRef.current = null;
          }
        }
      }

      const spriteCache = (window as any).spriteCache as SpriteCache | undefined;
      const avatars = avatarManagerRef.current.getAvatars();
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
        selectionManager: selectionManagerRef.current,
        teleportEffects: teleportEffectsRef.current,
        orchState: agentStore.snapshot(),
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
    if (!audioInitialized && !audioManagerRef.current) {
      await initAudio();
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

    // View mode: avatar selection only (movement handled by right-click)
    const avatarManager = avatarManagerRef.current;

    // Check if clicked tile has an avatar standing on it
    const clickedAvatar = avatarManager.getAvatarAtTile(tileX, tileY);

    if (clickedAvatar) {
      // Select this avatar for right-click movement targeting
      selectionManagerRef.current.selectAvatar(clickedAvatar.id);
      for (const avatar of avatarManager.getAvatars()) {
        avatar.isSelected = (avatar.id === clickedAvatar.id);
      }

      // If avatar is sitting, stand it up
      if (clickedAvatar.state === 'sit') {
        avatarManager.standAvatar(clickedAvatar.id);
        idleWanderRef.current.startWandering(clickedAvatar.id);
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
    selectionManagerRef.current.deselectAvatar();
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
    if (!audioInitialized && !audioManagerRef.current) {
      await initAudio();
    }

    // Simulated server round-trip lag
    await new Promise(r => setTimeout(r, 75 + Math.random() * 100));

    const avatarManager = avatarManagerRef.current;

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
        const selectionMgr = selectionManagerRef.current;
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
              idleWanderRef.current.stopWandering(target.id);
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
      const selectionMgr = selectionManagerRef.current;
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
          idleWanderRef.current.stopWandering(target.id);
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

  // Available sound names (keys match ASSET_URIS fields without 'Sound' suffix)
  const availableSounds = ['notification'];

  const initAudio = async () => {
    if (audioManagerRef.current) return;
    audioManagerRef.current = new AudioManager();
    await audioManagerRef.current.init();
    setAudioInitialized(true);

    // Load all known sounds
    const uris = (window as any).ASSET_URIS;
    if (uris?.notificationSound) {
      const buf = await audioManagerRef.current.loadSound(uris.notificationSound);
      if (buf) soundBuffersRef.current.set('notification', buf);
    }
  };

  const handlePlaySound = async (soundName: string) => {
    if (!audioManagerRef.current) {
      await initAudio();
    }
    // Retry once after init — buffer may have just been loaded
    let buf = soundBuffersRef.current.get(soundName);
    if (!buf && audioManagerRef.current) {
      // Try loading the specific sound if not yet loaded
      const uris = (window as any).ASSET_URIS;
      const uriKey = soundName + 'Sound';
      if (uris?.[uriKey]) {
        const loaded = await audioManagerRef.current.loadSound(uris[uriKey]);
        if (loaded) {
          soundBuffersRef.current.set(soundName, loaded);
          buf = loaded;
        }
      }
    }
    if (buf && audioManagerRef.current) {
      audioManagerRef.current.play(buf);
    } else {
      console.warn(`Sound "${soundName}" not loaded`);
    }
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
      {/* Layout editor panel hidden — controls moved to orchestration sidebar.
          Kept in codebase for reference; will be removed in a future cleanup phase. */}
      {false && <LayoutEditorPanel
        editorMode={editorMode}
        onModeChange={setEditorMode}
        selectedColor={selectedColor}
        onColorChange={setSelectedColor}
        selectedFurniture={selectedFurniture}
        onFurnitureChange={setSelectedFurniture}
        furnitureDirection={furnitureDirection}
        devMode={devMode}
        onDevCapture={handleDevCapture}
        onDebugGrid={undefined}
        onPlaySound={handlePlaySound}
        availableSounds={availableSounds}
        onRotate={() => {
          const spriteCache: SpriteCache | undefined = (window as any).spriteCache;
          const supported = spriteCache
            ? getSupportedDirections(selectedFurniture, spriteCache)
            : undefined;
          setFurnitureDirection(rotateFurniture(furnitureDirection, supported));
        }}
        onSave={handleSave}
        onLoad={handleLoad}
      />}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
        /* camera drag/pan, wheel zoom and touch gestures handled natively by CanvasStage */
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />
      {/* Kanban source filter HUD */}
      <div
        style={{
          position: 'fixed',
          left: 12,
          bottom: 12,
          zIndex: 10,
          padding: '6px 10px',
          borderRadius: 8,
          background: 'rgba(15, 23, 42, 0.78)',
          color: '#e2e8f0',
          font: '12px/1.4 monospace',
          border: '1px solid rgba(148, 163, 184, 0.35)',
          pointerEvents: 'none',
        }}
      >
        Kanban: {KANBAN_FILTER_LABELS[kanbanFilter]} &middot; press G
      </div>
    </>
  );
}
