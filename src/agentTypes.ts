// src/agentTypes.ts
// Shared types for agent monitoring and extension↔webview messaging

import type { OutfitConfig } from './avatarOutfitConfig.js';

/** Parsed event from a Claude Code JSONL transcript */
export interface AgentEvent {
  type: 'tool_use' | 'tool_result' | 'turn_duration';
  toolName?: string;
  toolInput?: Record<string, unknown>;
  displayText?: string;
  durationMs?: number;
}

/** Agent lifecycle state */
export type AgentStatus = 'active' | 'idle';

/** Team section for agent grouping */
export type TeamSection = 'planning' | 'core-dev' | 'infrastructure' | 'support';

/** Tracked agent state */
export interface AgentState {
  agentId: string;
  terminalName: string;
  variant: 0 | 1 | 2 | 3 | 4 | 5;
  status: AgentStatus;
  lastActivityMs: number;
  jsonlPath: string;
  role?: string;
  team?: TeamSection;
  taskArea?: string;
  displayName?: string;
}

/** A card from a GitHub Projects v2 kanban board */
export interface KanbanCard {
  id: string;
  title: string;
  status: string; // raw status column name from GitHub Projects
}

/** Messages from extension host → webview */
export type ExtensionMessage =
  | { type: 'agentCreated'; agentId: string; terminalName: string; variant: 0 | 1 | 2 | 3 | 4 | 5 }
  | { type: 'agentRemoved'; agentId: string }
  | { type: 'agentStatus'; agentId: string; status: AgentStatus }
  | { type: 'agentTool'; agentId: string; toolName: string; displayText: string }
  | { type: 'kanbanCards'; cards: KanbanCard[] }
  | { type: 'devMode'; enabled: boolean }
  | { type: 'avatarOutfits'; outfits: Record<string, { outfit: OutfitConfig; wardrobePresets?: OutfitConfig[] }> }
  | { type: 'classifyAgent'; agentId: string; jsonlPath: string };

/** Messages from webview → extension host */
export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'requestAgents' }
  | { type: 'devCapture'; screenshot: string; logs: string[] }
  | { type: 'saveAvatar'; agentId: string; outfit: OutfitConfig }
  | { type: 'loadAvatars' }
  | { type: 'reassignAgent'; agentId: string; team: TeamSection };
