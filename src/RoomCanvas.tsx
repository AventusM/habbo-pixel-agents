import React, { useRef, useEffect, useState } from 'react';
import { parseHeightmap } from './isoTypes.js';
import { CanvasStage } from './render/CanvasStage.js';
import { drawScene, type SceneInputs } from './render/sceneRenderer.js';
import { computeFitZoom } from './render/roomBounds.js';
import type { TileGrid, Renderable, HsbColor } from './isoTypes.js';
import type { FurnitureSpec, MultiTileFurnitureSpec } from './isoFurnitureRenderer.js';
import type { AvatarRenderer } from './avatarRendererTypes.js';
import { pixelLabRenderer } from './pixelLabAvatarRenderer.js';
import type { SpriteCache } from './isoSpriteCache.js';
import { habboRenderer } from './isoAvatarRenderer.js';
import { KANBAN_FILTER_LABELS } from './kanbanFilter.js';
import {
  rotateFurniture,
  type EditorMode,
  type EditorState,
} from './isoLayoutEditor.js';
import { getSupportedDirections } from './furnitureRegistry.js';
import { drawKanbanNotes, createKanbanRenderState, type KanbanRenderState } from './isoKanbanRenderer.js';
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
import { useRoomInput } from './hooks/useRoomInput.js';
import { useRoomEditorIO } from './hooks/useRoomEditorIO.js';
import { useRoomInteraction } from './hooks/useRoomInteraction.js';
import { useRoomMessages } from './hooks/useRoomMessages.js';
import { useKanbanKeyboard } from './hooks/useKanbanKeyboard.js';
import { CharacterEditorPanel } from './components/CharacterEditorPanel.js';
import { AvatarPreview } from './components/AvatarPreview.js';
import { useCharacterEditor } from './hooks/useCharacterEditor.js';
import { useOutfitLiveSync } from './hooks/useOutfitLiveSync.js';

interface RoomCanvasProps {
  heightmap: string;
  editorMode?: EditorMode; // Optional, defaults to 'view'
}

const editorToggleStyle: React.CSSProperties = {
  position: 'fixed',
  right: 12,
  bottom: 12,
  zIndex: 1000,
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(15, 23, 42, 0.78)',
  color: '#e2e8f0',
  font: '12px/1.4 monospace',
  cursor: 'pointer',
};

export function RoomCanvas({ heightmap, editorMode: editorModeProp = 'view' }: RoomCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas lifecycle, camera, input, layers and frame scheduling (M003/S03)
  const stageRef = useRef<CanvasStage | null>(null);

  // Frame-path refs intentionally kept (M008/S03). These are imperative per-frame
  // resources and scratch/hit-test state — NOT mirrors of a src/state value. They
  // are refs so the render path stays allocation-free (no-frame-allocations) and
  // per-tick mutation never re-renders React:
  //   canvasRef / stageRef   — DOM canvas + stage handles (infra).
  //   renderState            — mutable camera/editor/room scratch read each frame.
  //   activeRendererRef      — avatar renderer instance; logged on change, not rendered.
  //   kanbanRenderStateRef   — per-render kanban hit-test state, mutated in draw.
  //   expandedNoteRef / noteOriginRef / expandedAggregateRef
  //                          — "which note is open" local UI state the canvas reads
  //                            directly; never needs a React render.
  // Store-backed values (dev mode, audio readiness, kanban filter) are read through
  // useStoreValue and are deliberately absent here.

  const { ensureInitialized, playSound, availableSounds, ready } = useRoomAudio();

  const { setEnabled: setAutoFollow, tick: autoFollowTick } = useAutoFollowCamera();

  // Dev mode flag (set by extension in Development mode) — uiStore is the single
  // source of truth; the bus writes it, the shell reads it back through the store.
  const devMode = useStoreValue(uiStore, selectDevMode);

  // Kanban source filter (All / GSD only / Non-GSD) — mirrored from kanbanStore for the HUD.
  const kanbanFilter = useKanbanFilter();

  // Character editor (M006/S02): draft state lives in outfitStore and is wired to
  // React through useCharacterEditor (D021). The editor is a React-only overlay —
  // it is never part of the per-frame render path.
  const editor = useCharacterEditor();
  const [editorOpen, setEditorOpen] = useState(false);

  // Per-render kanban hit-test state (replaces renderer module-level state)
  const kanbanRenderStateRef = useRef<KanbanRenderState>(createKanbanRenderState());

  // Active avatar renderer (logged on change; Habbo figures vs PixelLab/RD)
  const activeRendererRef = useRef<AvatarRenderer | null>(null);

  // Expanded sticky note (click-to-open)
  const expandedNoteRef = useRef<string | null>(null);

  // Where the expanded note was opened from ('todo'/'done' aggregate or a wall note)
  const noteOriginRef = useRef<'todo' | 'done' | null>(null);

  // Expanded aggregate note (todo / done)
  const expandedAggregateRef = useRef<'todo' | 'done' | null>(null);

  // Kanban keyboard navigation (M008/S04 T04)
  useKanbanKeyboard({ expandedNoteRef, noteOriginRef, expandedAggregateRef });

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

  // Pointer→tile mapping + hovered-tile state (M008/S04 T01)
  const { mouseToTile, updateHover, onHoverEnd } = useRoomInput({ canvasRef, stageRef, renderState });

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

  // Layout editor + dev IO (M008/S04 T02): room-buffer (re)render, booth frame
  // swaps, save/load and dev capture. Called before useRoomAgents so its
  // setBoothFrame is available to the spawn/despawn orchestration.
  const { renderRoomBuffer, reRenderRoom, setBoothFrame, handleSave, handleLoad, handleDevCapture } =
    useRoomEditorIO({ canvasRef, stageRef, renderState });

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

  // Live outfit sync (M006/S03): draft edits restyle walking agents in place.
  useOutfitLiveSync(avatarManager);

  // Extension-message bus dispatcher (M008/S04 T04)
  useRoomMessages({
    canvasRef,
    stageRef,
    renderState,
    avatarManager,
    selectionManager,
    sectionManagerRef,
    ensureSectionManager,
    handleAgentCreated,
    handleAgentRemoved,
    handleAgentStatus,
    handleAgentTool,
    handleAgentLinkedTicket,
    setAutoFollow,
    playSound,
    setEditorMode,
    setSelectedColor,
    setSelectedFurniture,
    setFurnitureDirection,
    renderRoomBuffer,
    handleSave,
    handleLoad,
    handleDevCapture,
  });

  // Stage lifecycle: canvas setup, room/notes layers, camera fit, frame loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stage = new CanvasStage(canvas, {
      canDrag: (e) =>
        e.button === 1 || (e.button === 0 && renderState.current.editorState.mode === 'view'),
      onHover: updateHover,
      onHoverEnd,
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

  // Click + context-menu interaction (M008/S04 T03)
  const { handleClick, handleContextMenu } = useRoomInteraction({
    canvasRef,
    stageRef,
    renderState,
    avatarManager,
    selectionManager,
    idleWander,
    ensureInitialized,
    mouseToTile,
    reRenderRoom,
    selectedColor,
    expandedNoteRef,
    noteOriginRef,
    expandedAggregateRef,
    kanbanRenderStateRef,
    walkableBoothsRef,
  });

  const previewSpriteCache =
    (window as unknown as { spriteCache?: SpriteCache }).spriteCache ?? null;

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
      <button
        type="button"
        style={editorToggleStyle}
        onClick={() => setEditorOpen((open) => !open)}
      >
        {editorOpen ? 'Close Character Editor' : 'Character Editor'}
      </button>
      {editorOpen && (
        <CharacterEditorPanel
          roles={editor.roles}
          activeRole={editor.activeRole}
          onSelectRole={editor.selectRole}
          hairOptions={editor.hairOptions}
          selectedHairPart={editor.outfit.parts.hair}
          onSelectHair={editor.setHair}
          hairColors={editor.hairColors}
          selectedHairColor={editor.outfit.colors.hair}
          onSelectHairColor={(hex) => editor.setColor('hair', hex)}
          shirtColors={editor.shirtColors}
          selectedShirtColor={editor.outfit.colors.shirt}
          onSelectShirtColor={(hex) => editor.setColor('shirt', hex)}
          onResetRole={editor.resetRole}
          onExportOutfits={editor.exportOutfits}
          onImportOutfitsFile={editor.importOutfitsFile}
        >
          <AvatarPreview outfit={editor.outfit} spriteCache={previewSpriteCache} />
        </CharacterEditorPanel>
      )}
    </>
  );
}
