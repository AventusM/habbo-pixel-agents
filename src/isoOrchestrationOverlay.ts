// src/isoOrchestrationOverlay.ts
// In-canvas orchestration panel overlay — renders agent list, section stats, and activity log
// directly onto the room canvas as a screen-space HUD (no separate webview needed).

import type { TeamSection } from './agentTypes.js';

export interface OrchestrationAgent {
  agentId: string;
  displayName: string;
  team: TeamSection;
  status: 'active' | 'idle';
  toolText: string;
}

export interface OrchestrationLogEntry {
  time: string;
  text: string;
}

export interface OrchestrationState {
  agents: OrchestrationAgent[];
  log: OrchestrationLogEntry[];
  visible: boolean;
}

const PANEL_WIDTH = 220;
const PADDING = 8;
const HEADER_HEIGHT = 18;
const ROW_HEIGHT = 14;
const STAT_HEIGHT = 12;
const LOG_ROW_HEIGHT = 11;
const MAX_LOG_VISIBLE = 12;
const FONT = '7px "Press Start 2P", monospace';
const FONT_SMALL = '6px "Press Start 2P", monospace';

const TEAM_COLORS: Record<TeamSection, string> = {
  'planning': '#4a9eff',
  'core-dev': '#4aff4a',
  'infrastructure': '#ffaa4a',
  'support': '#ff4a4a',
};

const TEAM_LABELS: Record<TeamSection, string> = {
  'planning': 'Planning',
  'core-dev': 'Core Dev',
  'infrastructure': 'Infra',
  'support': 'Support',
};

const TEAM_ORDER: TeamSection[] = ['planning', 'core-dev', 'infrastructure', 'support'];

export function createOrchestrationState(): OrchestrationState {
  return { agents: [], log: [], visible: true };
}

export function orchestrationAddAgent(
  state: OrchestrationState,
  agentId: string,
  displayName: string,
  team: TeamSection,
): void {
  // Update if exists, else add
  const existing = state.agents.find(a => a.agentId === agentId);
  if (existing) {
    existing.displayName = displayName;
    existing.team = team;
    return;
  }
  state.agents.push({ agentId, displayName, team, status: 'idle', toolText: '' });
  pushLog(state, `+ ${displayName}`);
}

export function orchestrationRemoveAgent(state: OrchestrationState, agentId: string): void {
  const idx = state.agents.findIndex(a => a.agentId === agentId);
  if (idx >= 0) {
    pushLog(state, `- ${state.agents[idx].displayName}`);
    state.agents.splice(idx, 1);
  }
}

export function orchestrationSetStatus(state: OrchestrationState, agentId: string, status: 'active' | 'idle'): void {
  const agent = state.agents.find(a => a.agentId === agentId);
  if (agent) agent.status = status;
}

export function orchestrationSetTool(state: OrchestrationState, agentId: string, toolText: string): void {
  const agent = state.agents.find(a => a.agentId === agentId);
  if (agent) {
    agent.status = 'active';
    agent.toolText = toolText;
    pushLog(state, `${agent.displayName}: ${toolText}`);
  }
}

function pushLog(state: OrchestrationState, text: string): void {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  state.log.unshift({ time, text });
  if (state.log.length > 50) state.log.pop();
}

/**
 * Draw the orchestration overlay panel on the right side of the canvas.
 * Called in screen-space (outside camera transform).
 */
export function drawOrchestrationOverlay(
  ctx: CanvasRenderingContext2D,
  state: OrchestrationState,
  canvasWidth: number,
  canvasHeight: number,
): void {
  if (!state.visible) return;

  const x = canvasWidth - PANEL_WIDTH - 8;
  const y = 8;
  const totalAgents = state.agents.length;

  // Calculate panel height dynamically
  const sectionStatsHeight = TEAM_ORDER.length * STAT_HEIGHT + 8;
  const agentListHeight = totalAgents > 0
    ? TEAM_ORDER.reduce((h, team) => {
        const teamAgents = state.agents.filter(a => a.team === team);
        if (teamAgents.length === 0) return h;
        return h + HEADER_HEIGHT + teamAgents.length * ROW_HEIGHT;
      }, 0)
    : ROW_HEIGHT;
  const logHeaderHeight = HEADER_HEIGHT;
  const logHeight = Math.min(state.log.length, MAX_LOG_VISIBLE) * LOG_ROW_HEIGHT;
  const panelHeight = PADDING + sectionStatsHeight + agentListHeight + logHeaderHeight + logHeight + PADDING * 3;

  // Panel background
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x, y, PANEL_WIDTH, Math.min(panelHeight, canvasHeight - 16));
  ctx.globalAlpha = 1;

  // Panel border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, PANEL_WIDTH, Math.min(panelHeight, canvasHeight - 16));

  let curY = y + PADDING;

  // --- Section stats ---
  for (const team of TEAM_ORDER) {
    const count = state.agents.filter(a => a.team === team).length;
    const active = state.agents.filter(a => a.team === team && a.status === 'active').length;

    // Left color bar
    ctx.fillStyle = TEAM_COLORS[team];
    ctx.fillRect(x + PADDING, curY, 2, STAT_HEIGHT - 2);

    // Label
    ctx.font = FONT_SMALL;
    ctx.fillStyle = '#888';
    ctx.fillText(TEAM_LABELS[team], x + PADDING + 6, curY + 8);

    // Count
    const countText = `${count}` + (active > 0 ? ` (${active})` : '');
    ctx.fillStyle = TEAM_COLORS[team];
    ctx.fillText(countText, x + PANEL_WIDTH - PADDING - ctx.measureText(countText).width, curY + 8);

    curY += STAT_HEIGHT;
  }

  curY += 6;

  // --- Agent list grouped by team ---
  if (totalAgents === 0) {
    ctx.font = FONT_SMALL;
    ctx.fillStyle = '#555';
    ctx.fillText('No agents active', x + PADDING + 20, curY + 10);
    curY += ROW_HEIGHT;
  } else {
    for (const team of TEAM_ORDER) {
      const teamAgents = state.agents.filter(a => a.team === team);
      if (teamAgents.length === 0) continue;

      // Team header
      ctx.font = FONT;
      ctx.fillStyle = TEAM_COLORS[team];
      ctx.fillText(TEAM_LABELS[team].toUpperCase(), x + PADDING, curY + 12);
      ctx.fillStyle = TEAM_COLORS[team] + '44';
      ctx.fillRect(x + PADDING, curY + 15, PANEL_WIDTH - PADDING * 2, 1);
      curY += HEADER_HEIGHT;

      // Agent rows
      for (const agent of teamAgents) {
        // Status dot
        ctx.beginPath();
        ctx.arc(x + PADDING + 4, curY + 6, 3, 0, Math.PI * 2);
        ctx.fillStyle = agent.status === 'active' ? '#4aff4a' : '#555';
        ctx.fill();

        // Name
        ctx.font = FONT_SMALL;
        ctx.fillStyle = '#ccc';
        const name = truncate(agent.displayName, 20);
        ctx.fillText(name, x + PADDING + 12, curY + 8);

        // Tool text (under name)
        if (agent.toolText && agent.status === 'active') {
          ctx.fillStyle = '#666';
          ctx.fillText(truncate(agent.toolText, 26), x + PADDING + 12, curY + 8);
        }

        curY += ROW_HEIGHT;
      }
    }
  }

  curY += 4;

  // --- Activity log header ---
  ctx.font = FONT;
  ctx.fillStyle = '#888';
  ctx.fillText('ACTIVITY', x + PADDING, curY + 12);
  ctx.fillStyle = '#333';
  ctx.fillRect(x + PADDING, curY + 15, PANEL_WIDTH - PADDING * 2, 1);
  curY += HEADER_HEIGHT;

  // --- Log entries ---
  if (state.log.length === 0) {
    ctx.font = FONT_SMALL;
    ctx.fillStyle = '#444';
    ctx.fillText('No events yet', x + PADDING + 20, curY + 8);
  } else {
    ctx.font = FONT_SMALL;
    const visibleLogs = state.log.slice(0, MAX_LOG_VISIBLE);
    for (const entry of visibleLogs) {
      if (curY + LOG_ROW_HEIGHT > canvasHeight - 8) break;

      ctx.fillStyle = '#555';
      ctx.fillText(entry.time, x + PADDING, curY + 8);

      ctx.fillStyle = '#999';
      ctx.fillText(truncate(entry.text, 22), x + PADDING + 40, curY + 8);

      curY += LOG_ROW_HEIGHT;
    }
  }

  ctx.restore();
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 2) + '..' : str;
}