// src/state/agentStore.ts
// Typed agent store (M003/S04): the canonical per-agent state (team, status,
// tool text, linked ticket) plus the orchestration overlay log and visibility.
// Replaces the orchestrationAddAgent/Set... mutations against orchStateRef and
// the parallel agentToolTextRef map with one update/subscribe store.

import type { TeamSection } from '../agentTypes.js';
import type {
  OrchestrationAgent,
  OrchestrationLogEntry,
  OrchestrationState,
} from '../isoOrchestrationOverlay.js';
import { createStore, type Store, type Unsubscribe } from './store.js';

export type AgentStatus = 'active' | 'idle';

export interface AgentRecord {
  agentId: string;
  displayName: string;
  team: TeamSection;
  status: AgentStatus;
  toolText: string;
  linkedTicketId?: string;
  linkedTicketTitle?: string;
}

export interface AgentStoreState {
  agents: ReadonlyMap<string, AgentRecord>;
  log: OrchestrationLogEntry[];
  visible: boolean;
}

const MAX_LOG = 50;

function pushLog(log: OrchestrationLogEntry[], text: string): OrchestrationLogEntry[] {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return [{ time, text }, ...log].slice(0, MAX_LOG);
}

function toOrchestrationAgent(record: AgentRecord): OrchestrationAgent {
  return {
    agentId: record.agentId,
    displayName: record.displayName,
    team: record.team,
    status: record.status,
    toolText: record.toolText,
    linkedTicketId: record.linkedTicketId,
    linkedTicketTitle: record.linkedTicketTitle,
  };
}

export class AgentStore {
  private readonly store: Store<AgentStoreState> = createStore<AgentStoreState>({
    agents: new Map(),
    log: [],
    visible: true,
  });

  get size(): number {
    return this.store.get().agents.size;
  }

  get visible(): boolean {
    return this.store.get().visible;
  }

  get(id: string): AgentRecord | undefined {
    return this.store.get().agents.get(id);
  }

  all(): AgentRecord[] {
    return [...this.store.get().agents.values()];
  }

  subscribe(listener: (state: AgentStoreState) => void): Unsubscribe {
    return this.store.subscribe(listener);
  }

  subscribeSelector<S>(
    selector: (state: AgentStoreState) => S,
    listener: (selected: S) => void,
  ): Unsubscribe {
    return this.store.subscribeSelector(selector, listener);
  }

  addAgent(agentId: string, displayName: string, team: TeamSection): void {
    this.store.update((prev) => {
      const agents = new Map(prev.agents);
      const existing = agents.get(agentId);
      if (existing) {
        agents.set(agentId, { ...existing, displayName, team });
        return { ...prev, agents };
      }
      agents.set(agentId, { agentId, displayName, team, status: 'idle', toolText: '' });
      return { ...prev, agents, log: pushLog(prev.log, `+ ${displayName}`) };
    });
  }

  removeAgent(agentId: string): void {
    this.store.update((prev) => {
      const existing = prev.agents.get(agentId);
      if (!existing) return prev;
      const agents = new Map(prev.agents);
      agents.delete(agentId);
      return { ...prev, agents, log: pushLog(prev.log, `- ${existing.displayName}`) };
    });
  }

  setStatus(agentId: string, status: AgentStatus): void {
    this.store.update((prev) => {
      const agent = prev.agents.get(agentId);
      if (!agent || agent.status === status) return prev;
      const agents = new Map(prev.agents);
      // Idle clears the speech-bubble text (mirrors the old agentToolTextRef.delete).
      agents.set(agentId, { ...agent, status, toolText: status === 'idle' ? '' : agent.toolText });
      return { ...prev, agents };
    });
  }

  setTool(agentId: string, toolText: string): void {
    this.store.update((prev) => {
      const agent = prev.agents.get(agentId);
      if (!agent) return prev;
      const agents = new Map(prev.agents);
      agents.set(agentId, { ...agent, status: 'active', toolText });
      return { ...prev, agents, log: pushLog(prev.log, `${agent.displayName}: ${toolText}`) };
    });
  }

  setLinkedTicket(agentId: string, ticketId?: string, ticketTitle?: string): void {
    this.store.update((prev) => {
      const agent = prev.agents.get(agentId);
      if (!agent) return prev;
      const agents = new Map(prev.agents);
      agents.set(agentId, { ...agent, linkedTicketId: ticketId, linkedTicketTitle: ticketTitle });
      return { ...prev, agents };
    });
  }

  /** Clear all agents on WS reconnect; the server re-sends current sessions. */
  clear(): void {
    this.store.update((prev) =>
      prev.agents.size === 0 ? prev : { ...prev, agents: new Map() },
    );
  }

  toggleVisible(): void {
    this.store.update((prev) => ({ ...prev, visible: !prev.visible }));
  }

  /** Map of agentId -> live tool text, for in-world speech bubbles. */
  toolTextMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const agent of this.store.get().agents.values()) {
      if (agent.toolText) map.set(agent.agentId, agent.toolText);
    }
    return map;
  }

  /** Ticket IDs with an active agent working on them (drives wall-note highlight). */
  linkedTicketIds(): Set<string> {
    const ids = new Set<string>();
    for (const agent of this.store.get().agents.values()) {
      if (agent.linkedTicketId && agent.status === 'active') ids.add(agent.linkedTicketId);
    }
    return ids;
  }

  snapshot(): OrchestrationState {
    const { agents, log, visible } = this.store.get();
    return { agents: [...agents.values()].map(toOrchestrationAgent), log, visible };
  }

  reset(): void {
    this.store.set({ agents: new Map(), log: [], visible: true });
  }
}

export const agentStore = new AgentStore();
