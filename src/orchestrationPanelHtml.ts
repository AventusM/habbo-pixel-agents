// src/orchestrationPanelHtml.ts
// HTML/CSS/JS content for the orchestration sidebar webview panel

import * as vscode from 'vscode';

/**
 * Generate the full HTML content for the orchestration sidebar panel.
 * Single-file sidebar webview with embedded CSS and JS.
 */
export function getOrchestrationPanelHtml(
  _webview: vscode.Webview,
  _extensionUri: vscode.Uri,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Press Start 2P', var(--vscode-editor-font-family), monospace;
      font-size: 8px;
      background: var(--vscode-sideBar-background, #1e1e2e);
      color: var(--vscode-sideBar-foreground, #cdd6f4);
      overflow-y: auto;
      padding: 6px;
    }

    /* Section jump buttons */
    .section-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      margin-bottom: 8px;
    }

    .section-tab {
      background: transparent;
      border: 1px solid;
      color: inherit;
      font-family: inherit;
      font-size: 7px;
      padding: 5px 4px;
      cursor: pointer;
      text-align: center;
      image-rendering: pixelated;
    }

    .section-tab:hover {
      filter: brightness(1.3);
    }

    .section-tab[data-team="planning"] {
      border-color: #4a9eff;
      color: #4a9eff;
    }
    .section-tab[data-team="core-dev"] {
      border-color: #4aff4a;
      color: #4aff4a;
    }
    .section-tab[data-team="infrastructure"] {
      border-color: #ffaa4a;
      color: #ffaa4a;
    }
    .section-tab[data-team="support"] {
      border-color: #ff4a4a;
      color: #ff4a4a;
    }

    /* Section overview */
    .section-overview {
      margin-bottom: 8px;
    }

    .section-stat {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 4px;
      margin-bottom: 2px;
      font-size: 7px;
      border-left: 2px solid;
    }

    .section-stat[data-team="planning"]       { border-color: #4a9eff; }
    .section-stat[data-team="core-dev"]       { border-color: #4aff4a; }
    .section-stat[data-team="infrastructure"] { border-color: #ffaa4a; }
    .section-stat[data-team="support"]        { border-color: #ff4a4a; }

    .stat-label { opacity: 0.7; }
    .stat-value { font-weight: bold; }

    /* Section header */
    .section-header {
      font-size: 8px;
      padding: 4px;
      margin-top: 6px;
      margin-bottom: 3px;
      border-bottom: 1px solid;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .section-header[data-team="planning"]       { color: #4a9eff; border-color: #4a9eff44; }
    .section-header[data-team="core-dev"]       { color: #4aff4a; border-color: #4aff4a44; }
    .section-header[data-team="infrastructure"] { color: #ffaa4a; border-color: #ffaa4a44; }
    .section-header[data-team="support"]        { color: #ff4a4a; border-color: #ff4a4a44; }

    /* Agent card */
    .agent-card {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 4px 6px;
      margin-bottom: 3px;
      background: var(--vscode-list-hoverBackground, #2a2a3e);
      border-radius: 2px;
    }

    .agent-info {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .status-dot.active  { background: #4aff4a; }
    .status-dot.idle    { background: #888; }

    .agent-name {
      font-size: 7px;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .agent-tool {
      font-size: 6px;
      opacity: 0.6;
      padding-left: 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .agent-actions {
      display: flex;
      gap: 3px;
      padding-left: 10px;
    }

    .action-btn {
      background: transparent;
      border: 1px solid var(--vscode-button-secondaryBackground, #444);
      color: var(--vscode-button-secondaryForeground, #ccc);
      font-family: inherit;
      font-size: 6px;
      padding: 2px 4px;
      cursor: pointer;
    }

    .action-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground, #555);
    }

    /* Activity log */
    .log-header {
      font-size: 8px;
      padding: 4px;
      margin-top: 8px;
      margin-bottom: 3px;
      border-bottom: 1px solid var(--vscode-panel-border, #444);
      color: var(--vscode-sideBar-foreground, #cdd6f4);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    #activity-log {
      max-height: 200px;
      overflow-y: auto;
    }

    .log-entry {
      font-size: 6px;
      padding: 2px 4px;
      border-bottom: 1px solid var(--vscode-panel-border, #333);
      opacity: 0.8;
    }

    .log-entry .log-time {
      opacity: 0.5;
      margin-right: 4px;
    }

    .empty-state {
      text-align: center;
      padding: 16px 8px;
      opacity: 0.5;
      font-size: 7px;
    }
  </style>
</head>
<body>
  <!-- Section Jump Buttons -->
  <div class="section-tabs">
    <button class="section-tab" data-team="planning">Planning</button>
    <button class="section-tab" data-team="core-dev">Core Dev</button>
    <button class="section-tab" data-team="infrastructure">Infra</button>
    <button class="section-tab" data-team="support">Support</button>
  </div>

  <!-- Section Overview -->
  <div class="section-overview" id="section-overview">
    <div class="section-stat" data-team="planning">
      <span class="stat-label">Planning</span>
      <span class="stat-value" id="stat-planning">0 agents</span>
    </div>
    <div class="section-stat" data-team="core-dev">
      <span class="stat-label">Core Dev</span>
      <span class="stat-value" id="stat-core-dev">0 agents</span>
    </div>
    <div class="section-stat" data-team="infrastructure">
      <span class="stat-label">Infra</span>
      <span class="stat-value" id="stat-infrastructure">0 agents</span>
    </div>
    <div class="section-stat" data-team="support">
      <span class="stat-label">Support</span>
      <span class="stat-value" id="stat-support">0 agents</span>
    </div>
  </div>

  <!-- Agent List -->
  <div id="agent-list">
    <div class="empty-state">No agents active</div>
  </div>

  <!-- Activity Log -->
  <div class="log-header">Activity</div>
  <div id="activity-log">
    <div class="empty-state">No events yet</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // Agent state
    const agents = new Map();
    const MAX_LOG_ENTRIES = 50;
    const logEntries = [];

    const teamOrder = ['planning', 'core-dev', 'infrastructure', 'support'];
    const teamColors = {
      'planning': '#4a9eff',
      'core-dev': '#4aff4a',
      'infrastructure': '#ffaa4a',
      'support': '#ff4a4a',
    };

    // --- Section jump buttons ---
    document.querySelectorAll('.section-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'jumpToSection', team: btn.dataset.team });
      });
    });

    // --- Render functions ---
    function renderAgentList() {
      const container = document.getElementById('agent-list');
      if (agents.size === 0) {
        container.innerHTML = '<div class="empty-state">No agents active</div>';
        updateSectionStats();
        return;
      }

      // Group agents by team
      const groups = {};
      for (const team of teamOrder) groups[team] = [];
      for (const [, agent] of agents) {
        const team = agent.team || 'core-dev';
        if (!groups[team]) groups[team] = [];
        groups[team].push(agent);
      }

      let html = '';
      for (const team of teamOrder) {
        const list = groups[team];
        if (list.length === 0) continue;

        html += '<div class="section-header" data-team="' + team + '">' + team.replace('-', ' ') + '</div>';

        for (const agent of list) {
          const statusClass = agent.status || 'idle';
          const toolText = agent.toolText || '';
          const nameDisplay = agent.role
            ? agent.role + (agent.taskArea ? ' - ' + agent.taskArea : '')
            : agent.terminalName;

          html += '<div class="agent-card" data-agent-id="' + agent.agentId + '">'
            + '<div class="agent-info">'
            + '<div class="status-dot ' + statusClass + '"></div>'
            + '<span class="agent-name">' + escapeHtml(nameDisplay) + '</span>'
            + '</div>';

          if (toolText) {
            html += '<div class="agent-tool">' + escapeHtml(toolText) + '</div>';
          }

          html += '<div class="agent-actions">'
            + '<button class="action-btn" onclick="jumpTo(\'' + agent.agentId + '\',\'' + (agent.team || 'core-dev') + '\')">Jump</button>'
            + '<button class="action-btn" onclick="viewTranscript(\'' + agent.agentId + '\')">Log</button>'
            + '<button class="action-btn" onclick="reassign(\'' + agent.agentId + '\')">Move</button>'
            + '</div>'
            + '</div>';
        }
      }

      container.innerHTML = html;
      updateSectionStats();
    }

    function updateSectionStats() {
      const counts = {};
      for (const team of teamOrder) counts[team] = 0;
      for (const [, agent] of agents) {
        const team = agent.team || 'core-dev';
        counts[team] = (counts[team] || 0) + 1;
      }
      for (const team of teamOrder) {
        const el = document.getElementById('stat-' + team);
        if (el) {
          const c = counts[team] || 0;
          const active = Array.from(agents.values()).filter(a => (a.team || 'core-dev') === team && a.status === 'active').length;
          el.textContent = c + ' agent' + (c !== 1 ? 's' : '') + (active > 0 ? ' (' + active + ' active)' : '');
        }
      }
    }

    function addLogEntry(text) {
      const now = new Date();
      const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      logEntries.unshift({ time, text });
      if (logEntries.length > MAX_LOG_ENTRIES) logEntries.pop();
      renderLog();
    }

    function renderLog() {
      const container = document.getElementById('activity-log');
      if (logEntries.length === 0) {
        container.innerHTML = '<div class="empty-state">No events yet</div>';
        return;
      }
      container.innerHTML = logEntries.map(e =>
        '<div class="log-entry"><span class="log-time">' + e.time + '</span>' + escapeHtml(e.text) + '</div>'
      ).join('');
    }

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // --- Quick actions ---
    function jumpTo(agentId, team) {
      vscode.postMessage({ type: 'jumpToSection', team: team });
    }

    function viewTranscript(agentId) {
      vscode.postMessage({ type: 'viewTranscript', agentId: agentId });
    }

    function reassign(agentId) {
      vscode.postMessage({ type: 'reassignAgent', agentId: agentId });
    }

    // --- Message handler ---
    window.addEventListener('message', event => {
      const msg = event.data;
      switch (msg.type) {
        case 'agentCreated': {
          agents.set(msg.agentId, {
            agentId: msg.agentId,
            terminalName: msg.terminalName,
            variant: msg.variant,
            status: 'idle',
            role: msg.role,
            team: msg.team,
            taskArea: msg.taskArea,
            toolText: '',
          });
          addLogEntry('Agent joined: ' + (msg.role || msg.terminalName));
          renderAgentList();
          break;
        }
        case 'agentRemoved': {
          const removed = agents.get(msg.agentId);
          agents.delete(msg.agentId);
          addLogEntry('Agent left: ' + (removed ? (removed.role || removed.terminalName) : msg.agentId));
          renderAgentList();
          break;
        }
        case 'agentStatus': {
          const agent = agents.get(msg.agentId);
          if (agent) {
            agent.status = msg.status;
            renderAgentList();
          }
          break;
        }
        case 'agentTool': {
          const agent = agents.get(msg.agentId);
          if (agent) {
            agent.toolText = msg.displayText;
            agent.status = 'active';
            addLogEntry((agent.role || agent.terminalName) + ': ' + msg.displayText);
            renderAgentList();
          }
          break;
        }
        case 'scrollToAgent': {
          const card = document.querySelector('[data-agent-id="' + msg.agentId + '"]');
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.outline = '1px solid #4a9eff';
            setTimeout(() => { card.style.outline = ''; }, 2000);
          }
          break;
        }
      }
    });
  </script>
</body>
</html>`;
}
