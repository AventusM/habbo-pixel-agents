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
import { getSupportedDirections, isChairType } from './furnitureRegistry.js';
import { LayoutEditorPanel } from './LayoutEditorPanel.js';
import { AudioManager } from './isoAudioManager.js';
import { AvatarManager } from './avatarManager.js';
import { IdleWanderManager } from './idleWander.js';
import { AvatarSelectionManager } from './avatarSelection.js';
import type { ExtensionMessage } from './agentTypes.js';
import type { KanbanCard } from './agentTypes.js';
import { computeBlockedTiles } from './isoPathfinding.js';
import { drawKanbanNotes, drawExpandedNote, drawExpandedAggregateNote, getNoteHitAreas, pointInQuad } from './isoKanbanRenderer.js';
import type { OutfitConfig } from './avatarOutfitConfig.js';
import { getDefaultPreset } from './avatarOutfitConfig.js';
import { AvatarBuilderPanel } from './AvatarBuilderModal.js';
import { AvatarDebugGrid } from './AvatarDebugGrid.js';
import type { CameraState } from './cameraController.js';
import { createCameraState, applyPan, applyZoom, applyCameraTransform, screenToWorld } from './cameraController.js';
import { screenToTile } from './isometricMath.js';
import { SectionManager } from './sectionManager.js';
import type { FloorTemplate } from './roomLayoutEngine.js';
import { createTeleportEffect, drawTeleportFlash } from './teleportEffect.js';
import type { TeleportEffect } from './teleportEffect.js';
import type { TeamSection } from './agentTypes.js';
import { drawFurnitureActiveOverlay } from './isoFurnitureRenderer.js';
import { jumpToSection } from './cameraController.js';

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

  // Agent popup card (shows role/team info on click)
  const popupAgentRef = useRef<string | null>(null);
  const popupTimeRef = useRef<number>(0);

  // Auto-follow camera toggle and state
  const autoFollowRef = useRef(false);
  const lastAutoFollowCheckRef = useRef<number>(0);
  const autoFollowTargetRef = useRef<{ panX: number; panY: number } | null>(null);

  // Track agent speech bubble text
  const agentToolTextRef = useRef<Map<string, string>>(new Map());

  // Dev mode flag (set by extension in Development mode)
  const [devMode, setDevMode] = useState(false);

  // Kanban cards from GitHub Projects (Phase 12-03)
  // Starts empty; populated when extension sends kanbanCards message
  const kanbanCardsRef = useRef<KanbanCard[]>([]);

  // Expanded sticky note (click-to-open)
  const expandedNoteRef = useRef<string | null>(null);

  // Expanded aggregate note (backlog / done)
  const expandedAggregateRef = useRef<'backlog' | 'done' | null>(null);

  // Avatar builder modal state (Phase 14-03)
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [builderAvatarId, setBuilderAvatarId] = useState<string | null>(null);
  const [showDebugGrid, setShowDebugGrid] = useState(false);
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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;

    // Apply inverse camera transform to get world-space coordinates
    const cam = renderState.current.cameraState;
    const world = screenToWorld(mouseX, mouseY, cam, canvas.width, canvas.height);

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

      // Initialize section manager lazily from global template
      if (!sectionManagerRef.current) {
        const tmpl = (window as any).floorTemplate as FloorTemplate | undefined;
        if (tmpl) {
          sectionManagerRef.current = new SectionManager(tmpl);
        }
      }
      const sectionManager = sectionManagerRef.current;

      switch (msg.type) {
        case 'agentCreated': {
          if (grid) {
            const team: TeamSection = (msg as any).team || 'core-dev';

            // Try to spawn at section teleport booth
            const spawnTile = sectionManager?.getSpawnTile(team);
            let avatar;
            if (spawnTile) {
              avatar = avatarManager.spawnAvatarAt(msg.agentId, msg.variant, spawnTile.x, spawnTile.y, 0, grid, msg.terminalName);
              // Create teleport flash effect at spawn position
              if (avatar) {
                const { x: sx, y: sy } = tileToScreen(spawnTile.x, spawnTile.y, 0);
                const ox = renderState.current.cameraOrigin;
                teleportEffectsRef.current.push(
                  createTeleportEffect(sx + ox.x, sy + TILE_H_HALF + ox.y, 'spawn')
                );
              }
            } else {
              // Fallback: random tile
              avatar = avatarManager.spawnAvatar(msg.agentId, msg.variant, grid, msg.terminalName, blocked);
            }

            // Assign agent to section
            if (sectionManager) {
              sectionManager.assignAgent(msg.agentId, team);
            }

            // Set role-specific idle behavior before starting wander
            idleWander.setAgentRole(msg.agentId, team);

            // New agents start wandering until they become active
            idleWander.startWandering(msg.agentId);
          }
          break;
        }
        case 'agentRemoved': {
          const agentTeam = sectionManager?.getAgentTeam(msg.agentId);
          const boothTile = agentTeam ? sectionManager?.getSpawnTile(agentTeam) : null;
          const avatar = avatarManager.getAvatar(msg.agentId);

          if (boothTile && avatar && grid) {
            // Walk-to-booth despawn flow
            despawningAgentsRef.current.add(msg.agentId);
            idleWander.stopWandering(msg.agentId);

            // Stand up if sitting
            if (avatar.state === 'sit') {
              avatarManager.standAvatar(msg.agentId);
            }

            // If already at booth tile, trigger despawn immediately
            if (avatar.tileX === boothTile.x && avatar.tileY === boothTile.y) {
              const { x: sx, y: sy } = tileToScreen(boothTile.x, boothTile.y, 0);
              const ox = renderState.current.cameraOrigin;
              teleportEffectsRef.current.push(
                createTeleportEffect(sx + ox.x, sy + TILE_H_HALF + ox.y, 'despawn')
              );
              // Schedule removal after effect duration
              setTimeout(() => {
                avatarManager.removeAvatar(msg.agentId);
                sectionManager?.removeAgent(msg.agentId);
                despawningAgentsRef.current.delete(msg.agentId);
              }, 500);
            } else {
              // Pathfind to booth
              avatarManager.moveAvatarTo(msg.agentId, boothTile.x, boothTile.y, grid, undefined, blocked);
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

          if (msg.status === 'active' && grid) {
            idleWander.stopWandering(msg.agentId);
            // Stand up if sitting before moving to desk
            const activeAvatar = avatarManager.getAvatar(msg.agentId);
            if (activeAvatar?.state === 'sit') {
              avatarManager.standAvatar(msg.agentId);
            }
            // Look up desk tile from section manager
            const agentTeam = sectionManager?.getAgentTeam(msg.agentId) || 'core-dev';
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
          // Track activity for auto-follow
          if (sectionManager) {
            const agentTeam = sectionManager.getAgentTeam(msg.agentId);
            if (agentTeam) {
              sectionManager.updateActivity(agentTeam, Date.now());
            }
          }
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
                canvas.width,
                canvas.height,
              );
            }
          }
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
        case 'avatarOutfits': {
          const outfitsMsg = msg as any;
          avatarManagerRef.current.loadAvatarOutfits(outfitsMsg.outfits);
          break;
        }
        case 'devMode': {
          setDevMode(msg.enabled);
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

    // Populate section furniture from template
    const tmpl = (window as any).floorTemplate as FloorTemplate | undefined;
    if (tmpl) {
      sectionManagerRef.current = new SectionManager(tmpl);
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
              // Create despawn teleport effect
              const { x: sx, y: sy } = tileToScreen(boothTile.x, boothTile.y, 0);
              const ox = renderState.current.cameraOrigin;
              teleportEffectsRef.current.push(
                createTeleportEffect(sx + ox.x, sy + TILE_H_HALF + ox.y, 'despawn')
              );
              // Schedule removal after effect
              const capturedAgentId = agentId;
              setTimeout(() => {
                avatarManagerRef.current.removeAvatar(capturedAgentId);
                sectionManagerRef.current?.removeAgent(capturedAgentId);
                despawningAgentsRef.current.delete(capturedAgentId);
              }, 500);
              // Remove from despawning set immediately to prevent re-triggering
              despawningAgentsRef.current.delete(agentId);
            }
          }
        }
      }

      // Update animation state for all avatars
      const avatars = avatarManagerRef.current.getAvatars();
      for (const avatar of avatars) {
        updateAvatarAnimation(avatar, currentTimeMs);
      }
      renderState.current.lastFrameTimeMs = currentTimeMs;

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
              const targetPanX = canvas.width / 2 - (sx + ox.x);
              const targetPanY = canvas.height / 2 - (sy + ox.y);
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
      applyCameraTransform(ctx, cam, canvas.width, canvas.height);

      ctx.drawImage(offscreen, 0, 0);

      // Kanban sticky notes on walls (drawn right after walls/floor, before furniture/avatars)
      if (kanbanCardsRef.current.length > 0 && renderState.current.grid) {
        drawKanbanNotes(
          ctx,
          kanbanCardsRef.current,
          renderState.current.grid,
          renderState.current.cameraOrigin,
          expandedNoteRef.current,
          expandedAggregateRef.current,
        );
      }

      // Draw hover highlight if tile is hovered (editor mode)
      if (renderState.current.editorState.hoveredTile) {
        const { x, y, z } = renderState.current.editorState.hoveredTile;
        drawHoverHighlight(ctx, x, y, z, renderState.current.cameraOrigin);

        // Show direction arrow when in furniture mode
        if (renderState.current.editorState.mode === 'furniture') {
          const dir = renderState.current.editorState.furnitureDirection ?? 0;
          const { x: sx, y: sy } = tileToScreen(x, y, z);
          const arrowCx = sx + renderState.current.cameraOrigin.x;
          const arrowCy = sy + TILE_H_HALF + renderState.current.cameraOrigin.y;
          // Direction arrows: 0=NE, 2=SE, 4=SW, 6=NW
          const arrows: Record<number, string> = { 0: '\u2197', 2: '\u2198', 4: '\u2199', 6: '\u2196' };
          ctx.save();
          ctx.font = '14px sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 100, 0.9)';
          ctx.textAlign = 'center';
          ctx.fillText(arrows[dir] || '?', arrowCx, arrowCy - 4);
          ctx.restore();
        }
      }

      // Render furniture + avatars with unified depth sorting
      const dynamicRenderables = [...renderState.current.furnitureRenderables];

      if (spriteCache && avatars.length > 0) {
        for (const spec of avatars) {
          const renderable = createNitroAvatarRenderable(spec, spriteCache)
            || createAvatarRenderable(spec, spriteCache, 'avatar');

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

      // Draw furniture activity overlays (monitors glow, lamps warm)
      if (sectionManagerRef.current) {
        for (const f of renderState.current.furniture) {
          if (f.name === 'tv_flat' || f.name === 'hc_lmp') {
            // Check if any agents are active in this furniture's section
            let isActive = false;
            for (const section of sectionManagerRef.current.getAllSections()) {
              if (section.agentIds.length > 0 && section.lastActivityMs > 0) {
                // Check if this furniture belongs to this section
                const sectionLayout = sectionManagerRef.current.getTemplate().sections.find(s => s.team === section.team);
                if (sectionLayout) {
                  const inSection = sectionLayout.furniture.some(sf => sf.tileX === f.tileX && sf.tileY === f.tileY);
                  if (inSection && (currentTimeMs - section.lastActivityMs) < 10000) {
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
            anchorY: headY,
            isWaiting: !toolText,
          }, currentTimeMs);
          ctx.restore();
        }

        // Draw agent popup card (if any)
        if (popupAgentRef.current) {
          // Auto-dismiss after 5 seconds
          if (Date.now() - popupTimeRef.current > 5000) {
            popupAgentRef.current = null;
          } else {
            const popupAvatar = avatarManagerRef.current.getAvatar(popupAgentRef.current);
            if (popupAvatar) {
              ctx.save();
              ctx.translate(renderState.current.cameraOrigin.x, renderState.current.cameraOrigin.y);
              drawAgentPopup(ctx, popupAvatar, sectionManagerRef.current);
              ctx.restore();
            }
          }
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
        const aggCards = aggType === 'backlog'
          ? kanbanCardsRef.current.filter(c => c.status !== 'Done' && c.status !== 'In Progress')
          : kanbanCardsRef.current.filter(c => c.status === 'Done');
        if (aggCards.length > 0) {
          drawExpandedAggregateNote(ctx, aggType, aggCards, canvas.offsetWidth, canvas.offsetHeight);
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
        const scaleX = canvas.width / canvas.getBoundingClientRect().width;
        const scaleY = canvas.height / canvas.getBoundingClientRect().height;
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

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const pivotX = (event.clientX - rect.left) * scaleX;
    const pivotY = (event.clientY - rect.top) * scaleY;
    applyZoom(renderState.current.cameraState, event.deltaY, pivotX, pivotY, canvas.width, canvas.height);
  };

  const handleClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Skip click if user was dragging the camera
    if (dragRef.current.didDrag) {
      dragRef.current.didDrag = false;
      return;
    }

    if (!renderState.current.grid || !canvasRef.current) return;

    // --- Sticky note click detection (before tile logic) ---
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const noteClickX = (event.clientX - rect.left) * dpr;
    const noteClickY = (event.clientY - rect.top) * dpr;

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
      // If avatar is sitting, stand it up
      if (clickedAvatar.state === 'sit') {
        avatarManager.standAvatar(clickedAvatar.id);
        idleWanderRef.current.startWandering(clickedAvatar.id);
        return;
      }

      // Toggle popup card for this agent
      if (popupAgentRef.current === clickedAvatar.id) {
        // Clicking same agent closes popup and opens builder
        popupAgentRef.current = null;
        setIsBuilderOpen(true);
        setBuilderAvatarId(clickedAvatar.id);
      } else {
        // First click shows popup card
        popupAgentRef.current = clickedAvatar.id;
        popupTimeRef.current = Date.now();
        // Notify extension for sidebar scroll-to
        const vscodeApi = (window as any).vscodeApi;
        if (vscodeApi) {
          vscodeApi.postMessage({ type: 'agentClicked', agentId: clickedAvatar.id });
        }
      }
      return;
    }

    // Click on empty space — deselect + close popup
    popupAgentRef.current = null;
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
    const buf = soundBuffersRef.current.get(soundName);
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

  // Avatar builder save handler — updates avatar and persists to extension host
  const handleBuilderSave = (outfit: OutfitConfig) => {
    if (!builderAvatarId) return;
    // Update avatar spec in place (rAF loop picks up changes)
    avatarManagerRef.current.setAvatarOutfit(builderAvatarId, outfit);
    // Persist via extension host
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ type: 'saveAvatar', agentId: builderAvatarId, outfit });
    }
    setIsBuilderOpen(false);
    setBuilderAvatarId(null);
  };

  // Avatar builder close handler (cancel)
  const handleBuilderClose = () => {
    setIsBuilderOpen(false);
    setBuilderAvatarId(null);
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
        devMode={devMode}
        onDevCapture={handleDevCapture}
        onDebugGrid={() => setShowDebugGrid(true)}
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
      />
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseLeave={handleMouseLeave}
      />
      {showDebugGrid && (
        <AvatarDebugGrid onClose={() => setShowDebugGrid(false)} />
      )}
      {isBuilderOpen && builderAvatarId && (() => {
        const avatar = avatarManagerRef.current.getAvatar(builderAvatarId);
        if (!avatar) return null;
        return (
          <AvatarBuilderPanel
            avatarId={builderAvatarId}
            initialOutfit={avatar.outfit || getDefaultPreset(avatar.variant)}
            variant={avatar.variant}
            onSave={handleBuilderSave}
            onClose={handleBuilderClose}
          />
        );
      })()}
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
 * Draw an agent popup card near the avatar showing role, team, and status info.
 * Appears above the name tag as a dark rounded rectangle with team-colored header.
 */
function drawAgentPopup(
  ctx: CanvasRenderingContext2D,
  avatar: AvatarSpec,
  sectionManager: SectionManager | null,
): void {
  const { x: screenX, y: screenY } = tileToScreen(avatar.tileX, avatar.tileY, avatar.tileZ);
  const offsetX = avatar.screenOffsetX || 0;
  const offsetY = avatar.screenOffsetY || 0;
  const headY = screenY + AVATAR_GROUND_Y - AVATAR_HEIGHT + offsetY;

  const cardW = 120;
  const cardH = 48;
  const cardX = screenX + offsetX - cardW / 2;
  const cardY = headY - cardH - 20; // Above name tag

  const team = sectionManager?.getAgentTeam(avatar.id) || 'core-dev';
  const teamColor = TEAM_COLORS[team] || '#666';
  const status = avatar.state === 'idle' || avatar.state === 'sit' ? 'Idle' : 'Active';
  const displayName = avatar.displayName || avatar.id;

  // Card background
  ctx.save();
  ctx.fillStyle = 'rgba(16, 20, 36, 0.92)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 4);
  ctx.fill();

  // Team-colored header bar
  ctx.fillStyle = teamColor;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, 12, [4, 4, 0, 0]);
  ctx.fill();

  // Team name in header
  ctx.font = '6px "Press Start 2P"';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(team.replace('-', ' ').toUpperCase(), cardX + cardW / 2, cardY + 9);

  // Agent name
  ctx.font = '6px "Press Start 2P"';
  ctx.fillStyle = '#e0e0e0';
  ctx.textAlign = 'left';
  const nameText = displayName.length > 16 ? displayName.slice(0, 14) + '..' : displayName;
  ctx.fillText(nameText, cardX + 4, cardY + 24);

  // Status indicator
  ctx.fillStyle = status === 'Active' ? '#5BD55B' : '#888';
  ctx.beginPath();
  ctx.arc(cardX + 4 + 3, cardY + 34, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#aaa';
  ctx.font = '5px "Press Start 2P"';
  ctx.fillText(status, cardX + 12, cardY + 36);

  // Dismiss hint
  ctx.fillStyle = '#555';
  ctx.textAlign = 'right';
  ctx.font = '5px "Press Start 2P"';
  ctx.fillText('x', cardX + cardW - 4, cardY + 10);

  ctx.restore();
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
