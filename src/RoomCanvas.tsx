import React, { useRef, useEffect, useState } from 'react';
import { parseHeightmap, depthSort } from './isoTypes.js';
import { initCanvas, computeCameraOrigin, preRenderRoom, createFurnitureRenderables } from './isoTileRenderer.js';
import type { TileGrid, Renderable } from './isoTypes.js';
import type { FurnitureSpec, MultiTileFurnitureSpec } from './isoFurnitureRenderer.js';
import type { AvatarSpec, AvatarRenderer } from './avatarRendererTypes.js';
import { pixelLabRenderer } from './pixelLabAvatarRenderer.js';

const AVATAR_GROUND_Y = 0;
import type { SpriteCache } from './isoSpriteCache.js';
import { drawSpeechBubble } from './isoBubbleRenderer.js';
import { drawNameTag } from './isoNameTagRenderer.js';
import { tileToScreen, TILE_W_HALF, TILE_H_HALF } from './isometricMath.js';
import {
  drawHoverHighlight,
  drawFurnitureFootprint,
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
import { getSupportedDirections, isChairType, isTeleportBooth, getFurnitureDimensions } from './furnitureRegistry.js';
import { LayoutEditorPanel } from './LayoutEditorPanel.js';
import { AudioManager } from './isoAudioManager.js';
import { AvatarManager } from './avatarManager.js';
import { IdleWanderManager } from './idleWander.js';
import { AvatarSelectionManager } from './avatarSelection.js';
import type { ExtensionMessage } from './agentTypes.js';
import type { KanbanCard } from './agentTypes.js';
import { computeBlockedTiles } from './isoPathfinding.js';
import { drawKanbanNotes, drawExpandedNote, drawExpandedAggregateNote, getNoteHitAreas, pointInQuad } from './isoKanbanRenderer.js';
import type { CameraState } from './cameraController.js';
import { createCameraState, applyZoom, applyCameraTransform, screenToWorld } from './cameraController.js';
import { screenToTile } from './isometricMath.js';
import { SectionManager } from './sectionManager.js';
import { type FloorTemplate, buildSectionColorMap } from './roomLayoutEngine.js';
import { createTeleportEffect, drawTeleportFlash } from './teleportEffect.js';
import type { TeleportEffect } from './teleportEffect.js';
import type { TeamSection } from './agentTypes.js';
import { drawFurnitureActiveOverlay } from './isoFurnitureRenderer.js';
import { jumpToSection } from './cameraController.js';
import {
  createOrchestrationState, drawOrchestrationOverlay,
  orchestrationAddAgent, orchestrationRemoveAgent,
  orchestrationSetStatus, orchestrationSetTool,
  orchestrationSetLinkedTicket, getLinkedTicketIds,
} from './isoOrchestrationOverlay.js';

interface RoomCanvasProps {
  heightmap: string;
  editorMode?: EditorMode; // Optional, defaults to 'view'
}

// Avatar sprite height for name tag positioning (Nitro figure sprites)
const AVATAR_HEIGHT = 65;

export function RoomCanvas({ heightmap, editorMode: editorModeProp = 'view' }: RoomCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(false);
  const rafIdRef = useRef(0);

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

  // Track agent speech bubble text
  const agentToolTextRef = useRef<Map<string, string>>(new Map());

  // In-canvas orchestration overlay state
  const orchStateRef = useRef(createOrchestrationState());

  // Dev mode flag (set by extension in Development mode)
  const [devMode, setDevMode] = useState(false);

  // Kanban cards from GitHub Projects (Phase 12-03)
  // Starts empty; populated when extension sends kanbanCards message
  const kanbanCardsRef = useRef<KanbanCard[]>([]);

  // Expanded sticky note (click-to-open)
  const expandedNoteRef = useRef<string | null>(null);

  // Expanded aggregate note (todo / done)
  const expandedAggregateRef = useRef<'todo' | 'done' | null>(null);

  // Editor UI state
  const [editorMode, setEditorMode] = useState<EditorMode>(editorModeProp);
  const [selectedColor, setSelectedColor] = useState<HsbColor>({ h: 200, s: 50, b: 50 });
  const [selectedFurniture, setSelectedFurniture] = useState<string>('hc_chr');
  const [furnitureDirection, setFurnitureDirection] = useState<number>(0);
  // Camera drag state (not in renderState to avoid re-renders)
  const dragRef = useRef<{
    isDragging: boolean;
    didDrag: boolean;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  }>({ isDragging: false, didDrag: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });

  const renderState = useRef<{
    offscreenCanvas: OffscreenCanvas | null;
    cameraOrigin: { x: number; y: number };
    cameraState: CameraState;
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
    cameraState: createCameraState(),
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

  /**
   * Convert mouse event to tile coordinates, accounting for camera pan/zoom.
   * Replaces direct getHoveredTile calls when camera transform is active.
   */
  function mouseToTile(event: React.MouseEvent<HTMLCanvasElement>): { tileX: number; tileY: number } | null {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.offsetWidth / rect.width;
    const scaleY = canvas.offsetHeight / rect.height;
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;

    // Apply inverse camera transform to get world-space coordinates
    const cam = renderState.current.cameraState;
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

            // Track in orchestration overlay
            orchestrationAddAgent(orchStateRef.current, msg.agentId, msg.terminalName || msg.agentId, team);

            // Set role-specific idle behavior before starting wander
            idleWander.setAgentRole(msg.agentId, team);

            // New agents start wandering until they become active
            idleWander.startWandering(msg.agentId);
          }
          break;
        }
        case 'agentRemoved': {
          console.log(`[Room] agentRemoved: ${msg.agentId}`);
          orchestrationRemoveAgent(orchStateRef.current, msg.agentId);
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

          orchestrationSetStatus(orchStateRef.current, msg.agentId, msg.status as 'active' | 'idle');

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
            agentToolTextRef.current.delete(msg.agentId);
            idleWander.startWandering(msg.agentId);
          }
          break;
        }
        case 'agentTool': {
          agentToolTextRef.current.set(msg.agentId, msg.displayText);
          orchestrationSetTool(orchStateRef.current, msg.agentId, msg.displayText);
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
          orchestrationSetLinkedTicket(
            orchStateRef.current,
            linkMsg.agentId,
            linkMsg.ticketId,
            linkMsg.ticketTitle,
          );
          break;
        }
        case 'jumpToSection': {
          const jumpMsg = msg as any;
          const team = jumpMsg.team as TeamSection;
          if (sectionManager && canvasRef.current) {
            const center = sectionManager.getSectionCenter(team);
            if (center) {
              const { x: sx, y: sy } = tileToScreen(center.x, center.y, 0);
              const ox = renderState.current.cameraOrigin;
              const canvas = canvasRef.current;
              jumpToSection(
                renderState.current.cameraState,
                sx + ox.x,
                sy + ox.y,
                canvas.offsetWidth,
                canvas.offsetHeight,
              );
            }
          }
          break;
        }
        case 'toggleOverlay': {
          orchStateRef.current.visible = !orchStateRef.current.visible;
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
          kanbanCardsRef.current = msg.cards;
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
          walkableBoothsRef.current,
        );
        idleWanderRef.current.tick(
          currentTimeMs,
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

      // PixelLab is the sole avatar renderer
      const spriteCache = (window as any).spriteCache as SpriteCache | undefined;
      const activeRenderer: AvatarRenderer = pixelLabRenderer;

      // Update animation state for all avatars
      const avatars = avatarManagerRef.current.getAvatars();
      for (const avatar of avatars) {
        activeRenderer.updateAnimation(avatar, currentTimeMs);
      }
      renderState.current.lastFrameTimeMs = currentTimeMs;

      // Check pending step-outs: move agent out of booth once spawn animation ends
      if (pendingStepOutRef.current.size > 0 && renderState.current.grid) {
        for (const [agentId, boothPos] of pendingStepOutRef.current) {
          const av = avatarManagerRef.current.getAvatar(agentId);
          if (!av) {
            pendingStepOutRef.current.delete(agentId);
            continue;
          }
          if (av.state === 'idle') {
            pendingStepOutRef.current.delete(agentId);
            const g = renderState.current.grid;
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
              if (nx >= 0 && ny >= 0 && nx < g.width && ny < g.height
                  && g.tiles[ny][nx] !== null && !stepBlocked.has(`${nx},${ny}`)) {
                avatarManagerRef.current.moveAvatarTo(agentId, nx, ny, g, undefined, stepBlocked);
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
      if (autoFollowRef.current && sectionManagerRef.current && canvas) {
        if (currentTimeMs - lastAutoFollowCheckRef.current > 3000) {
          lastAutoFollowCheckRef.current = currentTimeMs;
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
          const cam = renderState.current.cameraState;
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

      const cam = renderState.current.cameraState;

      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // --- Begin camera-transformed world-space drawing ---
      ctx.save();
      applyCameraTransform(ctx, cam, canvas.offsetWidth, canvas.offsetHeight);

      ctx.drawImage(offscreen, 0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Kanban sticky notes on walls (drawn right after walls/floor, before furniture/avatars)
      if (kanbanCardsRef.current.length > 0 && renderState.current.grid) {
        drawKanbanNotes(
          ctx,
          kanbanCardsRef.current,
          renderState.current.grid,
          renderState.current.cameraOrigin,
          expandedNoteRef.current,
          expandedAggregateRef.current,
          getLinkedTicketIds(orchStateRef.current),
        );
      }

      // Draw hover highlight if tile is hovered (editor mode)
      if (renderState.current.editorState.hoveredTile) {
        const { x, y, z } = renderState.current.editorState.hoveredTile;

        if (renderState.current.editorState.mode === 'furniture' && renderState.current.grid) {
          // Show multi-tile footprint preview for furniture placement
          const furnitureType = renderState.current.editorState.selectedFurniture || 'hc_chr';
          const dir = renderState.current.editorState.furnitureDirection ?? 0;
          const sc: SpriteCache | undefined = (window as any).spriteCache;
          const { widthTiles, heightTiles } = sc
            ? getFurnitureDimensions(furnitureType, sc, dir)
            : { widthTiles: 1, heightTiles: 1 };

          drawFurnitureFootprint(
            ctx, x, y, z,
            widthTiles, heightTiles,
            renderState.current.grid,
            renderState.current.furniture,
            renderState.current.multiTileFurniture,
            renderState.current.cameraOrigin,
          );

          // Direction arrow at origin tile
          const { x: sx, y: sy } = tileToScreen(x, y, z);
          const arrowCx = sx + renderState.current.cameraOrigin.x;
          const arrowCy = sy + TILE_H_HALF + renderState.current.cameraOrigin.y;
          const arrows: Record<number, string> = { 0: '\u2197', 2: '\u2198', 4: '\u2199', 6: '\u2196' };
          ctx.save();
          ctx.font = '14px sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 100, 0.9)';
          ctx.textAlign = 'center';
          ctx.fillText(arrows[dir] || '?', arrowCx, arrowCy - 4);
          ctx.restore();
        } else {
          // Single tile highlight for paint/color modes
          drawHoverHighlight(ctx, x, y, z, renderState.current.cameraOrigin);
        }
      }

      // Render furniture + avatars with unified depth sorting
      const dynamicRenderables = [...renderState.current.furnitureRenderables];

      if (spriteCache && avatars.length > 0) {
        for (const spec of avatars) {
          const renderable = activeRenderer.createRenderable(spec, spriteCache);
          if (!renderable) continue;

          // Camera transform is already applied; just translate by cameraOrigin for avatar world positioning
          const originalDraw = renderable.draw;
          renderable.draw = (drawCtx) => {
            drawCtx.save();
            drawCtx.translate(renderState.current.cameraOrigin.x, renderState.current.cameraOrigin.y);
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
      // Uses canvas overlay effects since native Habbo frames require additive blending
      // which our sprite renderer doesn't support yet
      if (sectionManagerRef.current) {
        for (const f of renderState.current.furniture) {
          if (f.name === 'tv_flat' || f.name === 'hc_lmp') {
            // Active when the section has any agents present
            let isActive = false;
            for (const section of sectionManagerRef.current.getAllSections()) {
              if (section.agentIds.length > 0) {
                const sectionLayout = sectionManagerRef.current.getTemplate().sections.find(s => s.team === section.team);
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
            const ox = renderState.current.cameraOrigin;
            drawFurnitureActiveOverlay(ctx, f.name, sx + ox.x, sy + ox.y + TILE_H_HALF, isActive);
          }
        }
      }

      // Draw active teleport effects (after avatars, before UI overlays)
      teleportEffectsRef.current = teleportEffectsRef.current.filter(
        effect => drawTeleportFlash(ctx, effect, performance.now())
      );

      if (spriteCache && avatars.length > 0) {
        // Draw selection highlight
        const selectedId = selectionManagerRef.current.selectedAvatarId;
        if (selectedId) {
          const selectedAvatar = avatarManagerRef.current.getAvatar(selectedId);
          if (selectedAvatar) {
            drawSelectionHighlight(ctx, selectedAvatar, renderState.current.cameraOrigin, currentTimeMs);
          }
        }

        // UI Overlays: name tags + speech bubbles (world-positioned, inside camera transform)
        ctx.font = '8px "Press Start 2P"';
        for (const avatar of avatars) {
          const { x: screenX, y: screenY } = tileToScreen(avatar.tileX, avatar.tileY, avatar.tileZ);
          const offsetX = avatar.screenOffsetX || 0;
          const offsetY = avatar.screenOffsetY || 0;
          const headY = screenY + AVATAR_GROUND_Y - AVATAR_HEIGHT + offsetY;

          const status = avatar.state === 'idle' || avatar.state === 'sit' ? 'idle' : 'active';

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
            anchorY: headY - 30,
            isWaiting: !toolText,
          }, currentTimeMs);
          ctx.restore();
        }

      }

      // --- End camera-transformed world-space drawing ---
      ctx.restore();

      // Screen-space overlays (drawn OUTSIDE camera transform)

      // Expanded sticky note overlay (drawn last, on top of everything)
      if (expandedNoteRef.current && kanbanCardsRef.current.length > 0) {
        const expandedCard = kanbanCardsRef.current.find(c => c.id === expandedNoteRef.current);
        if (expandedCard && canvas) {
          drawExpandedNote(ctx, expandedCard, canvas.offsetWidth, canvas.offsetHeight);
        }
      }

      // Expanded aggregate note overlay
      if (expandedAggregateRef.current && kanbanCardsRef.current.length > 0 && canvas) {
        const aggType = expandedAggregateRef.current;
        const IP = ['In Progress', 'Doing'];
        const DONE = ['Done'];
        const aggCards = aggType === 'todo'
          ? kanbanCardsRef.current.filter(c => !DONE.includes(c.status) && !IP.includes(c.status))
          : kanbanCardsRef.current.filter(c => DONE.includes(c.status));
        if (aggCards.length > 0) {
          drawExpandedAggregateNote(ctx, aggType, aggCards, canvas.offsetWidth, canvas.offsetHeight);
        }
      }

      // Orchestration overlay (right-side HUD)
      if (canvas) {
        drawOrchestrationOverlay(ctx, orchStateRef.current, canvas.offsetWidth, canvas.offsetHeight);
      }

      rafIdRef.current = requestAnimationFrame(frame);
    }

    rafIdRef.current = requestAnimationFrame(frame);

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [heightmap]);

  // Mouse event handlers for editor mode + camera drag
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Middle-click always drags; left-click in view mode starts potential drag
    if (event.button === 1 || (event.button === 0 && renderState.current.editorState.mode === 'view')) {
      const drag = dragRef.current;
      drag.isDragging = true;
      drag.didDrag = false;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      drag.startPanX = renderState.current.cameraState.panX;
      drag.startPanY = renderState.current.cameraState.panY;
    }
  };

  const handleMouseUp = () => {
    dragRef.current.isDragging = false;
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle camera drag panning
    const drag = dragRef.current;
    if (drag.isDragging) {
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 5) {
        drag.didDrag = true;
        const canvas = event.currentTarget;
        const rect2 = canvas.getBoundingClientRect();
        const scaleX = canvas.offsetWidth / rect2.width;
        const scaleY = canvas.offsetHeight / rect2.height;
        // Pan in screen-scaled pixels, adjusted for zoom
        const cam = renderState.current.cameraState;
        cam.panX = drag.startPanX + (dx * scaleX) / cam.zoom;
        cam.panY = drag.startPanY + (dy * scaleY) / cam.zoom;
      }
    }

    if (!renderState.current.grid) return;

    const hoveredCoords = mouseToTile(event);

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

  // Wheel handler is attached as a native event listener (non-passive)
  // to allow preventDefault() — React's onWheel is passive by default.
  const wheelHandlerRef = useRef<((e: WheelEvent) => void) | null>(null);
  wheelHandlerRef.current = (event: WheelEvent) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.offsetWidth / rect.width;
    const scaleY = canvas.offsetHeight / rect.height;
    const pivotX = (event.clientX - rect.left) * scaleX;
    const pivotY = (event.clientY - rect.top) * scaleY;
    applyZoom(renderState.current.cameraState, event.deltaY, pivotX, pivotY, canvas.offsetWidth, canvas.offsetHeight);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => wheelHandlerRef.current?.(e);
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  const handleClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Skip click if user was dragging the camera
    if (dragRef.current.didDrag) {
      dragRef.current.didDrag = false;
      return;
    }

    if (!renderState.current.grid || !canvasRef.current) return;

    // --- Sticky note click detection (before tile logic) ---
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const cssScaleX = canvas.offsetWidth / rect.width;
    const cssScaleY = canvas.offsetHeight / rect.height;
    const screenX = (event.clientX - rect.left) * cssScaleX;
    const screenY = (event.clientY - rect.top) * cssScaleY;
    // Notes are drawn inside camera transform, so apply inverse to get world-space coords
    const noteWorld = screenToWorld(screenX, screenY, renderState.current.cameraState, canvas.offsetWidth, canvas.offsetHeight);
    const noteClickX = noteWorld.x;
    const noteClickY = noteWorld.y;

    // If any note overlay is expanded, any click closes it
    if (expandedNoteRef.current || expandedAggregateRef.current) {
      expandedNoteRef.current = null;
      expandedAggregateRef.current = null;
      return;
    }

    // Check if click hit a wall note
    const hitAreas = getNoteHitAreas();
    for (const area of hitAreas) {
      if (pointInQuad(noteClickX, noteClickY, area.corners)) {
        if (area.aggregateType) {
          expandedAggregateRef.current = area.aggregateType;
        } else {
          expandedNoteRef.current = area.cardId;
        }
        return;
      }
    }

    // Read event.currentTarget BEFORE any await (React clears it after)
    const clickedCoords = mouseToTile(event);
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

    const clickedCoords = mouseToTile(event);
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

  const handleMouseLeave = () => {
    renderState.current.editorState.hoveredTile = null;
    dragRef.current.isDragging = false;
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
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        /* wheel handled via native listener (non-passive) in useEffect */
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseLeave={handleMouseLeave}
      />
    </>
  );
}

/** Team section display colors */
const TEAM_COLORS: Record<string, string> = {
  'planning': '#3B5998',
  'core-dev': '#5BD55B',
  'infrastructure': '#D4A017',
  'support': '#9B5BD5',
};

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
