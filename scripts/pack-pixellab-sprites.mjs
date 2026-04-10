#!/usr/bin/env node
// scripts/pack-pixellab-sprites.mjs
// Packs individual PixelLab character PNGs into a single spritesheet + JSON manifest
// Usage: node scripts/pack-pixellab-sprites.mjs <extracted-zip-dir> <output-name> [--frame-size=N]
// Example: node scripts/pack-pixellab-sprites.mjs /tmp/beanie-hoodie-guy beanie-hoodie-guy
// Example: node scripts/pack-pixellab-sprites.mjs /tmp/habbo_inspiration_new habbo-inspiration-new --frame-size=104

import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

// Parse args — allow flags anywhere after the positional args
const rawArgs = process.argv.slice(2);
const flagArgs = rawArgs.filter(a => a.startsWith('--'));
const posArgs  = rawArgs.filter(a => !a.startsWith('--'));

const inputDir   = posArgs[0];
const outputName = posArgs[1] || 'pixellab-character';
const outputDir  = path.resolve('assets/pixellab');

// --frame-size=N  (default 48 to preserve existing behaviour)
const frameSizeArg = flagArgs.find(a => a.startsWith('--frame-size='));
const CELL_SIZE = frameSizeArg ? parseInt(frameSizeArg.split('=')[1], 10) : 48;

if (!inputDir) {
  console.error('Usage: node scripts/pack-pixellab-sprites.mjs <extracted-zip-dir> [output-name] [--frame-size=N]');
  process.exit(1);
}

/**
 * Normalise a PixelLab animation directory name to a lowercase-hyphen key
 * that can be looked up in ANIM_MAP.
 *
 * PixelLab generates dirs with hashes and varying capitalisation, e.g.:
 *   Breathing_Idle-98af97b4  →  breathing-idle
 *   Walking-e4b169a3         →  walking
 *   running-6-frames         →  running-6-frames  (unchanged)
 */
function normaliseAnimName(raw) {
  // Strip trailing -[hex hash] (8 hex chars)
  const withoutHash = raw.replace(/-[0-9a-f]{8}$/, '');
  // Lowercase and replace underscores with hyphens
  return withoutHash.toLowerCase().replace(/_/g, '-');
}

// PixelLab direction → Habbo direction (0-7 clockwise from NE)
const PIXELLAB_TO_HABBO = {
  'north-east': 0,
  'east': 1,
  'south-east': 2,
  'south': 3,
  'south-west': 4,
  'west': 5,
  'north-west': 6,
  'north': 7,
};

// Mirror pairs: east-side directions can be mirrored from west-side
const MIRROR_MAP = {
  'east': 'west',
  'south-east': 'south-west',
  'north-east': 'north-west',
};

// Animation name mapping: PixelLab name → our internal name
const ANIM_MAP = {
  'breathing-idle': 'idle',
  'walking': 'walk',
  'running-6-frames': 'run',
};

const ALL_DIRECTIONS = [
  'south', 'south-west', 'west', 'north-west',
  'north', 'north-east', 'east', 'south-east',
];

function readPng(filePath) {
  const data = fs.readFileSync(filePath);
  return PNG.sync.read(data);
}

function mirrorPng(png) {
  const mirrored = new PNG({ width: png.width, height: png.height });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const srcIdx = (y * png.width + x) * 4;
      const dstIdx = (y * png.width + (png.width - 1 - x)) * 4;
      mirrored.data[dstIdx] = png.data[srcIdx];
      mirrored.data[dstIdx + 1] = png.data[srcIdx + 1];
      mirrored.data[dstIdx + 2] = png.data[srcIdx + 2];
      mirrored.data[dstIdx + 3] = png.data[srcIdx + 3];
    }
  }
  return mirrored;
}

// Collect all frames
const frames = []; // { key, png, flipH }

// 1. Load rotation (idle static) frames for all 8 directions
const rotationsDir = path.join(inputDir, 'rotations');
for (const dir of ALL_DIRECTIONS) {
  const filePath = path.join(rotationsDir, `${dir}.png`);
  if (fs.existsSync(filePath)) {
    const png = readPng(filePath);
    const habboDir = PIXELLAB_TO_HABBO[dir];
    frames.push({ key: `pl_rot_${habboDir}`, png, flipH: false });
  }
}

// For missing rotation directions, try mirroring
for (const [mirrorDir, sourceDir] of Object.entries(MIRROR_MAP)) {
  const habboDir = PIXELLAB_TO_HABBO[mirrorDir];
  if (!frames.find(f => f.key === `pl_rot_${habboDir}`)) {
    const sourcePath = path.join(rotationsDir, `${sourceDir}.png`);
    if (fs.existsSync(sourcePath)) {
      const png = readPng(sourcePath);
      frames.push({ key: `pl_rot_${habboDir}`, png: mirrorPng(png), flipH: false });
    }
  }
}

// 2. Load animation frames
const animsDir = path.join(inputDir, 'animations');
if (fs.existsSync(animsDir)) {
  for (const plAnimName of fs.readdirSync(animsDir)) {
    const normName = normaliseAnimName(plAnimName);
    const animName = ANIM_MAP[normName] || normName;
    const animDir = path.join(animsDir, plAnimName);
    if (!fs.statSync(animDir).isDirectory()) continue;

    // Load available directions
    const availableDirs = new Set();
    for (const dir of fs.readdirSync(animDir)) {
      const dirPath = path.join(animDir, dir);
      if (!fs.statSync(dirPath).isDirectory()) continue;
      availableDirs.add(dir);

      const frameFiles = fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.png'))
        .sort();

      for (let i = 0; i < frameFiles.length; i++) {
        const png = readPng(path.join(dirPath, frameFiles[i]));
        const habboDir = PIXELLAB_TO_HABBO[dir];
        frames.push({ key: `pl_${animName}_${habboDir}_${i}`, png, flipH: false });
      }
    }

    // Mirror missing east-side directions from west-side
    for (const [mirrorDir, sourceDir] of Object.entries(MIRROR_MAP)) {
      if (availableDirs.has(mirrorDir)) continue;
      if (!availableDirs.has(sourceDir)) continue;

      const sourceDirPath = path.join(animDir, sourceDir);
      const frameFiles = fs.readdirSync(sourceDirPath)
        .filter(f => f.endsWith('.png'))
        .sort();

      const mirrorHabbo = PIXELLAB_TO_HABBO[mirrorDir];
      for (let i = 0; i < frameFiles.length; i++) {
        const png = readPng(path.join(sourceDirPath, frameFiles[i]));
        frames.push({ key: `pl_${animName}_${mirrorHabbo}_${i}`, png: mirrorPng(png), flipH: false });
      }
      availableDirs.add(mirrorDir);
    }

    // For any still-missing directions, copy from nearest available direction
    for (const dir of ALL_DIRECTIONS) {
      const habboDir = PIXELLAB_TO_HABBO[dir];
      if (frames.find(f => f.key === `pl_${animName}_${habboDir}_0`)) continue;

      // Find any available direction's frame count to replicate
      let sourceDir = null;
      for (const avail of availableDirs) {
        sourceDir = avail;
        break;
      }
      if (!sourceDir) continue;

      // Use rotation image as fallback (single frame repeated)
      const rotFrame = frames.find(f => f.key === `pl_rot_${habboDir}`);
      if (rotFrame) {
        // Count frames from source direction
        const sourceHabbo = PIXELLAB_TO_HABBO[sourceDir];
        let frameCount = 0;
        while (frames.find(f => f.key === `pl_${animName}_${sourceHabbo}_${frameCount}`)) {
          frameCount++;
        }
        for (let i = 0; i < frameCount; i++) {
          frames.push({ key: `pl_${animName}_${habboDir}_${i}`, png: rotFrame.png, flipH: false });
        }
      }
    }
  }
}

// 3. Pack into spritesheet
// CELL_SIZE is set from --frame-size arg at top of file (default 48)
const cols = Math.ceil(Math.sqrt(frames.length));
const rows = Math.ceil(frames.length / cols);
const sheetW = cols * CELL_SIZE;
const sheetH = rows * CELL_SIZE;

console.log(`Packing ${frames.length} frames into ${sheetW}x${sheetH} spritesheet (${cols}x${rows} grid)`);

const sheet = new PNG({ width: sheetW, height: sheetH });

const manifest = {
  frames: {},
  meta: {
    image: `${outputName}.png`,
    format: 'RGBA8888',
    size: { w: sheetW, h: sheetH },
  },
};

for (let i = 0; i < frames.length; i++) {
  const { key, png } = frames[i];
  const col = i % cols;
  const row = Math.floor(i / cols);
  const x = col * CELL_SIZE;
  const y = row * CELL_SIZE;

  // Blit PNG onto sheet
  for (let py = 0; py < png.height && py < CELL_SIZE; py++) {
    for (let px = 0; px < png.width && px < CELL_SIZE; px++) {
      const srcIdx = (py * png.width + px) * 4;
      const dstIdx = ((y + py) * sheetW + (x + px)) * 4;
      sheet.data[dstIdx] = png.data[srcIdx];
      sheet.data[dstIdx + 1] = png.data[srcIdx + 1];
      sheet.data[dstIdx + 2] = png.data[srcIdx + 2];
      sheet.data[dstIdx + 3] = png.data[srcIdx + 3];
    }
  }

  manifest.frames[key] = {
    frame: { x, y, w: CELL_SIZE, h: CELL_SIZE },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: CELL_SIZE, h: CELL_SIZE },
    sourceSize: { w: CELL_SIZE, h: CELL_SIZE },
  };
}

// Write output
fs.mkdirSync(outputDir, { recursive: true });

const pngPath = path.join(outputDir, `${outputName}.png`);
fs.writeFileSync(pngPath, PNG.sync.write(sheet));
console.log(`✓ Wrote ${pngPath}`);

const jsonPath = path.join(outputDir, `${outputName}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(manifest, null, 2));
console.log(`✓ Wrote ${jsonPath}`);

// Print summary
const animKeys = new Set(Object.keys(manifest.frames).map(k => {
  const parts = k.split('_');
  return parts[1]; // animation name
}));
console.log(`\nAnimations: ${[...animKeys].join(', ')}`);
console.log(`Frame keys sample: ${Object.keys(manifest.frames).slice(0, 10).join(', ')}`);