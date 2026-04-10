/**
 * Standalone web entry point for the Habbo room renderer.
 *
 * Mirrors src/webview.tsx but replaces VS Code webview URI resolution
 * with relative /assets/ paths, and skips acquireVsCodeApi entirely.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RoomCanvas } from '../RoomCanvas.js';
import { SpriteCache } from '../isoSpriteCache.js';
import { generateFloorTemplate } from '../roomLayoutEngine.js';
import { scheduleDemoEvents } from './demoData.js';
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

// Asset URIs using relative paths served by the local dev server
const ASSET_BASE = '/assets';
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
  pixellabPng: `${ASSET_BASE}/pixellab/habbo-inspiration-new.png`,
  pixellabJson: `${ASSET_BASE}/pixellab/habbo-inspiration-new.json`,
  plPlanningPng: `${ASSET_BASE}/pixellab/habbo-inspiration-new.png`,
  plPlanningJson: `${ASSET_BASE}/pixellab/habbo-inspiration-new.json`,
  plCoreDevPng: `${ASSET_BASE}/pixellab/habbo-inspiration-new.png`,
  plCoreDevJson: `${ASSET_BASE}/pixellab/habbo-inspiration-new.json`,
  plInfrastructurePng: `${ASSET_BASE}/pixellab/habbo-inspiration-new.png`,
  plInfrastructureJson: `${ASSET_BASE}/pixellab/habbo-inspiration-new.json`,
  plSupportPng: `${ASSET_BASE}/pixellab/habbo-inspiration-new.png`,
  plSupportJson: `${ASSET_BASE}/pixellab/habbo-inspiration-new.json`,
};

// Initialize sprite cache and load assets before rendering
const spriteCache = new SpriteCache();

(async () => {
  try {
    const uris = (window as any).ASSET_URIS;

    // Load core atlases
    console.log('Loading chair atlas...');
    await spriteCache.loadAtlas('chair', uris.chairPng, uris.chairJson);
    console.log('✓ Chair atlas loaded');

    console.log('Loading furniture atlas...');
    await spriteCache.loadAtlas('furniture', uris.furniturePng, uris.furnitureJson);
    console.log('✓ Furniture atlas loaded');

    console.log('Loading avatar atlas...');
    await spriteCache.loadAtlas('avatar', uris.avatarPng, uris.avatarJson);
    console.log('✓ Avatar atlas loaded');

    // Load PixelLab character atlas (default fallback)
    if (uris.pixellabPng && uris.pixellabJson) {
      try {
        await spriteCache.loadAtlas('pixellab', uris.pixellabPng, uris.pixellabJson);
        console.log('✓ PixelLab character atlas loaded');
      } catch (err) {
        console.warn('⚠ Failed to load PixelLab character atlas:', err);
      }
    }

    // Load per-team PixelLab atlases
    const teamAtlases: Array<{ name: string; png: string; json: string }> = [
      { name: 'pl-planning',       png: uris.plPlanningPng,       json: uris.plPlanningJson },
      { name: 'pl-core-dev',       png: uris.plCoreDevPng,        json: uris.plCoreDevJson },
      { name: 'pl-infrastructure', png: uris.plInfrastructurePng, json: uris.plInfrastructureJson },
      { name: 'pl-support',        png: uris.plSupportPng,        json: uris.plSupportJson },
    ];
    for (const atlas of teamAtlases) {
      if (atlas.png && atlas.json) {
        try {
          await spriteCache.loadAtlas(atlas.name, atlas.png, atlas.json);
          console.log(`✓ Team atlas loaded: ${atlas.name}`);
        } catch (err) {
          console.warn(`⚠ Failed to load team atlas ${atlas.name}:`, err);
        }
      }
    }

    // Load Nitro per-item furniture assets
    if (uris.nitroManifest) {
      try {
        const manifestRes = await fetch(uris.nitroManifest);
        if (manifestRes.ok) {
          const manifest = await manifestRes.json();
          console.log('Nitro manifest loaded:', manifest);

          if (manifest.furniture && uris.nitroFurnitureBase) {
            for (const name of manifest.furniture) {
              try {
                await spriteCache.loadNitroAsset(
                  name,
                  `${uris.nitroFurnitureBase}/${name}.png`,
                  `${uris.nitroFurnitureBase}/${name}.json`
                );
                console.log(`✓ Loaded Nitro furniture: ${name}`);
              } catch (err) {
                console.warn(`⚠ Failed to load Nitro furniture ${name}:`, err);
              }
            }
          }
        } else {
          console.log('⚠ Nitro manifest not found, using placeholder sprites only');
        }
      } catch (err) {
        console.log('⚠ Nitro assets unavailable, using placeholder sprites:', err);
      }
    }

    // Make sprite cache globally available for RoomCanvas
    (window as any).spriteCache = spriteCache;

    // Render RoomCanvas
    const root = document.getElementById('root');
    if (root) {
      console.log('✓ Rendering RoomCanvas (standalone mode)');
      const rootElement = createRoot(root);
      rootElement.render(React.createElement(RoomCanvas, { heightmap: FLOOR_HEIGHTMAP }));

      // Connect to WebSocket for real agent data
      connectWs();

      // Track feed modes per agent for status bar display
      const agentFeedModes = new Map<string, { mode: string; reason: string }>();

      // Listen for agentFeedMode messages
      window.addEventListener('extensionMessage', ((e: CustomEvent) => {
        const msg = e.detail;
        if (msg.type === 'agentFeedMode') {
          agentFeedModes.set(msg.agentId, { mode: msg.feedMode, reason: msg.feedReason });
          updateStatusBar(getWsState());
        } else if (msg.type === 'agentRemoved') {
          agentFeedModes.delete(msg.agentId);
          updateStatusBar(getWsState());
        }
      }) as EventListener);

      // Create status bar
      const statusBar = document.createElement('div');
      statusBar.id = 'status-bar';
      statusBar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:20px;background:rgba(26,26,46,0.9);display:flex;align-items:center;padding:0 8px;font:6px "Press Start 2P",monospace;color:#888;z-index:100;gap:12px;';
      document.body.appendChild(statusBar);

      let isDemoMode = false;

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

      function updateStatusBar(wsState: WsState) {
        const dot = wsState === 'connected' ? '🟢' : wsState === 'connecting' ? '🟡' : '🔴';
        const label = wsState === 'connected' ? 'Connected' : wsState === 'connecting' ? 'Connecting...' : 'Disconnected';
        const demoLabel = isDemoMode ? '<span style="color:#f59e0b;margin-left:8px">● DEMO MODE</span>' : '';
        const feedIndicators = buildFeedModeIndicators();
        statusBar.innerHTML = `<span>${dot} ${label}</span>${demoLabel}${feedIndicators}<span style="margin-left:auto;color:#555">localhost:${window.location.port || '3000'}</span>`;
      }

      onWsStateChange(updateStatusBar);
      updateStatusBar(getWsState());

      // Fallback: if no real agents arrive within 5 seconds, start demo mode
      setTimeout(() => {
        if (!hasRealAgents()) {
          console.log('[Web] No real agents detected — starting demo mode');
          isDemoMode = true;
          updateStatusBar(getWsState());
          scheduleDemoEvents();
        } else {
          console.log('[Web] Real agents active — demo mode skipped');
        }
      }, 5000);
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
