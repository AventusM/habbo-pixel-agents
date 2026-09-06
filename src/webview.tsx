import React from 'react';
import { createRoot } from 'react-dom/client';
import { RoomCanvas } from './RoomCanvas.js';
import { emitMessage, onMessage } from './bus.js';
import { loadAllAssets, type AssetUris } from './assetBootstrap.js';
import type { ExtensionMessage } from './agentTypes.js';
import { SpriteCache } from './isoSpriteCache.js';
import { generateFloorTemplate } from './roomLayoutEngine.js';

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

// Expose log buffer globally for RoomCanvas capture button
(window as any).__devLogBuffer = logBuffer;

// Generate floor template (replaces DEMO_HEIGHTMAP)
let currentTemplate = generateFloorTemplate('small');
let FLOOR_HEIGHTMAP = currentTemplate.heightmap;
(window as any).floorTemplate = currentTemplate;

// Acquire VS Code API immediately (can only be called once per webview)
const vscodeApi = (window as any).acquireVsCodeApi?.();

// Set up extension message forwarding immediately so no messages are missed
if (vscodeApi) {
  window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data;
    if (msg && msg.type) {
      emitMessage(msg);
    }
  });
  (window as any).vscodeApi = vscodeApi;
}

// Initialize sprite cache and load assets BEFORE rendering
const spriteCache = new SpriteCache();

(async () => {
  try {
    const {
      chairPng, chairJson,
      furniturePng, furnitureJson,
      avatarPng, avatarJson,
      pixellabPng, pixellabJson,
      plPlanningPng, plPlanningJson,
      plCoreDevPng, plCoreDevJson,
      plInfrastructurePng, plInfrastructureJson,
      plSupportPng, plSupportJson,
      nitroManifest, nitroFurnitureBase, nitroFigureBase,
    } = (window as any).ASSET_URIS;

    // Shared asset bootstrap (web + extension hosts use the same module)
    const report = await loadAllAssets(spriteCache, {
      chairPng, chairJson,
      furniturePng, furnitureJson,
      avatarPng, avatarJson,
      pixellabPng, pixellabJson,
      teamAtlases: [
        { name: 'pl-planning', png: plPlanningPng, json: plPlanningJson },
        { name: 'pl-core-dev', png: plCoreDevPng, json: plCoreDevJson },
        { name: 'pl-infrastructure', png: plInfrastructurePng, json: plInfrastructureJson },
        { name: 'pl-support', png: plSupportPng, json: plSupportJson },
      ],
      nitroManifest, nitroFurnitureBase, nitroFigureBase,
    } as AssetUris);
    console.log(`✓ Bootstrap: atlases=${Object.entries(report.atlases).map(([k, v]) => k + ':' + v).join(',')} | figuresAvailable=${report.figuresAvailable}`);

    // Make sprite cache globally available for RoomCanvas
    (window as any).spriteCache = spriteCache;

    // NOW render RoomCanvas after assets are loaded
    const root = document.getElementById('root');
    if (root) {
      console.log('✓ Rendering RoomCanvas with loaded assets');
      const rootElement = createRoot(root);
      rootElement.render(React.createElement(RoomCanvas, { heightmap: FLOOR_HEIGHTMAP }));

      // Listen for template size changes from extension settings
      const unsubscribeTemplate = onMessage((msg: ExtensionMessage) => {
        if (msg && msg.type === 'templateSize' && msg.size) {
          const validSizes = ['small', 'medium', 'large'] as const;
          if (validSizes.includes(msg.size)) {
            currentTemplate = generateFloorTemplate(msg.size as 'small' | 'medium' | 'large');
            FLOOR_HEIGHTMAP = currentTemplate.heightmap;
            (window as any).floorTemplate = currentTemplate;
            rootElement.render(React.createElement(RoomCanvas, { heightmap: FLOOR_HEIGHTMAP }));
            console.log(`Template size changed to: ${msg.size}`);
          }
        }
      });
    }

    // Notify extension that webview is ready (triggers agent discovery)
    if (vscodeApi) {
      vscodeApi.postMessage({ type: 'ready' });
    }
  } catch (error) {
    console.error('Asset loading failed:', error);
  }
})();
