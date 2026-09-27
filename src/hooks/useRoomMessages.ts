// src/hooks/useRoomMessages.ts
// Extension-message bus dispatcher (M008/S04 T04, extracted from RoomCanvas
// under the D021 convention). The single subscription that fans every
// ExtensionMessage type into the stores, managers, editor state setters and
// audio/dev commands. Per D021 the store reads/writes live here; the shell only
// owns the refs/state the canvas frame path reads directly and passes them in.
import { useEffect } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { onMessage } from '../bus.js';
import { agentStore } from '../state/agentStore.js';
import { kanbanStore } from '../state/kanbanStore.js';
import { cameraStore } from '../state/cameraStore.js';
import { uiStore } from '../state/uiStore.js';
import { tileToScreen } from '../isometricMath.js';
import { jumpToSection } from '../cameraController.js';
import { getSupportedDirections } from '../furnitureRegistry.js';
import { rotateFurniture, type EditorMode } from '../isoLayoutEditor.js';
import type { ExtensionMessage, TeamSection } from '../agentTypes.js';
import type { HsbColor } from '../isoTypes.js';
import type { SpriteCache } from '../isoSpriteCache.js';
import type { AvatarManager } from '../avatarManager.js';
import type { AvatarSelectionManager } from '../avatarSelection.js';
import type { SectionManager } from '../sectionManager.js';
import type { CanvasStage } from '../render/CanvasStage.js';
import type { RoomRenderState } from './useRoomInput.js';

export interface UseRoomMessagesOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stageRef: RefObject<CanvasStage | null>;
  renderState: RefObject<RoomRenderState>;
  avatarManager: AvatarManager;
  selectionManager: AvatarSelectionManager;
  sectionManagerRef: RefObject<SectionManager | null>;
  ensureSectionManager: () => SectionManager | null;
  handleAgentCreated: (msg: ExtensionMessage) => void;
  handleAgentRemoved: (msg: ExtensionMessage) => void;
  handleAgentStatus: (msg: ExtensionMessage) => void;
  handleAgentTool: (msg: ExtensionMessage) => void;
  handleAgentLinkedTicket: (msg: ExtensionMessage) => void;
  setAutoFollow: (enabled?: boolean) => void;
  playSound: (soundName: string) => Promise<void>;
  setEditorMode: Dispatch<SetStateAction<EditorMode>>;
  setSelectedColor: Dispatch<SetStateAction<HsbColor>>;
  setSelectedFurniture: Dispatch<SetStateAction<string>>;
  setFurnitureDirection: Dispatch<SetStateAction<number>>;
  renderRoomBuffer: () => void;
  handleSave: () => void;
  handleLoad: (file: File) => void;
  handleDevCapture: () => void;
}

export function useRoomMessages(options: UseRoomMessagesOptions) {
  const {
    canvasRef,
    stageRef,
    renderState,
    avatarManager,
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
    handleSave,
    handleLoad,
    handleDevCapture,
  } = options;

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
}
