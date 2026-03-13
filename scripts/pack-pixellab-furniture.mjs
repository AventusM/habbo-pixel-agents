#!/usr/bin/env node
// scripts/pack-pixellab-furniture.mjs
// Converts a PixelLab furniture PNG into a Nitro-compatible spritesheet + JSON
// that loadNitroAsset() can consume directly.
//
// Usage: node scripts/pack-pixellab-furniture.mjs <input-png> <furniture-id> [options]
// Example: node scripts/pack-pixellab-furniture.mjs assets/pixellab/furniture/oil_lamp.png hc_lmp
//          node scripts/pack-pixellab-furniture.mjs assets/pixellab/furniture/oil_lamp.png hc_lmp --bottom-offset=5
//
// Options:
//   --bottom-offset=N   Pixels below tile center for sprite bottom (default: 9)
//                        Floor-standing items: 5-11. Wall items: negative.
//   --dimensions=WxHxD  Tile footprint (default: 1x1x1)
//   --directions=N,...   Supported directions (default: 0)
//   --no-shadow          Skip shadow diamond generation
//   --no-icon            Skip icon generation
//   --dry-run            Print what would be written without writing

import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

// --- Argument parsing ---

const args = process.argv.slice(2);
const flags = {};
const positional = [];

for (const arg of args) {
  if (arg.startsWith('--')) {
    const [key, val] = arg.slice(2).split('=');
    flags[key] = val ?? true;
  } else {
    positional.push(arg);
  }
}

const inputPath = positional[0];
const furnitureId = positional[1];

if (!inputPath || !furnitureId) {
  console.error('Usage: node scripts/pack-pixellab-furniture.mjs <input-png> <furniture-id> [options]');
  console.error('');
  console.error('Arguments:');
  console.error('  input-png      Path to PixelLab source PNG (e.g. assets/pixellab/furniture/oil_lamp.png)');
  console.error('  furniture-id   Nitro asset name to replace (e.g. hc_lmp)');
  console.error('');
  console.error('Options:');
  console.error('  --bottom-offset=N   Pixels below tile center for bottom edge (default: 9)');
  console.error('  --dimensions=WxHxD  Tile footprint width x height x depth (default: 1x1x1)');
  console.error('  --directions=N,...  Comma-separated Habbo directions (default: 0)');
  console.error('  --no-shadow         Skip shadow diamond');
  console.error('  --no-icon           Skip icon');
  console.error('  --dry-run           Preview without writing files');
  process.exit(1);
}

const bottomOffset = Number(flags['bottom-offset'] ?? 9);
const dimParts = (flags['dimensions'] ?? '1x1x1').split('x').map(Number);
const dimensions = [dimParts[0] || 1, dimParts[1] || 1, dimParts[2] || 1];
const directions = (flags['directions'] ?? '0').split(',').map(Number);
const skipShadow = flags['no-shadow'] === true;
const skipIcon = flags['no-icon'] === true;
const dryRun = flags['dry-run'] === true;

const outputDir = path.resolve('assets/habbo/furniture');

// --- Read input PNG ---

if (!fs.existsSync(inputPath)) {
  console.error(`✗ Input file not found: ${inputPath}`);
  process.exit(1);
}

const inputData = fs.readFileSync(inputPath);
const srcPng = PNG.sync.read(inputData);
const srcW = srcPng.width;
const srcH = srcPng.height;

console.log(`Source: ${inputPath} (${srcW}×${srcH})`);
console.log(`Target: ${furnitureId}`);
console.log(`Bottom offset: ${bottomOffset}, Dimensions: ${dimensions.join('×')}, Directions: [${directions}]`);

// --- Generate shadow diamond ---

let shadowPng = null;
const SHADOW_W = 35;
const SHADOW_H = 9;

if (!skipShadow) {
  shadowPng = new PNG({ width: SHADOW_W, height: SHADOW_H });

  // Draw isometric diamond with semi-transparent black
  const cx = Math.floor(SHADOW_W / 2);
  const cy = Math.floor(SHADOW_H / 2);

  for (let y = 0; y < SHADOW_H; y++) {
    for (let x = 0; x < SHADOW_W; x++) {
      // Point-in-diamond test using Manhattan distance in isometric space
      const dx = Math.abs(x - cx) / cx;
      const dy = Math.abs(y - cy) / cy;
      if (dx + dy <= 1.0) {
        const idx = (y * SHADOW_W + x) * 4;
        shadowPng.data[idx] = 0;      // R
        shadowPng.data[idx + 1] = 0;  // G
        shadowPng.data[idx + 2] = 0;  // B
        shadowPng.data[idx + 3] = 60; // A
      }
    }
  }
}

// --- Generate icon (scaled-down version) ---

let iconPng = null;
const ICON_W = 13;
const ICON_H = 30;

if (!skipIcon) {
  iconPng = new PNG({ width: ICON_W, height: ICON_H });

  // Nearest-neighbor downscale
  for (let y = 0; y < ICON_H; y++) {
    for (let x = 0; x < ICON_W; x++) {
      const sx = Math.floor(x * srcW / ICON_W);
      const sy = Math.floor(y * srcH / ICON_H);
      const srcIdx = (sy * srcW + sx) * 4;
      const dstIdx = (y * ICON_W + x) * 4;
      iconPng.data[dstIdx] = srcPng.data[srcIdx];
      iconPng.data[dstIdx + 1] = srcPng.data[srcIdx + 1];
      iconPng.data[dstIdx + 2] = srcPng.data[srcIdx + 2];
      iconPng.data[dstIdx + 3] = srcPng.data[srcIdx + 3];
    }
  }
}

// --- Pack spritesheet ---
// Layout: shadow (top) → icon → main sprite (bottom)

const regions = [];
let currentY = 0;

if (shadowPng) {
  regions.push({ name: 'shadow', png: shadowPng, y: currentY, w: SHADOW_W, h: SHADOW_H });
  currentY += SHADOW_H;
}

if (iconPng) {
  regions.push({ name: 'icon', png: iconPng, y: currentY, w: ICON_W, h: ICON_H });
  currentY += ICON_H;
}

const mainY = currentY;
regions.push({ name: 'main', png: srcPng, y: mainY, w: srcW, h: srcH });
currentY += srcH;

const sheetW = Math.max(srcW, shadowPng ? SHADOW_W : 0, iconPng ? ICON_W : 0);
const sheetH = currentY;

const sheet = new PNG({ width: sheetW, height: sheetH });

// Blit each region onto the sheet
for (const region of regions) {
  const { png, y: regionY, w, h } = region;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4;
      const dstIdx = ((regionY + y) * sheetW + x) * 4;
      sheet.data[dstIdx] = png.data[srcIdx];
      sheet.data[dstIdx + 1] = png.data[srcIdx + 1];
      sheet.data[dstIdx + 2] = png.data[srcIdx + 2];
      sheet.data[dstIdx + 3] = png.data[srcIdx + 3];
    }
  }
}

// --- Calculate offsets ---
// drawNitroFrame: dy = screenY + TILE_H_HALF(16) + offsetY
// For floor-standing items, bottom_y (offsetY + height) should be ~bottomOffset
// So offsetY = bottomOffset - height
// Horizontal: center on tile → offsetX = -width/2

const offsetX = -Math.floor(srcW / 2);
const offsetY = bottomOffset - srcH;

// --- Build Nitro JSON ---

const frames = {};
const assets = {};

// Main sprite frame
frames[`${furnitureId}_64_a_0_0`] = {
  frame: { x: 0, y: mainY, w: srcW, h: srcH },
  rotated: false,
  trimmed: false,
  spriteSourceSize: { x: 0, y: 0, w: srcW, h: srcH },
  sourceSize: { w: srcW, h: srcH },
};
assets[`${furnitureId}_64_a_0_0`] = {
  x: offsetX,
  y: offsetY,
  source: null,
  flipH: false,
};

// Shadow
if (shadowPng) {
  const shadowRegion = regions.find(r => r.name === 'shadow');
  frames[`${furnitureId}_64_sd_0_0`] = {
    frame: { x: 0, y: shadowRegion.y, w: SHADOW_W, h: SHADOW_H },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: SHADOW_W, h: SHADOW_H },
    sourceSize: { w: SHADOW_W, h: SHADOW_H },
  };
  assets[`${furnitureId}_64_sd_0_0`] = {
    x: -Math.floor(SHADOW_W / 2),
    y: 0,
    source: null,
    flipH: false,
  };
}

// Icon
if (iconPng) {
  const iconRegion = regions.find(r => r.name === 'icon');
  frames[`${furnitureId}_icon_a`] = {
    frame: { x: 0, y: iconRegion.y, w: ICON_W, h: ICON_H },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: ICON_W, h: ICON_H },
    sourceSize: { w: ICON_W, h: ICON_H },
  };
  assets[`${furnitureId}_icon_a`] = {
    x: -Math.floor(ICON_W / 2),
    y: -Math.floor(ICON_H / 2),
    source: null,
    flipH: false,
  };
}

const nitroJson = {
  name: furnitureId,
  type: 'furniture',
  spritesheet: {
    frames,
    meta: {
      image: `${furnitureId}.png`,
      format: 'RGBA8888',
      size: { w: sheetW, h: sheetH },
    },
  },
  assets,
  visualization: {
    layerCount: 1,
    directions: Object.fromEntries(directions.map(d => [String(d), {}])),
  },
  logic: {
    dimensions,
    directions,
  },
};

// --- Output ---

if (dryRun) {
  console.log(`\n[dry-run] Would write:`);
  console.log(`  ${outputDir}/${furnitureId}.png (${sheetW}×${sheetH})`);
  console.log(`  ${outputDir}/${furnitureId}.json`);
  console.log(`\nOffset: (${offsetX}, ${offsetY}), bottom_y: ${offsetY + srcH}`);
  console.log(`\nJSON preview:`);
  console.log(JSON.stringify(nitroJson, null, 2));
  process.exit(0);
}

// Back up existing files if present
for (const ext of ['.png', '.json']) {
  const existing = path.join(outputDir, `${furnitureId}${ext}`);
  if (fs.existsSync(existing)) {
    const backup = `${existing}.orig`;
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(existing, backup);
      console.log(`  ⤷ Backed up ${furnitureId}${ext} → ${furnitureId}${ext}.orig`);
    }
  }
}

// Write spritesheet PNG
fs.mkdirSync(outputDir, { recursive: true });
const pngBuffer = PNG.sync.write(sheet);
fs.writeFileSync(path.join(outputDir, `${furnitureId}.png`), pngBuffer);
console.log(`✓ Wrote ${outputDir}/${furnitureId}.png (${sheetW}×${sheetH})`);

// Write Nitro JSON
fs.writeFileSync(
  path.join(outputDir, `${furnitureId}.json`),
  JSON.stringify(nitroJson, null, 2) + '\n',
);
console.log(`✓ Wrote ${outputDir}/${furnitureId}.json`);

console.log(`\nOffset: (${offsetX}, ${offsetY}), bottom_y: ${offsetY + srcH}`);
console.log(`\nDone. Run \`node esbuild.config.mjs\` to copy into dist.`);
