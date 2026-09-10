// tests/agentStore.test.ts
// Unit tests for the agent store: lifecycle, status/tool/ticket updates,
// orchestration snapshot, and the WS-reconnect clearAgents regression.

import { describe, it, expect } from 'vitest';
import { AgentStore } from '../src/state/agentStore.js';

describe('agentStore', () => {
  it('adds and removes agents', () => {
    const store = new AgentStore();
    store.addAgent('a1', 'Alice', 'core-dev');
    expect(store.size).toBe(1);
    expect(store.get('a1')?.team).toBe('core-dev');
    expect(store.get('a1')?.status).toBe('idle');
    store.removeAgent('a1');
    expect(store.size).toBe(0);
  });

  it('updates an existing agent without adding a duplicate', () => {
    const store = new AgentStore();
    store.addAgent('a1', 'Alice', 'core-dev');
    store.addAgent('a1', 'Alice B', 'planning');
    expect(store.size).toBe(1);
    expect(store.get('a1')?.displayName).toBe('Alice B');
    expect(store.get('a1')?.team).toBe('planning');
  });

  it('tracks status and clears speech text when idle', () => {
    const store = new AgentStore();
    store.addAgent('a1', 'Alice', 'core-dev');
    store.setTool('a1', 'Bash npm test');
    expect(store.get('a1')?.status).toBe('active');
    expect(store.toolTextMap().get('a1')).toBe('Bash npm test');
    store.setStatus('a1', 'idle');
    expect(store.get('a1')?.status).toBe('idle');
    expect(store.toolTextMap().has('a1')).toBe(false);
  });

  it('links tickets and only flags active agents', () => {
    const store = new AgentStore();
    store.addAgent('a1', 'Alice', 'core-dev');
    store.setLinkedTicket('a1', '42', 'Fix widget');
    expect(store.linkedTicketIds().has('42')).toBe(false);
    store.setStatus('a1', 'active');
    expect(store.linkedTicketIds().has('42')).toBe(true);
  });

  it('builds an orchestration snapshot with visibility', () => {
    const store = new AgentStore();
    store.addAgent('a1', 'Alice', 'core-dev');
    expect(store.snapshot().agents.map((a) => a.agentId)).toEqual(['a1']);
    expect(store.snapshot().visible).toBe(true);
    store.toggleVisible();
    expect(store.snapshot().visible).toBe(false);
  });

  it('notifies subscribers on change', () => {
    const store = new AgentStore();
    const counts: number[] = [];
    store.subscribe((state) => counts.push(state.agents.size));
    store.addAgent('a1', 'Alice', 'core-dev');
    expect(counts).toEqual([0, 1]);
  });

  it('clearAgents on WS reconnect clears then repopulates', () => {
    const store = new AgentStore();
    // Stale sessions from before the drop
    store.addAgent('stale-1', 'Stale One', 'core-dev');
    store.addAgent('stale-2', 'Stale Two', 'support');
    store.setStatus('stale-1', 'active');
    expect(store.size).toBe(2);

    // wsClient emits clearAgents on reconnect (RoomCanvas calls store.clear())
    store.clear();
    expect(store.size).toBe(0);
    expect(store.toolTextMap().size).toBe(0);
    expect(store.linkedTicketIds().size).toBe(0);

    // Server re-sends current sessions; store repopulates
    store.addAgent('live-1', 'Live One', 'infrastructure');
    store.setStatus('live-1', 'active');
    store.setTool('live-1', 'Read deploy.yml');
    expect(store.size).toBe(1);
    expect(store.get('live-1')?.status).toBe('active');
    expect(store.toolTextMap().get('live-1')).toBe('Read deploy.yml');
    expect(store.get('stale-1')).toBeUndefined();
  });

  it('reset returns to the empty initial state', () => {
    const store = new AgentStore();
    store.addAgent('a1', 'Alice', 'core-dev');
    store.toggleVisible();
    store.reset();
    expect(store.size).toBe(0);
    expect(store.visible).toBe(true);
    expect(store.snapshot().log).toEqual([]);
  });
});
