// src/orchestrationPanelHtml.ts
// HTML/CSS/JS content for the orchestration sidebar control panel.
// Send-only (sidebar → extension host → room webview). All state lives in room.

import * as vscode from 'vscode';
import { FURNITURE_CATALOG, CATEGORY_LABELS, type FurnitureCategory } from './furnitureRegistry.js';

export interface SidebarAssetUris {
  furnitureBaseUri: string;
  manifestUri: string;
}

/** Build furniture <option> groups as HTML string at generation time */
function buildFurnitureOptions(): string {
  const grouped = new Map<FurnitureCategory, typeof FURNITURE_CATALOG>();
  for (const entry of FURNITURE_CATALOG) {
    const list = grouped.get(entry.category) || [];
    list.push(entry);
    grouped.set(entry.category, list);
  }
  let html = '';
  for (const [category, entries] of grouped) {
    const label = CATEGORY_LABELS[category] || category;
    html += `<optgroup label="${label}">`;
    for (const e of entries) {
      html += `<option value="${e.id}">${e.displayName}</option>`;
    }
    html += '</optgroup>';
  }
  return html;
}

/**
 * Generate the full HTML content for the orchestration sidebar panel.
 * Acts as a unified command panel: agents, layout editor, navigation.
 */
export function getOrchestrationPanelHtml(
  _webview: vscode.Webview,
  _extensionUri: vscode.Uri,
  assetUris?: SidebarAssetUris,
): string {
  const furnitureOptions = buildFurnitureOptions();
  const furnitureBaseUri = assetUris?.furnitureBaseUri ?? '';
  const manifestUri = assetUris?.manifestUri ?? '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--vscode-editor-font-family), monospace;
      font-size: 12px;
      background: var(--vscode-sideBar-background, #1e1e2e);
      color: var(--vscode-sideBar-foreground, #cdd6f4);
      overflow-y: auto;
      padding: 8px;
    }

    .panel-title {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 0 6px;
      border-bottom: 1px solid var(--vscode-panel-border, #444);
      margin-bottom: 8px;
      opacity: 0.7;
    }

    .section-group { margin-bottom: 12px; }

    .section-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.5;
      margin-bottom: 4px;
    }

    .action-row {
      display: flex;
      gap: 4px;
      margin-bottom: 4px;
    }

    .cmd-btn {
      flex: 1;
      background: var(--vscode-button-secondaryBackground, #333);
      border: 1px solid var(--vscode-button-secondaryBackground, #444);
      color: var(--vscode-button-secondaryForeground, #ccc);
      font-family: inherit;
      font-size: 11px;
      padding: 6px 8px;
      cursor: pointer;
      text-align: center;
      border-radius: 2px;
    }

    .cmd-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground, #444);
    }

    .cmd-btn.primary {
      background: var(--vscode-button-background, #0078d4);
      color: var(--vscode-button-foreground, #fff);
      border-color: var(--vscode-button-background, #0078d4);
    }

    .cmd-btn.primary:hover {
      background: var(--vscode-button-hoverBackground, #106ebe);
    }

    .cmd-btn.danger {
      border-color: #ff4a4a44;
      color: #ff6b6b;
    }

    .cmd-btn.danger:hover {
      background: #ff4a4a22;
    }

    .cmd-btn.active {
      background: #0066cc;
      border-color: #0066cc;
      color: #fff;
    }

    .section-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
    }

    .section-tab {
      background: transparent;
      border: 1px solid;
      color: inherit;
      font-family: inherit;
      font-size: 10px;
      padding: 5px 4px;
      cursor: pointer;
      text-align: center;
    }

    .section-tab:hover { filter: brightness(1.3); }
    .section-tab[data-team="planning"]       { border-color: #4a9eff; color: #4a9eff; }
    .section-tab[data-team="core-dev"]       { border-color: #4aff4a; color: #4aff4a; }
    .section-tab[data-team="infrastructure"] { border-color: #ffaa4a; color: #ffaa4a; }
    .section-tab[data-team="support"]        { border-color: #ff4a4a; color: #ff4a4a; }

    .divider {
      border: none;
      border-top: 1px solid var(--vscode-panel-border, #333);
      margin: 8px 0;
    }

    select, input[type="range"] {
      width: 100%;
      margin-bottom: 4px;
      font-family: inherit;
      font-size: 11px;
    }

    select {
      padding: 4px;
      background: var(--vscode-input-background, #2a2a3e);
      color: var(--vscode-input-foreground, #ccc);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 2px;
    }

    .slider-row {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 2px;
      font-size: 10px;
    }

    .slider-row label { min-width: 16px; opacity: 0.6; }
    .slider-row input[type="range"] { flex: 1; margin: 0; }
    .slider-row .val { min-width: 28px; text-align: right; opacity: 0.6; }

    .color-preview {
      width: 100%;
      height: 16px;
      margin-top: 2px;
      margin-bottom: 4px;
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 2px;
    }

    .sub-panel {
      padding: 6px;
      margin-top: 4px;
      background: var(--vscode-input-background, #2a2a3e);
      border-radius: 3px;
    }

    .hidden { display: none; }

    /* Furniture preview canvas */
    #furniture-preview {
      width: 100%;
      height: 80px;
      margin-top: 4px;
      margin-bottom: 4px;
      background: #111;
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 2px;
      image-rendering: pixelated;
    }
  </style>
</head>
<body>
  <div class="panel-title">Habbo Agents</div>

  <!-- Agent commands -->
  <div class="section-group">
    <div class="section-label">Agents</div>
    <div class="action-row">
      <button class="cmd-btn primary" id="btn-spawn">Spawn</button>
      <button class="cmd-btn danger" id="btn-despawn">Despawn Last</button>
    </div>
    <div class="action-row">
      <button class="cmd-btn danger" id="btn-despawn-all">Despawn All</button>
    </div>
  </div>

  <hr class="divider" />

  <!-- Room commands -->
  <div class="section-group">
    <div class="section-label">Room</div>
    <div class="action-row">
      <button class="cmd-btn primary" id="btn-open-room">Open Room</button>
    </div>
    <div class="action-row">
      <button class="cmd-btn" id="btn-toggle-overlay">Toggle HUD</button>
      <button class="cmd-btn" id="btn-auto-follow">Auto-Follow</button>
    </div>
  </div>

  <hr class="divider" />

  <!-- Layout Editor -->
  <div class="section-group">
    <div class="section-label">Layout Editor</div>
    <div class="action-row">
      <button class="cmd-btn mode-btn" data-mode="view">View</button>
      <button class="cmd-btn mode-btn" data-mode="paint">Paint</button>
    </div>
    <div class="action-row">
      <button class="cmd-btn mode-btn" data-mode="color">Color</button>
      <button class="cmd-btn mode-btn" data-mode="furniture">Furniture</button>
    </div>

    <!-- Color picker sub-panel -->
    <div id="color-panel" class="sub-panel hidden">
      <div class="slider-row">
        <label>H</label>
        <input type="range" id="color-h" min="0" max="360" value="200" />
        <span class="val" id="val-h">200</span>
      </div>
      <div class="slider-row">
        <label>S</label>
        <input type="range" id="color-s" min="0" max="100" value="50" />
        <span class="val" id="val-s">50</span>
      </div>
      <div class="slider-row">
        <label>B</label>
        <input type="range" id="color-b" min="0" max="100" value="50" />
        <span class="val" id="val-b">50</span>
      </div>
      <div class="color-preview" id="color-preview"></div>
    </div>

    <!-- Furniture selector sub-panel -->
    <div id="furniture-panel" class="sub-panel hidden">
      <select id="furniture-select">
        ${furnitureOptions}
      </select>
      <div class="action-row">
        <button class="cmd-btn" id="btn-rotate">Rotate (dir: <span id="dir-val">0</span>)</button>
      </div>
      <canvas id="furniture-preview" width="200" height="80"></canvas>
    </div>
  </div>

  <hr class="divider" />

  <!-- Save / Load -->
  <div class="section-group">
    <div class="section-label">Layout File</div>
    <div class="action-row">
      <button class="cmd-btn" id="btn-save">Save</button>
      <button class="cmd-btn" id="btn-load">Load</button>
    </div>
  </div>

  <hr class="divider" />

  <!-- Sounds -->
  <div class="section-group">
    <div class="section-label">Sounds</div>
    <div class="action-row">
      <select id="sound-select">
        <option value="notification">Notification</option>
      </select>
    </div>
    <div class="action-row">
      <button class="cmd-btn" id="btn-play-sound">Play Sound</button>
    </div>
  </div>

  <hr class="divider" />

  <!-- Section navigation -->
  <div class="section-group">
    <div class="section-label">Jump to Section</div>
    <div class="section-tabs">
      <button class="section-tab" data-team="planning">Planning</button>
      <button class="section-tab" data-team="core-dev">Core Dev</button>
      <button class="section-tab" data-team="infrastructure">Infra</button>
      <button class="section-tab" data-team="support">Support</button>
    </div>
  </div>

  <hr class="divider" />

  <!-- Dev tools -->
  <div class="section-group">
    <div class="section-label">Dev</div>
    <div class="action-row">
      <button class="cmd-btn" id="btn-capture">Capture</button>
      <button class="cmd-btn" id="btn-debug-grid">Debug Grid</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const FURNITURE_BASE = '${furnitureBaseUri}';
    const MANIFEST_URI = '${manifestUri}';

    function cmd(type, data) {
      vscode.postMessage({ type, ...data });
    }

    // --- Agent commands ---
    document.getElementById('btn-spawn').addEventListener('click', () => cmd('debugSpawn'));
    document.getElementById('btn-despawn').addEventListener('click', () => cmd('debugDespawn'));
    document.getElementById('btn-despawn-all').addEventListener('click', () => cmd('debugDespawnAll'));

    // --- Room commands ---
    document.getElementById('btn-open-room').addEventListener('click', () => cmd('openRoom'));
    document.getElementById('btn-toggle-overlay').addEventListener('click', () => cmd('toggleOverlay'));
    document.getElementById('btn-auto-follow').addEventListener('click', () => cmd('autoFollow'));

    // --- Section jump ---
    document.querySelectorAll('.section-tab').forEach(btn => {
      btn.addEventListener('click', () => cmd('jumpToSection', { team: btn.dataset.team }));
    });

    // --- Layout editor mode ---
    let currentMode = 'view';
    const modeButtons = document.querySelectorAll('.mode-btn');
    const colorPanel = document.getElementById('color-panel');
    const furniturePanel = document.getElementById('furniture-panel');

    function setMode(mode) {
      currentMode = mode;
      modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
      colorPanel.classList.toggle('hidden', mode !== 'color');
      furniturePanel.classList.toggle('hidden', mode !== 'furniture');
      cmd('editorMode', { mode });
    }

    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
    setMode('view');

    // --- Color picker ---
    const hSlider = document.getElementById('color-h');
    const sSlider = document.getElementById('color-s');
    const bSlider = document.getElementById('color-b');
    const hVal = document.getElementById('val-h');
    const sVal = document.getElementById('val-s');
    const bVal = document.getElementById('val-b');
    const preview = document.getElementById('color-preview');

    function sendColor() {
      const h = parseInt(hSlider.value);
      const s = parseInt(sSlider.value);
      const b = parseInt(bSlider.value);
      hVal.textContent = h;
      sVal.textContent = s;
      bVal.textContent = b;
      preview.style.backgroundColor = 'hsl(' + h + ',' + s + '%,' + b + '%)';
      cmd('editorColor', { h, s, b });
    }

    hSlider.addEventListener('input', sendColor);
    sSlider.addEventListener('input', sendColor);
    bSlider.addEventListener('input', sendColor);
    sendColor();

    // --- Furniture selector + preview ---
    const furnitureSelect = document.getElementById('furniture-select');
    const previewCanvas = document.getElementById('furniture-preview');
    const previewCtx = previewCanvas.getContext('2d');

    // Cache loaded furniture data: { img: Image, json: object }
    const furnitureCache = new Map();
    let currentDir = 0;

    // Get supported directions for current furniture from its loaded JSON
    function getSupportedDirs() {
      const asset = furnitureCache.get(furnitureSelect.value);
      if (asset?.data?.logic?.directions?.length > 0) {
        return asset.data.logic.directions;
      }
      return [0, 2, 4, 6];
    }

    furnitureSelect.addEventListener('change', () => {
      cmd('editorFurniture', { furniture: furnitureSelect.value });
      currentDir = 0;
      document.getElementById('dir-val').textContent = '0';
      renderFurniturePreview();
    });

    document.getElementById('btn-rotate').addEventListener('click', () => {
      cmd('editorRotate');
      // Cycle through supported directions only (same as rotateFurniture in room)
      const dirs = getSupportedDirs();
      const idx = dirs.indexOf(currentDir);
      currentDir = idx < 0 ? dirs[0] : dirs[(idx + 1) % dirs.length];
      document.getElementById('dir-val').textContent = currentDir;
      renderFurniturePreview();
    });

    async function loadFurnitureAsset(name) {
      if (furnitureCache.has(name)) return furnitureCache.get(name);
      if (!FURNITURE_BASE) return null;

      try {
        const jsonUrl = FURNITURE_BASE + '/' + name + '.json';
        const pngUrl = FURNITURE_BASE + '/' + name + '.png';

        const res = await fetch(jsonUrl);
        if (!res.ok) return null;
        const data = await res.json();

        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = pngUrl;
        });

        const entry = { img, data };
        furnitureCache.set(name, entry);
        return entry;
      } catch (e) {
        console.warn('Failed to load furniture preview:', name, e);
        return null;
      }
    }

    async function renderFurniturePreview() {
      const name = furnitureSelect.value;
      const ctx = previewCtx;
      const cw = previewCanvas.width;
      const ch = previewCanvas.height;

      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, cw, ch);

      const asset = await loadFurnitureAsset(name);
      if (!asset) {
        ctx.fillStyle = '#444';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('No preview', cw / 2, ch / 2 + 4);
        return;
      }

      const { img, data } = asset;
      const layerCount = data.visualization?.layerCount || 1;
      const layers = 'abcdefghijklmnop'.slice(0, layerCount).split('');
      const directions = data.logic?.directions || [0];

      // Match room renderer exactly: getBaseDirection + shouldMirrorSprite
      // getBaseDirection: 0→0, 2→2, 4→2, 6→0 (always, regardless of supported dirs)
      // shouldMirrorSprite: true for dir 4 and 6
      const baseMap = { 0: 0, 2: 2, 4: 2, 6: 0 };
      const dir = baseMap[currentDir] !== undefined ? baseMap[currentDir] : 0;
      const shouldFlip = (currentDir === 4 || currentDir === 6);

      // Resolve all layer frames using room renderer logic:
      // - Frame key: {name}_64_{layer}_{baseDir}_{frame}
      // - Follow source chain: use ORIGINAL asset offsets (not source's)
      // - Flip = shouldFlip XOR frame.flipH
      // - Position: dx = offsetX (no flip), dx = -offsetX - w (flip); dy = offsetY
      const framesToDraw = [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      for (const layer of layers) {
        const frameKey = name + '_64_' + layer + '_' + dir + '_0';

        // Look up asset entry for offsets
        const assetEntry = data.assets?.[frameKey];
        let ox = assetEntry ? assetEntry.x : 0;
        let oy = assetEntry ? assetEntry.y : 0;
        let assetFlipH = assetEntry ? (assetEntry.flipH || false) : false;

        // Look up sprite frame — follow source if needed (same as resolveNitroFrame)
        let spriteFrame = data.spritesheet?.frames[frameKey];
        if (!spriteFrame && assetEntry?.source) {
          spriteFrame = data.spritesheet?.frames[assetEntry.source];
          // Keep ORIGINAL asset's offsets (not the source's)
        }
        if (!spriteFrame) continue;

        const f = spriteFrame.frame;

        // Compute actual draw position matching drawNitroFrame:
        // flip = shouldFlip XOR assetFlipH
        const flip = shouldFlip !== assetFlipH;
        let dx, dy;
        dy = oy; // room uses: screenY + TILE_H_HALF + offsetY
        if (flip) {
          dx = -ox - f.w; // room uses: screenX - offsetX - width
        } else {
          dx = ox; // room uses: screenX + offsetX
        }

        framesToDraw.push({ f, dx, dy, flip });

        // Track bounds
        if (dx < minX) minX = dx;
        if (dy < minY) minY = dy;
        if (dx + f.w > maxX) maxX = dx + f.w;
        if (dy + f.h > maxY) maxY = dy + f.h;
      }

      if (framesToDraw.length === 0) {
        ctx.fillStyle = '#444';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Dir ' + currentDir + ' N/A', cw / 2, ch / 2 + 4);
        return;
      }

      // Scale to fit canvas with padding
      const spriteW = maxX - minX;
      const spriteH = maxY - minY;
      const pad = 8;
      const scale = Math.min((cw - pad * 2) / spriteW, (ch - pad * 2) / spriteH, 3);

      ctx.save();
      ctx.imageSmoothingEnabled = false;

      // Center composite in preview
      const cenX = (cw / 2) - ((minX + maxX) / 2) * scale;
      const cenY = (ch / 2) - ((minY + maxY) / 2) * scale;

      for (const { f, dx, dy, flip } of framesToDraw) {
        const px = cenX + dx * scale;
        const py = cenY + dy * scale;

        if (flip) {
          ctx.save();
          ctx.translate(px + f.w * scale, py);
          ctx.scale(-1, 1);
          ctx.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w * scale, f.h * scale);
          ctx.restore();
        } else {
          ctx.drawImage(img, f.x, f.y, f.w, f.h, px, py, f.w * scale, f.h * scale);
        }
      }

      ctx.restore();

      // Direction label
      ctx.fillStyle = '#666';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('dir ' + currentDir + (shouldFlip ? ' (mirror)' : ''), cw - 4, ch - 4);
      ctx.textAlign = 'left';
      ctx.fillText('[' + directions.join(',') + ']', 4, ch - 4);
    }

    // Initial preview
    renderFurniturePreview();

    // --- Save / Load ---
    document.getElementById('btn-save').addEventListener('click', () => cmd('editorSave'));
    document.getElementById('btn-load').addEventListener('click', () => cmd('editorLoad'));

    // --- Sounds ---
    document.getElementById('btn-play-sound').addEventListener('click', () => {
      const sound = document.getElementById('sound-select').value;
      cmd('playSound', { sound });
    });

    // --- Dev tools ---
    document.getElementById('btn-capture').addEventListener('click', () => cmd('devCapture'));
    document.getElementById('btn-debug-grid').addEventListener('click', () => cmd('debugGrid'));
  </script>
</body>
</html>`;
}
