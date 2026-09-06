// tests/bus.test.ts
// Unit tests for the typed message bus: stateful replay, late-subscriber
// state sync, and ephemeral message handling.

import { describe, it, expect, beforeEach } from 'vitest';
import { emitMessage, onMessage, resetBus } from '../src/bus.js';
import type { ExtensionMessage } from '../src/agentTypes.js';

describe('bus', () => {
  beforeEach(() => resetBus());

  it('delivers messages to subscribed listeners', () => {
    const seen: ExtensionMessage[] = [];
    onMessage((m) => seen.push(m));
    emitMessage({ type: 'agentCreated', agentId: 'a1', terminalName: 'T', variant: 0 });
    expect(seen).toHaveLength(1);
  });

  it('replays retained kanbanCards to a late subscriber (the Q13b guarantee)', () => {
    // Emit BEFORE any listener exists (the demo-timing failure mode)
    emitMessage({ type: 'kanbanCards', cards: [{ id: 'c1', title: 'card', status: 'To Do' }] });
    const seen: ExtensionMessage[] = [];
    onMessage((m) => seen.push(m));
    expect(seen.some((m) => m.type === 'kanbanCards' && m.cards[0].id === 'c1')).toBe(true);
  });

  it('replays agent state (created/status) to a late subscriber', () => {
    emitMessage({ type: 'agentCreated', agentId: 'a1', terminalName: 'T', variant: 0 });
    emitMessage({ type: 'agentStatus', agentId: 'a1', status: 'active' });
    const seen: ExtensionMessage[] = [];
    onMessage((m) => seen.push(m));
    const created = seen.find((m) => m.type === 'agentCreated');
    const status = seen.find((m) => m.type === 'agentStatus');
    expect(created && created.type === 'agentCreated' && created.agentId).toBe('a1');
    expect(status && status.type === 'agentStatus' && status.status).toBe('active');
  });

  it('does not resurrect removed agents on replay', () => {
    emitMessage({ type: 'agentCreated', agentId: 'a1', terminalName: 'T', variant: 0 });
    emitMessage({ type: 'agentRemoved', agentId: 'a1' });
    const seen: ExtensionMessage[] = [];
    onMessage((m) => seen.push(m));
    expect(seen.some((m) => m.type === 'agentCreated')).toBe(false);
  });

  it('clearAgents wipes retained agent state and is not replayed', () => {
    emitMessage({ type: 'agentCreated', agentId: 'a1', terminalName: 'T', variant: 0 });
    emitMessage({ type: 'clearAgents' });
    const seen: ExtensionMessage[] = [];
    onMessage((m) => seen.push(m));
    expect(seen.some((m) => m.type === 'agentCreated')).toBe(false);
    expect(seen.some((m) => m.type === 'clearAgents')).toBe(false);
  });

  it('replays only the latest stateful message per type', () => {
    emitMessage({ type: 'kanbanCards', cards: [{ id: 'c1', title: 'old', status: 'To Do' }] });
    emitMessage({ type: 'kanbanCards', cards: [{ id: 'c2', title: 'new', status: 'Doing' }] });
    const seen: ExtensionMessage[] = [];
    onMessage((m) => seen.push(m));
    const cards = seen.filter((m) => m.type === 'kanbanCards');
    expect(cards).toHaveLength(1);
    expect(cards[0].type === 'kanbanCards' && cards[0].cards[0].id).toBe('c2');
  });

  it('replays retained state to every new subscriber (state sync)', () => {
    emitMessage({ type: 'kanbanCards', cards: [{ id: 'c1', title: 'card', status: 'To Do' }] });
    const first: ExtensionMessage[] = [];
    const second: ExtensionMessage[] = [];
    onMessage((m) => first.push(m));
    onMessage((m) => second.push(m));
    expect(first.some((m) => m.type === 'kanbanCards')).toBe(true);
    expect(second.some((m) => m.type === 'kanbanCards')).toBe(true);
  });

  it('does not retain ephemeral messages', () => {
    emitMessage({ type: 'agentTool', agentId: 'a1', toolName: 'Bash', displayText: 'npm test' });
    const seen: ExtensionMessage[] = [];
    onMessage((m) => seen.push(m));
    // agentTool for an UNKNOWN agent is not retained (nothing to sync)
    expect(seen.some((m) => m.type === 'agentTool')).toBe(false);
  });
});
