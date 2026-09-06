#!/usr/bin/env node
// scripts/pack-rd-sprites.mjs
// Packs RetroDiffusion character assets into the renderer's spritesheet +
// manifest contract (Texture Packer JSON, pl_* frame keys, 4-frame cycles).
//
// Expected inputs (eval-char pipeline):
//   <dir>/walkidle.png      four_angle_walking_idle sheet, 4x4 cells @48px;
//                           rows = directions [S, E, N, W], cols = 4-frame walk
//                           cycle (frames 0/2 standing, 1/3 stepping)
//   <dir>/rotation-144.png  8_dir_rotation sheet downscaled to 144x144 (3x3 of
//                           48px cells, compass layout, center empty)
//   <dir>/walk-NE|SE|SW|NW.png  advanced-walking sheets, 2x2 cells @48px
//
// Habbo direction mapping (0-7 clockwise from NE):
//   ortho rows: S -> 3, E -> 1, N -> 7, W -> 5
//   rotation compass: NE -> 0, E -> 1, SE -> 2, S -> 3, SW -> 4, W -> 5, NW -> 6, N -> 7
// Frames: pl_rot_{dir} (8), pl_idle_{dir}_{0-3} (32), pl_walk_{dir}_{0-3} (32).
// Diagonal idles are the static rotation pose (4 copies).
//
// Usage: node scripts/pack-rd-sprites.mjs <dir-or-walkidle.png> [--out=name] [--cell=48]

import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const rawArgs = process.argv.slice(2);
function flag(name, fallback) {
  const hit = rawArgs.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}
const inputArg = rawArgs.find(a => !a.startsWith('--'));
const outName = flag('out', 'rd-character');
const CELL = parseInt(flag('cell', '48'), 10);

if (!inputArg) {
  console.error('Usage: node scripts/pack-rd-sprites.mjs <dir-or-walkidle.png> [--out=name] [--cell=48]');
  process.exit(1);
}
const srcDir = inputArg.endsWith('.png') ? path.dirname(inputArg) : inputArg;

function readPng(file) {
  return PNG.sync.read(fs.readFileSync(path.join(srcDir, file)));
}

// Habbo dir -> rotation-sheet cell (col,row) in the 3x3 compass
const ROT_CELL = {
  0: [2, 0], // NE
  1: [2, 1], // E
  2: [2, 2], // SE
  3: [1, 2], // S
  4: [0, 2], // SW
  5: [0, 1], // W
  6: [0, 0], // NW
  7: [1, 0], // N
};
// ortho sheet rows -> habbo dirs
const ROW_DIRS = [3, 1, 7, 5]; // S, E, N, W
const rowToDir = new Map(ROW_DIRS.map((d, row) => [row, d]));
// diagonal dirs animated from their own sheets
const DIAG_DIRS = [0, 2, 4, 6];
const WALK_FRAMES = 4;
const IDLE_SOURCES = [0, 2, 0, 2];

// Build the frame plan: { key, png, sx, sy }
const plan = [];
const ortho = readPng('walkidle.png');
const rot = readPng('rotation-144.png');
const diagSheets = new Map(DIAG_DIRS.map(d => [d, readPng(`walk-${['NE', 'SE', 'SW', 'NW'][DIAG_DIRS.indexOf(d)]}.png`)]));

for (let dir = 0; dir < 8; dir++) {
  // rot: from the rotation compass
  const [rc, rr] = ROT_CELL[dir];
  plan.push({ key: `pl_rot_${dir}`, png: rot, sx: rc * CELL, sy: rr * CELL });

  // idle: ortho dirs get the standing-pose cycle; diagonals get the static pose
  const orthoRow = [...rowToDir.entries()].find(([, d]) => d === dir);
  if (orthoRow) {
    for (let f = 0; f < 4; f++) {
      plan.push({ key: `pl_idle_${dir}_${f}`, png: ortho, sx: IDLE_SOURCES[f] * CELL, sy: orthoRow[0] * CELL });
    }
  } else {
    const [rc2, rr2] = ROT_CELL[dir];
    for (let f = 0; f < 4; f++) {
      plan.push({ key: `pl_idle_${dir}_${f}`, png: rot, sx: rc2 * CELL, sy: rr2 * CELL });
    }
  }

  // walk: ortho dirs from the four_angle rows; diagonals from their sheets
  if (orthoRow) {
    for (let f = 0; f < WALK_FRAMES; f++) {
      plan.push({ key: `pl_walk_${dir}_${f}`, png: ortho, sx: f * CELL, sy: orthoRow[0] * CELL });
    }
  } else {
    const sheet = diagSheets.get(dir);
    for (let f = 0; f < WALK_FRAMES; f++) {
      const col = f % 2;
      const row = Math.floor(f / 2);
      plan.push({ key: `pl_walk_${dir}_${f}`, png: sheet, sx: col * CELL, sy: row * CELL });
    }
  }
}

// Validate sheet dimensions
function expectDim(png, w, h, name) {
  if (png.width !== w || png.height !== h) {
    console.error(`${name} is ${png.width}x${png.height}, expected ${w}x${h}`);
    process.exit(1);
  }
}
expectDim(ortho, 4 * CELL, 4 * CELL, 'walkidle.png');
expectDim(rot, 3 * CELL, 3 * CELL, 'rotation-144.png');
for (const [d, sheet] of diagSheets) expectDim(sheet, 2 * CELL, 2 * CELL, `walk-${['NE', 'SE', 'SW', 'NW'][DIAG_DIRS.indexOf(d)]}.png`);

// Pack into an atlas (8 columns)
const ATLAS_COLS = 8;
const atlasRows = Math.ceil(plan.length / ATLAS_COLS);
const atlasW = ATLAS_COLS * CELL;
const atlasH = atlasRows * CELL;
const atlas = new PNG({ width: atlasW, height: atlasH });

const frames = {};
plan.forEach((entry, i) => {
  const ax = (i % ATLAS_COLS) * CELL;
  const ay = Math.floor(i / ATLAS_COLS) * CELL;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const si = ((entry.sy + y) * entry.png.width + (entry.sx + x)) * 4;
      const di = ((ay + y) * atlas.width + (ax + x)) * 4;
      atlas.data[di] = entry.png.data[si];
      atlas.data[di + 1] = entry.png.data[si + 1];
      atlas.data[di + 2] = entry.png.data[si + 2];
      atlas.data[di + 3] = entry.png.data[si + 3];
    }
  }
  frames[entry.key] = {
    frame: { x: ax, y: ay, w: CELL, h: CELL },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: CELL, h: CELL },
    sourceSize: { w: CELL, h: CELL },
  };
});

const outDir = path.resolve('assets/pixellab');
fs.mkdirSync(outDir, { recursive: true });
const pngPath = path.join(outDir, `${outName}.png`);
const jsonPath = path.join(outDir, `${outName}.json`);
fs.writeFileSync(pngPath, PNG.sync.write(atlas));
const manifest = {
  frames,
  meta: { image: `${outName}.png`, format: 'RGBA8888', size: { w: atlasW, h: atlasH } },
};
fs.writeFileSync(jsonPath, JSON.stringify(manifest));

const counts = {
  rot: Object.keys(frames).filter(k => k.includes('_rot_')).length,
  idle: Object.keys(frames).filter(k => k.includes('_idle_')).length,
  walk: Object.keys(frames).filter(k => k.includes('_walk_')).length,
};
console.log(`Packed ${outName}: ${plan.length} frames (rot=${counts.rot} idle=${counts.idle} walk=${counts.walk})`);
console.log(`Atlas ${atlasW}x${atlasH} (cell ${CELL}) -> ${pngPath}`);
console.log(`Manifest -> ${jsonPath}`);
