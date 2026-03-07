#!/usr/bin/env node
/**
 * Fix spritesheet frame bleed artifacts.
 *
 * Cortex-assets spritesheets pack frames with no padding, so adjacent frames'
 * pixel content can leak into a frame's bounding box. This script detects
 * disconnected pixel clusters within each frame and zeros out small clusters
 * that are far from the main sprite content.
 *
 * Usage:
 *   node scripts/fix-spritesheet-bleed.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { PNG } from 'pngjs';

const FIGURES_DIR = 'assets/habbo/figures';
const DRY_RUN = process.argv.includes('--dry-run');

// Only remove a cluster if it's < 10% of main component AND gap > 2px from main
const MAX_CLUSTER_RATIO = 0.10;
const MIN_GAP = 3;

function floodFill(grid, w, h, sx, sy, visited) {
  const comp = [];
  const stack = [[sx, sy]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    if (visited[cy * w + cx] || !grid[cy * w + cx]) continue;
    visited[cy * w + cx] = true;
    comp.push([cx, cy]);
    stack.push([cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]);
  }
  return comp;
}

function minGapBetween(compA, compB) {
  let minDist = Infinity;
  // Use bounding box approximation for speed
  const aMinX = Math.min(...compA.map(p => p[0]));
  const aMaxX = Math.max(...compA.map(p => p[0]));
  const aMinY = Math.min(...compA.map(p => p[1]));
  const aMaxY = Math.max(...compA.map(p => p[1]));
  const bMinX = Math.min(...compB.map(p => p[0]));
  const bMaxX = Math.max(...compB.map(p => p[0]));
  const bMinY = Math.min(...compB.map(p => p[1]));
  const bMaxY = Math.max(...compB.map(p => p[1]));

  const gapX = Math.max(0, Math.max(aMinX - bMaxX, bMinX - aMaxX));
  const gapY = Math.max(0, Math.max(aMinY - bMaxY, bMinY - aMaxY));
  return Math.max(gapX, gapY);
}

let totalFixed = 0;
let totalPixelsRemoved = 0;

const files = readdirSync(FIGURES_DIR).filter(f => f.endsWith('.json'));

for (const jsonFile of files) {
  const baseName = basename(jsonFile, '.json');
  const pngPath = join(FIGURES_DIR, baseName + '.png');
  const jsonPath = join(FIGURES_DIR, jsonFile);

  let pngBuf;
  try { pngBuf = readFileSync(pngPath); } catch { continue; }

  const png = PNG.sync.read(pngBuf);
  const j = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const ssFrames = j.spritesheet?.frames || {};

  let filePixelsRemoved = 0;

  for (const [key, frameData] of Object.entries(ssFrames)) {
    const f = frameData.frame;
    if (!f || f.w === 0 || f.h === 0) continue;

    // Build presence grid
    const grid = new Uint8Array(f.w * f.h);
    for (let py = 0; py < f.h; py++) {
      for (let px = 0; px < f.w; px++) {
        const idx = ((f.y + py) * png.width + (f.x + px)) * 4;
        grid[py * f.w + px] = png.data[idx + 3] > 0 ? 1 : 0;
      }
    }

    // Find connected components
    const visited = new Uint8Array(f.w * f.h);
    const components = [];
    for (let py = 0; py < f.h; py++) {
      for (let px = 0; px < f.w; px++) {
        if (!grid[py * f.w + px] || visited[py * f.w + px]) continue;
        components.push(floodFill(grid, f.w, f.h, px, py, visited));
      }
    }

    if (components.length <= 1) continue;

    // Sort by size descending — largest is the main sprite
    components.sort((a, b) => b.length - a.length);
    const mainComp = components[0];

    // Check each smaller component
    for (let ci = 1; ci < components.length; ci++) {
      const comp = components[ci];
      const ratio = comp.length / mainComp.length;
      const gap = minGapBetween(mainComp, comp);

      if (ratio < MAX_CLUSTER_RATIO && gap >= MIN_GAP) {
        // Zero out these pixels in the PNG
        for (const [px, py] of comp) {
          const idx = ((f.y + py) * png.width + (f.x + px)) * 4;
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 0;
        }
        filePixelsRemoved += comp.length;
      }
    }
  }

  if (filePixelsRemoved > 0) {
    totalFixed++;
    totalPixelsRemoved += filePixelsRemoved;
    console.log(`${baseName}: removed ${filePixelsRemoved} bleed pixels`);
    if (!DRY_RUN) {
      const outBuf = PNG.sync.write(png);
      writeFileSync(pngPath, outBuf);
    }
  }
}

console.log(`\n--- Summary ---`);
console.log(`Files fixed: ${totalFixed}`);
console.log(`Total pixels removed: ${totalPixelsRemoved}`);
if (DRY_RUN) console.log(`(dry run — no files modified)`);
