import React from 'react';
import { createRoot } from 'react-dom/client';
import { RoomCanvas } from './RoomCanvas.js';
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
      window.dispatchEvent(new CustomEvent('extensionMessage', { detail: msg }));
    }
  });
  (window as any).vscodeApi = vscodeApi;
}

// Initialize sprite cache and load assets BEFORE rendering
const spriteCache = new SpriteCache();

(async () => {
  try {
    const { chairPng, chairJson, furniturePng, furnitureJson, avatarPng, avatarJson } = (window as any).ASSET_URIS;

    console.log('Loading chair atlas from:', chairPng, chairJson);
    await spriteCache.loadAtlas('chair', chairPng, chairJson);
    console.log('✓ Chair atlas loaded successfully');

    console.log('Loading furniture atlas from:', furniturePng, furnitureJson);
    await spriteCache.loadAtlas('furniture', furniturePng, furnitureJson);
    console.log('✓ Furniture atlas loaded successfully');

    console.log('Loading avatar atlas from:', avatarPng, avatarJson);
    await spriteCache.loadAtlas('avatar', avatarPng, avatarJson);
    console.log('✓ Avatar atlas loaded successfully');

    // Test frame lookup
    const chairFrame = spriteCache.getFrame('chair', 'chair_64_a_0_0');
    if (chairFrame) {
      console.log('✓ Chair frame lookup succeeded:', {
        x: chairFrame.x,
        y: chairFrame.y,
        w: chairFrame.w,
        h: chairFrame.h,
      });
    }

    const deskFrame = spriteCache.getFrame('furniture', 'desk_64_a_0_0');
    if (deskFrame) {
      console.log('✓ Furniture frame lookup succeeded:', {
        name: 'desk_64_a_0_0',
        x: deskFrame.x,
        y: deskFrame.y,
        w: deskFrame.w,
        h: deskFrame.h,
      });
    }

    // Test avatar frame lookup
    const avatarFrame = spriteCache.getFrame('avatar', 'avatar_0_body_0_idle_0');
    if (avatarFrame) {
      console.log('✓ Avatar frame lookup succeeded:', {
        name: 'avatar_0_body_0_idle_0',
        x: avatarFrame.x,
        y: avatarFrame.y,
        w: avatarFrame.w,
        h: avatarFrame.h,
      });
    }

    // Load Nitro per-item assets (real Habbo sprites)
    const { nitroManifest, nitroFurnitureBase, nitroFiguresBase } = (window as any).ASSET_URIS;
    if (nitroManifest) {
      try {
        const manifestRes = await fetch(nitroManifest);
        if (manifestRes.ok) {
          const manifest = await manifestRes.json();
          console.log('Nitro manifest loaded:', manifest);

          // Load furniture items
          if (manifest.furniture && nitroFurnitureBase) {
            for (const name of manifest.furniture) {
              try {
                await spriteCache.loadNitroAsset(
                  name,
                  `${nitroFurnitureBase}/${name}.png`,
                  `${nitroFurnitureBase}/${name}.json`
                );
                console.log(`✓ Loaded Nitro furniture: ${name}`);
              } catch (err) {
                console.warn(`⚠ Failed to load Nitro furniture ${name}:`, err);
              }
            }
          }

          // Load figure items
          if (manifest.figures && nitroFiguresBase) {
            for (const name of manifest.figures) {
              try {
                await spriteCache.loadNitroAsset(
                  name,
                  `${nitroFiguresBase}/${name}.png`,
                  `${nitroFiguresBase}/${name}.json`
                );
                console.log(`✓ Loaded Nitro figure: ${name}`);
              } catch (err) {
                console.warn(`⚠ Failed to load Nitro figure ${name}:`, err);
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

    // NOW render RoomCanvas after assets are loaded
    const root = document.getElementById('root');
    if (root) {
      console.log('✓ Rendering RoomCanvas with loaded assets');
      const rootElement = createRoot(root);
      rootElement.render(React.createElement(RoomCanvas, { heightmap: FLOOR_HEIGHTMAP }));

      // Listen for template size changes from extension settings
      window.addEventListener('extensionMessage', (event: Event) => {
        const msg = (event as CustomEvent).detail;
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
      // Load saved avatar outfits from .habbo-agents/avatars.json
      vscodeApi.postMessage({ type: 'loadAvatars' });
    }
  } catch (error) {
    console.error('Asset loading failed:', error);
  }
})();
