// src/agentTypes.ts
// Shared types for agent monitoring and extension↔webview messaging

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

/** A card from a GitHub Projects v2 kanban board or Azure DevOps */
export interface KanbanCard {
  id: string;
  title: string;
  status: string; // raw status column name from GitHub Projects
  /** Work item type (e.g. "User Story", "Bug", "Task") */
  workItemType?: string;
  /** Assigned user display name */
  assignee?: string;
  /** Child work items (sub-tasks) */
  children?: KanbanCardChild[];
  /** Linked pull requests */
  linkedPrs?: KanbanCardPr[];
}

/** A child work item (sub-task) */
export interface KanbanCardChild {
  id: string;
  title: string;
  state: string;
  /** True if the child is in a completed state */
  completed: boolean;
}

/** A linked pull request */
export interface KanbanCardPr {
  id: string;
  title: string;
  status: string; // 'active', 'completed', 'abandoned'
  url?: string;
}

/** Messages from extension host → webview */
export type ExtensionMessage =
  | { type: 'agentCreated'; agentId: string; terminalName: string; variant: 0 | 1 | 2 | 3 | 4 | 5; role?: string; team?: TeamSection; taskArea?: string }
  | { type: 'agentRemoved'; agentId: string }
  | { type: 'agentStatus'; agentId: string; status: AgentStatus }
  | { type: 'agentTool'; agentId: string; toolName: string; displayText: string }
  | { type: 'agentLinkedTicket'; agentId: string; ticketId?: string; ticketTitle?: string }
  | { type: 'agentFeedMode'; agentId: string; feedMode: 'sse' | 'fast-poll' | 'poll'; feedReason: string }
  | { type: 'kanbanCards'; cards: KanbanCard[] }
  | { type: 'devMode'; enabled: boolean }
  | { type: 'requestClassification'; agentId: string }
  // Sidebar control panel → room webview (relayed via extension host)
  | { type: 'jumpToSection'; team: string }
  | { type: 'toggleOverlay' }
  | { type: 'autoFollow'; enabled?: boolean }
  | { type: 'editorMode'; mode: string }
  | { type: 'editorColor'; h: number; s: number; b: number }
  | { type: 'editorFurniture'; furniture: string }
  | { type: 'editorRotate' }
  | { type: 'editorSave' }
  | { type: 'editorLoad' }
  | { type: 'devCapture' }
  | { type: 'playSound'; sound: string }
  | { type: 'debugGrid' };

/** Messages from webview → extension host */
export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'requestAgents' }
  | { type: 'devCapture'; screenshot: string; logs: string[] }
  | { type: 'reassignAgent'; agentId: string; team: TeamSection }
  | { type: 'exportDebugGrid'; screenshot: string };
