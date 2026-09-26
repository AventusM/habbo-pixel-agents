// scripts/hooks-feed-mapper.mjs
// Pure, dependency-free mapper: converts ONE .gsd/hooks-feed.jsonl line (any
// of the 3 feed shapes) into ordered room events (ExtensionMessage-shaped
// objects). No fs/ws/server imports so both the web server (step 3 of the
// hooks-room bridge) and vitest can import it.
//
// 3 feed shapes handled (see .omo/notepads/hooks-room-bridge/learnings.md):
//   - opencode-role-feed : { source, ts, role, sessionId?, tool, summary }
//   - room-tool-feed     : { source, ts, role, sessionId, tool, matchedRoleTrigger, summary }
//   - gsd-event-hook     : { source, ts, gsdCmd, params, actor, role, action, text }
//
// Shape detection is purely field-driven (no source switch needed): every rule
// below falls back gracefully across the differing field sets.

const TEAMS = new Set(['planning', 'core-dev', 'infrastructure', 'support']);

// Deterministic, non-negative string hash -> avatar variant (0-5). Same input
// always yields the same variant so an agent keeps its look across restarts.
function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) % 1000000007;
  }
  return h;
}

/**
 * Convert one hooks-feed JSONL line into ordered room events.
 *
 * @param {string} line  one raw JSONL line (any of the 3 feed shapes)
 * @param {Set<string>} knownAgentIds  agentIds the caller has already emitted
 * @returns {Array<object>}  ordered events — first sight:
 *   [agentCreated, agentStatus(active), agentTool]; already known:
 *   [agentStatus(active), agentTool]
 *
 * Ordering contract: when `knownAgentIds` does not yet contain the resolved
 * agentId, `agentCreated` is emitted FIRST, then `agentStatus` + `agentTool`.
 * This is mandatory: the room drops status/tool updates for unknown agents
 * (bus.ts / agentStore guards), while a duplicate `agentCreated` is idempotent
 * (RoomCanvas dup-guard). The CALLER must add the agentId to `knownAgentIds`
 * AFTER this call returns — this function never mutates the set.
 */
export function mapFeedLineToRoomEvents(line, knownAgentIds) {
  if (typeof line !== 'string') return [];
  const trimmed = line.trim();
  if (!trimmed) return [];

  let entry;
  try {
    entry = JSON.parse(trimmed);
  } catch {
    return []; // malformed / partial line / noise
  }
  if (!entry || typeof entry !== 'object') return [];

  // sessionId (lowercase, room-tool-feed + fixed role-feed) with a camelCase
  // sessionID fallback for older/other hosts.
  const sessionId = entry.sessionId ?? entry.sessionID ?? undefined;
  const role = typeof entry.role === 'string' && entry.role ? entry.role : undefined;

  // Skip lines with no identity: no role AND no session -> nothing to map.
  if (!role && !sessionId) return [];

  const agentId = sessionId || `hooks-${role}`;
  const tool = entry.tool;
  const action = entry.action;
  const gsdCmd = entry.gsdCmd;
  const summary = entry.summary;
  const text = entry.text;

  const terminalName = role
    ? role.toLowerCase().includes('atlas')
      ? 'Atlas (core-dev)'
      : role
    : agentId;
  const variant = hashString(agentId) % 6;
  const team = TEAMS.has(role) ? role : 'core-dev';
  const taskArea = String(tool || action || gsdCmd || 'hook').slice(0, 60);
  const toolName = String(tool || gsdCmd || action || 'hook');
  const displayText = String(summary || text || toolName).slice(0, 120);

  const events = [];

  if (!knownAgentIds || !knownAgentIds.has(agentId)) {
    events.push({
      type: 'agentCreated',
      agentId,
      terminalName,
      variant,
      role,
      team,
      taskArea,
    });
  }

  events.push({ type: 'agentStatus', agentId, status: 'active' });
  events.push({ type: 'agentTool', agentId, toolName, displayText });

  return events;
}
