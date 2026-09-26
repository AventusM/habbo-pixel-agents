// scripts/hooks-feed-mapper.d.mts
// Type declarations for the pure hooks-feed mapper (scripts/hooks-feed-mapper.mjs).
// Keeps `npx tsc --noEmit` happy for the .mjs import in tests; the mapper itself
// stays dependency-free JS (no fs/ws/server imports).

export interface AgentCreatedEvent {
  type: 'agentCreated';
  agentId: string;
  terminalName: string;
  variant: number;
  role?: string;
  team?: string;
  taskArea?: string;
}

export interface AgentStatusEvent {
  type: 'agentStatus';
  agentId: string;
  status: 'active';
}

export interface AgentToolEvent {
  type: 'agentTool';
  agentId: string;
  toolName: string;
  displayText: string;
}

export type RoomEvent = AgentCreatedEvent | AgentStatusEvent | AgentToolEvent;

/**
 * Convert one hooks-feed JSONL line into ordered room events.
 * Caller must add the resolved agentId to `knownAgentIds` after each call.
 */
export function mapFeedLineToRoomEvents(
  line: string,
  knownAgentIds: Set<string>,
): RoomEvent[];
