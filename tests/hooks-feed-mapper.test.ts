// tests/hooks-feed-mapper.test.ts
// Unit tests for the pure hooks-feed mapper: each of the 3 feed shapes ->
// ordered room events, malformed/empty guards, agentCreated-first ordering,
// and truncation.

import { describe, it, expect } from 'vitest';
import { mapFeedLineToRoomEvents } from '../scripts/hooks-feed-mapper.mjs';
import type { RoomEvent, AgentCreatedEvent, AgentToolEvent } from '../scripts/hooks-feed-mapper.mjs';

function created(events: RoomEvent[]): AgentCreatedEvent {
  const e = events.find((x): x is AgentCreatedEvent => x.type === 'agentCreated');
  if (!e) throw new Error('expected agentCreated event');
  return e;
}

function tool(events: RoomEvent[]): AgentToolEvent {
  const e = events.find((x): x is AgentToolEvent => x.type === 'agentTool');
  if (!e) throw new Error('expected agentTool event');
  return e;
}

describe('mapFeedLineToRoomEvents', () => {
  it('maps opencode-role-feed shape (sessionId) to created+status+tool in order', () => {
    const line = JSON.stringify({
      source: 'opencode-role-feed',
      ts: '2026-09-12T00:00:00.000Z',
      role: 'core-dev',
      sessionId: 's-opencode-1',
      tool: 'Edit',
      summary: 'Edit src/RoomCanvas.tsx',
    });

    const events = mapFeedLineToRoomEvents(line, new Set());

    expect(events.map((e) => e.type)).toEqual(['agentCreated', 'agentStatus', 'agentTool']);
    expect(created(events)).toMatchObject({
      agentId: 's-opencode-1',
      terminalName: 'core-dev',
      team: 'core-dev',
      role: 'core-dev',
      taskArea: 'Edit',
    });
    expect(events[1]).toEqual({ type: 'agentStatus', agentId: 's-opencode-1', status: 'active' });
    expect(tool(events)).toEqual({
      type: 'agentTool',
      agentId: 's-opencode-1',
      toolName: 'Edit',
      displayText: 'Edit src/RoomCanvas.tsx',
    });
  });

  it('reads sessionID (camelCase) as a fallback for the agentId', () => {
    const line = JSON.stringify({
      source: 'opencode-role-feed',
      role: 'core-dev',
      sessionID: 's-upper-1',
      tool: 'Bash',
      summary: 'npm test',
    });

    const events = mapFeedLineToRoomEvents(line, new Set());

    expect(created(events).agentId).toBe('s-upper-1');
  });

  it('maps room-tool-feed shape with a ses_* id', () => {
    const line = JSON.stringify({
      source: 'room-tool-feed',
      ts: '2026-09-12T00:00:00.000Z',
      role: 'core-dev',
      sessionId: 'ses_f6b176f7abcd',
      tool: 'Write',
      matchedRoleTrigger: true,
      summary: 'Write tests/foo.test.ts',
    });

    const events = mapFeedLineToRoomEvents(line, new Set());

    expect(events[0].type).toBe('agentCreated');
    expect(created(events).agentId).toBe('ses_f6b176f7abcd');
    expect(tool(events)).toMatchObject({
      type: 'agentTool',
      toolName: 'Write',
      displayText: 'Write tests/foo.test.ts',
    });
  });

  it('maps gsd-event-hook shape (text/action/gsdCmd, no sessionId)', () => {
    const line = JSON.stringify({
      source: 'gsd-event-hook',
      ts: '2026-09-12T00:00:00.000Z',
      gsdCmd: 'plan-milestone',
      params: {},
      actor: 'alice',
      role: 'planner',
      action: 'room-notify',
      text: 'milestone planned',
    });

    const events = mapFeedLineToRoomEvents(line, new Set());

    // No sessionId -> agentId falls back to hooks-<role>
    expect(created(events).agentId).toBe('hooks-planner');
    // 'planner' is not a TeamSection -> team falls back to core-dev
    expect(created(events).team).toBe('core-dev');
    // taskArea prefers action; toolName prefers gsdCmd; displayText = text
    expect(created(events).taskArea).toBe('room-notify');
    expect(tool(events)).toMatchObject({
      type: 'agentTool',
      toolName: 'plan-milestone',
      displayText: 'milestone planned',
    });
  });

  it('falls back to hooks-<role> when sessionId is missing', () => {
    const line = JSON.stringify({
      source: 'opencode-role-feed',
      role: 'core-dev',
      tool: 'Read',
      summary: 'Read foo.ts',
    });

    const events = mapFeedLineToRoomEvents(line, new Set());

    expect(created(events).agentId).toBe('hooks-core-dev');
  });

  it('maps an unknown role to the core-dev team', () => {
    const line = JSON.stringify({
      source: 'room-tool-feed',
      role: 'asset-pipeline',
      sessionId: 'ses_asset',
      tool: 'Bash',
      summary: 'pack sprites',
    });

    const events = mapFeedLineToRoomEvents(line, new Set());

    expect(created(events).team).toBe('core-dev');
  });

  it('maps each TeamSection role to itself', () => {
    for (const role of ['planning', 'core-dev', 'infrastructure', 'support']) {
      const line = JSON.stringify({
        source: 'room-tool-feed',
        role,
        sessionId: `ses_${role}`,
        tool: 'Bash',
        summary: 'x',
      });
      const events = mapFeedLineToRoomEvents(line, new Set());
      expect(created(events).team).toBe(role);
    }
  });

  it('maps a role containing "atlas" to terminalName "Atlas (core-dev)"', () => {
    const line = JSON.stringify({
      source: 'room-tool-feed',
      role: 'atlas-core-dev',
      sessionId: 'ses_atlas',
      tool: 'Bash',
      summary: 'x',
    });

    const events = mapFeedLineToRoomEvents(line, new Set());

    expect(created(events).terminalName).toBe('Atlas (core-dev)');
  });

  it('produces an integer variant in 0..5 for any agentId', () => {
    for (const id of ['a', 'b', 'hooks-core-dev', 'ses_123', 's-xyz', 'hooks-planner']) {
      const line = JSON.stringify({
        source: 'room-tool-feed',
        role: 'core-dev',
        sessionId: id,
        tool: 'Bash',
        summary: 'x',
      });
      const events = mapFeedLineToRoomEvents(line, new Set());
      const variant = created(events).variant;
      expect(Number.isInteger(variant)).toBe(true);
      expect(variant).toBeGreaterThanOrEqual(0);
      expect(variant).toBeLessThanOrEqual(5);
    }
  });

  it('returns [] for malformed JSON', () => {
    expect(mapFeedLineToRoomEvents('{not json', new Set())).toEqual([]);
    expect(mapFeedLineToRoomEvents('{"source":', new Set())).toEqual([]);
  });

  it('returns [] for an empty / whitespace-only line', () => {
    expect(mapFeedLineToRoomEvents('', new Set())).toEqual([]);
    expect(mapFeedLineToRoomEvents('   \n', new Set())).toEqual([]);
  });

  it('returns [] for a non-string line', () => {
    // @ts-expect-error — defensive guard for a malformed caller input
    expect(mapFeedLineToRoomEvents(null, new Set())).toEqual([]);
  });

  it('skips a line with no role and no session', () => {
    const line = JSON.stringify({ source: 'unknown', tool: 'Bash' });
    expect(mapFeedLineToRoomEvents(line, new Set())).toEqual([]);
  });

  it('omits agentCreated on the second call with the same agentId', () => {
    const known: Set<string> = new Set();
    const line = JSON.stringify({
      source: 'opencode-role-feed',
      role: 'core-dev',
      sessionId: 's-repeat',
      tool: 'Edit',
      summary: 'x',
    });

    const first = mapFeedLineToRoomEvents(line, known);
    expect(first.map((e) => e.type)).toEqual(['agentCreated', 'agentStatus', 'agentTool']);

    // Caller contract: add the agentId to the set AFTER the call.
    known.add('s-repeat');

    const second = mapFeedLineToRoomEvents(line, known);
    expect(second.map((e) => e.type)).toEqual(['agentStatus', 'agentTool']);
    expect(second).toHaveLength(2);
    expect(second.find((e) => e.type === 'agentCreated')).toBeUndefined();
  });

  it('truncates displayText (summary) to 120 chars', () => {
    const long = 'x'.repeat(300);
    const line = JSON.stringify({
      source: 'opencode-role-feed',
      role: 'core-dev',
      sessionId: 's-long',
      tool: 'Edit',
      summary: long,
    });

    const events = mapFeedLineToRoomEvents(line, new Set());

    expect(tool(events).displayText).toHaveLength(120);
    expect(tool(events).displayText).toBe(long.slice(0, 120));
  });

  it('truncates taskArea to 60 chars', () => {
    const longTool = 'y'.repeat(100);
    const line = JSON.stringify({
      source: 'room-tool-feed',
      role: 'core-dev',
      sessionId: 's-60',
      tool: longTool,
      summary: 'x',
    });

    const events = mapFeedLineToRoomEvents(line, new Set());

    expect(created(events).taskArea).toHaveLength(60);
  });

  it('defaults toolName to "hook" and displayText to summary when tool is absent', () => {
    const line = JSON.stringify({
      source: 'opencode-role-feed',
      role: 'core-dev',
      sessionId: 's-no-tool',
      summary: 'just a summary',
    });

    const events = mapFeedLineToRoomEvents(line, new Set());

    expect(tool(events).toolName).toBe('hook');
    expect(tool(events).displayText).toBe('just a summary');
  });
});
