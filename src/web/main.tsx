/**
 * Standalone web entry point for the Habbo room renderer.
 *
 * Mirrors src/webview.tsx but replaces VS Code webview URI resolution
 * with relative /assets/ paths, and skips acquireVsCodeApi entirely.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RoomCanvas } from '../RoomCanvas.js';
import { AvatarDebugGrid } from '../AvatarDebugGrid.js';
import { SpriteCache } from '../isoSpriteCache.js';
import { loadAllAssets, type AssetUris } from '../assetBootstrap.js';
import { getDegradations, onDegradations } from '../degradations.js';
import { generateFloorTemplate } from '../roomLayoutEngine.js';
import { scheduleDemoEvents } from './demoData.js';
import { onMessage } from '../bus.js';
import { appMode } from '../state/appMode.js';
import type { ExtensionMessage } from '../agentTypes.js';
import { connectWs, hasRealAgents, onWsStateChange, getWsState, type WsState } from './wsClient.js';

// Console log interceptor — capture last 200 lines for dev capture
const LOG_BUFFER_MAX = 200;
const logBuffer: string[] = [];
const origConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function pushLog(level: string, args: unknown[]) {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const text = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  logBuffer.push(`[${time} ${level}] ${text}`);
  if (logBuffer.length > LOG_BUFFER_MAX) logBuffer.shift();
}

console.log = (...args: unknown[]) => { pushLog('LOG', args); origConsole.log(...args); };
console.warn = (...args: unknown[]) => { pushLog('WRN', args); origConsole.warn(...args); };
console.error = (...args: unknown[]) => { pushLog('ERR', args); origConsole.error(...args); };

(window as any).__devLogBuffer = logBuffer;

// Generate floor template
let currentTemplate = generateFloorTemplate('small');
let FLOOR_HEIGHTMAP = currentTemplate.heightmap;
(window as any).floorTemplate = currentTemplate;

// No VS Code API in standalone mode — set up extensionMessage relay as no-op source
// RoomCanvas already guards vscodeApi calls with null checks

// Asset URIs using relative paths (works at server root and under Pages subpaths)
const ASSET_BASE = './assets';
(window as any).ASSET_URIS = {
  chairPng: `${ASSET_BASE}/chair_atlas.png`,
  chairJson: `${ASSET_BASE}/chair_atlas.json`,
  furniturePng: `${ASSET_BASE}/furniture_atlas.png`,
  furnitureJson: `${ASSET_BASE}/furniture_atlas.json`,
  avatarPng: `${ASSET_BASE}/avatar_atlas.png`,
  avatarJson: `${ASSET_BASE}/avatar_atlas.json`,
  notificationSound: `${ASSET_BASE}/sounds/notification.ogg`,
  nitroManifest: `${ASSET_BASE}/manifest.json`,
  nitroFurnitureBase: `${ASSET_BASE}/furniture`,
  nitroFigureBase: `${ASSET_BASE}/figures`,
  pixellabPng: `${ASSET_BASE}/pixellab/rd-eval-char.png`,
  pixellabJson: `${ASSET_BASE}/pixellab/rd-eval-char.json`,
  plPlanningPng: `${ASSET_BASE}/pixellab/rd-eval-char.png`,
  plPlanningJson: `${ASSET_BASE}/pixellab/rd-eval-char.json`,
  plCoreDevPng: `${ASSET_BASE}/pixellab/rd-eval-char.png`,
  plCoreDevJson: `${ASSET_BASE}/pixellab/rd-eval-char.json`,
  plInfrastructurePng: `${ASSET_BASE}/pixellab/rd-eval-char.png`,
  plInfrastructureJson: `${ASSET_BASE}/pixellab/rd-eval-char.json`,
  plSupportPng: `${ASSET_BASE}/pixellab/rd-eval-char.png`,
  plSupportJson: `${ASSET_BASE}/pixellab/rd-eval-char.json`,
};

// Initialize sprite cache and load assets before rendering
const spriteCache = new SpriteCache();

(async () => {
  try {
    const uris = (window as any).ASSET_URIS;

    // Shared asset bootstrap (web + extension hosts use the same module)
    const report = await loadAllAssets(spriteCache, uris as AssetUris);
    console.log(
      [`✓ Bootstrap: atlases=${Object.entries(report.atlases).map(([k, v]) => k + ':' + v).join(',')}`,
       report.nitroFurniture ? `furniture=${report.nitroFurniture.loaded}/${report.nitroFurniture.total}` : null,
       report.nitroFigures ? `figures=${report.nitroFigures.loaded}/${report.nitroFigures.total}` : null,
       `figuresAvailable=${report.figuresAvailable}`].filter(Boolean).join(' | '),
    );

    // Make sprite cache globally available for RoomCanvas
    (window as any).spriteCache = spriteCache;

    // Render RoomCanvas — or the figure sprite-sheet debug grid (?debuggrid=1)
    const root = document.getElementById('root');
    if (root) {
      const rootElement = createRoot(root);
      if (new URLSearchParams(window.location.search).has('debuggrid')) {
        console.log('✓ Rendering AvatarDebugGrid (sprite-sheet debug view)');
        rootElement.render(React.createElement(AvatarDebugGrid, {
          onClose: () => rootElement.render(React.createElement(RoomCanvas, { heightmap: FLOOR_HEIGHTMAP })),
        }));
      } else {
        console.log('✓ Rendering RoomCanvas (standalone mode)');
        rootElement.render(React.createElement(RoomCanvas, { heightmap: FLOOR_HEIGHTMAP }));
      }

      // Connect to WebSocket for real agent data
      connectWs();

      // Track feed modes per agent for status bar display
      const agentFeedModes = new Map<string, { mode: string; reason: string }>();



      // Listen for agentFeedMode messages
      onMessage((msg: ExtensionMessage) => {
        if (msg.type === 'agentFeedMode') {
          agentFeedModes.set(msg.agentId, { mode: msg.feedMode, reason: msg.feedReason });
          updateStatusBar(getWsState());
        } else if (msg.type === 'agentRemoved') {
          agentFeedModes.delete(msg.agentId);
          updateStatusBar(getWsState());
        }
      });

      // Create status bar
      const statusBar = document.createElement('div');
      statusBar.id = 'status-bar';
      statusBar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:20px;background:rgba(26,26,46,0.9);display:flex;align-items:center;padding:0 8px;font:6px "Press Start 2P",monospace;color:#888;z-index:100;gap:12px;';
      document.body.appendChild(statusBar);

      function buildFeedModeIndicators(): string {
        if (agentFeedModes.size === 0) return '';
        const indicators: string[] = [];
        for (const [agentId, { mode }] of agentFeedModes) {
          // Extract short PR label from agentId like "copilot-pr-42"
          const prMatch = agentId.match(/pr-(\d+)/);
          const label = prMatch ? `#${prMatch[1]}` : agentId.slice(0, 10);

          let dot: string;
          let modeLabel: string;
          if (mode === 'sse') {
            dot = '🟢';
            modeLabel = 'live';
          } else if (mode === 'fast-poll') {
            dot = '🟠';
            modeLabel = '3s';
          } else {
            dot = '🟡';
            modeLabel = '15s';
          }
          indicators.push(`<span title="${mode}">${dot} ${label}:${modeLabel}</span>`);
        }
        return `<span style="display:flex;gap:6px;margin-left:8px;color:#aaa">${indicators.join('')}</span>`;
      }

      let boardSource = 'none';
      let figuresAvailable = false;

      function updateStatusBar(wsState: WsState) {
        const dot = wsState === 'connected' ? '🟢' : wsState === 'connecting' ? '🟡' : '🔴';
        const label = wsState === 'connected' ? 'Connected' : wsState === 'connecting' ? 'Connecting...' : 'Disconnected';
        const demoLabel = appMode.is('demo') ? '<span style="color:#f59e0b;margin-left:8px">● DEMO MODE</span>' : '';
        const feedIndicators = buildFeedModeIndicators();
        const degr = getDegradations();
        const degrLabel = degr.length > 0
          ? `<span style="color:#f87171;margin-left:8px" title="${degr.map((d) => d.id + ': ' + d.detail).join('\n')}">⚠ ${degr.length}</span>`
          : '';
        const boardLabel = `<span style="color:#94a3b8;margin-left:8px">board: ${boardSource}</span>`;
        const figuresLabel = `<span style="color:${figuresAvailable ? '#4ade80' : '#64748b'};margin-left:8px">figures: ${figuresAvailable ? 'local' : 'fallback'}</span>`;
        statusBar.innerHTML = `<span>${dot} ${label}</span>${demoLabel}${boardLabel}${figuresLabel}${feedIndicators}${degrLabel}<span style="margin-left:auto;color:#555">localhost:${window.location.port || '3000'}</span>`;
      }

      // Mode machine drives demo startup and the status chip. Starting the demo
      // is a reaction to entering demo mode, not an inline side effect.
      appMode.subscribeSelector((state) => state.mode, (mode) => {
        if (mode === 'demo') scheduleDemoEvents();
        updateStatusBar(getWsState());
      });

      onWsStateChange((wsState) => {
        // A running demo is sticky: it keeps driving the room even if the
        // socket drops, so it does not degrade to live/degraded mode.
        if (appMode.is('demo')) {
          updateStatusBar(wsState);
          return;
        }
        if (wsState === 'connected' && hasRealAgents()) {
          appMode.transition('live', 'ws connected with agent data');
        } else if (wsState === 'disconnected') {
          appMode.transition('degraded', 'ws disconnected');
        }
        updateStatusBar(wsState);
      });
      updateStatusBar(getWsState());

      // Status-chip state: board source + figure availability
      // ('live' = cards received over WS; 'demo' = demo driver; 'none' = connected but empty)
      const refreshChip = () => updateStatusBar(getWsState());
      onMessage((msg: ExtensionMessage) => {
        if (msg.type === 'kanbanCards' || msg.type === 'agentCreated') {
          if (!appMode.is('demo') && hasRealAgents()) {
            appMode.transition('live', `${msg.type} received`);
          }
          if (msg.type === 'kanbanCards') {
            boardSource = appMode.is('demo') ? 'demo' : 'live';
            refreshChip();
          }
        }
      });
      onDegradations(() => refreshChip());
      // Figure availability follows the bootstrap report (poll once it's set)
      const chipTimer = setInterval(() => {
        const cache = (window as any).spriteCache;
        const available = !!(cache && cache.hasNitroAsset('hh_human_body'));
        if (available !== figuresAvailable) {
          figuresAvailable = available;
          if (figuresAvailable) refreshChip();
        }
        if (available) clearInterval(chipTimer);
      }, 500);
      // Force demo mode with ?demo in the URL
      const forceDemoMode = new URLSearchParams(window.location.search).has('demo');

      if (forceDemoMode) {
        console.log('[Web] Demo query param detected — starting demo mode immediately');
        appMode.transition('demo', '?demo query param');
      } else {
        // Fallback: if no real agents arrive within 5 seconds, start demo mode
        setTimeout(() => {
          if (!hasRealAgents() && !appMode.is('demo')) {
            console.log('[Web] No real agents detected — starting demo mode');
            appMode.transition('demo', 'no real agents within 5s');
          } else {
            console.log('[Web] Real agents active — demo mode skipped');
          }
        }, 5000);
      }
    }
  } catch (error) {
    console.error('Asset loading failed:', error);
    // Show error in the page
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `<div style="color: #ff6b6b; padding: 2em; font-family: monospace;">
        <h2>Asset loading failed</h2>
        <pre>${error}</pre>
        <p>Make sure you've run <code>npm run build:web</code> first.</p>
      </div>`;
    }
  }
})();
