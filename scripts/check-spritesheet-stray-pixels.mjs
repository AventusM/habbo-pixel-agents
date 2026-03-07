#!/usr/bin/env node
// scripts/check-spritesheet-stray-pixels.mjs
// Scan figure spritesheet PNGs for stray alpha pixels outside declared frame bounds.
//
// Usage:
//   node scripts/check-spritesheet-stray-pixels.mjs assets/habbo/figures/hh_human_face
//   node scripts/check-spritesheet-stray-pixels.mjs   # scans ALL figure spritesheets
//
// Requires: pngjs (npm install pngjs --save-dev)

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, basename } from "path";
import { PNG } from "pngjs";

/**
 * Load a PNG file and return its RGBA pixel data + dimensions.
 */
function loadPng(pngPath) {
  const buffer = readFileSync(pngPath);
  const png = PNG.sync.read(buffer);
  return { data: png.data, width: png.width, height: png.height };
}

/**
 * Load spritesheet JSON and extract frame bounding boxes.
 * Supports the project's Nitro-converted format: { spritesheet: { frames: { key: { frame: {x,y,w,h} } } } }
 */
function loadFrameBounds(jsonPath) {
  const raw = JSON.parse(readFileSync(jsonPath, "utf8"));
  const frames = raw.spritesheet?.frames;
  if (!frames) {
    console.error(`  No spritesheet.frames found in ${jsonPath}`);
    return [];
  }
  const bounds = [];
  for (const [key, entry] of Object.entries(frames)) {
    const f = entry.frame;
    bounds.push({ key, x: f.x, y: f.y, w: f.w, h: f.h });
  }
  return bounds;
}

/**
 * Check if a pixel (px, py) falls within any frame bounding box.
 */
function isInsideAnyFrame(px, py, frameBounds) {
  for (const f of frameBounds) {
    if (px >= f.x && px < f.x + f.w && py >= f.y && py < f.y + f.h) {
      return f.key;
    }
  }
  return null;
}

/**
 * Scan a single spritesheet for stray pixels.
 * Returns { strayPixels: [...], borderPixels: [...] }
 */
function scanSpritesheet(pngPath, jsonPath) {
  const { data, width, height } = loadPng(pngPath);
  const frameBounds = loadFrameBounds(jsonPath);

  if (frameBounds.length === 0) {
    return { strayPixels: [], borderPixels: [], width, height, frameCount: 0 };
  }

  const strayPixels = [];
  const borderPixels = [];

  // Build a coverage bitmap for fast lookup
  const covered = new Uint8Array(width * height);
  for (const f of frameBounds) {
    for (let y = f.y; y < f.y + f.h && y < height; y++) {
      for (let x = f.x; x < f.x + f.w && x < width; x++) {
        covered[y * width + x] = 1;
      }
    }
  }

  // Scan every pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];

      if (alpha === 0) continue; // Fully transparent — fine

      const isCovered = covered[y * width + x] === 1;

      if (!isCovered) {
        // Pixel has alpha > 0 but is NOT within any frame bounds
        strayPixels.push({
          x,
          y,
          r: data[idx],
          g: data[idx + 1],
          b: data[idx + 2],
          a: alpha,
        });
      } else {
        // Check if pixel is at the border of its frame (potential bleed)
        for (const f of frameBounds) {
          if (x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) {
            const atLeft = x === f.x;
            const atRight = x === f.x + f.w - 1;
            const atTop = y === f.y;
            const atBottom = y === f.y + f.h - 1;

            if (atLeft || atRight || atTop || atBottom) {
              borderPixels.push({
                x,
                y,
                r: data[idx],
                g: data[idx + 1],
                b: data[idx + 2],
                a: alpha,
                frame: f.key,
                edge: [
                  atLeft && "left",
                  atRight && "right",
                  atTop && "top",
                  atBottom && "bottom",
                ]
                  .filter(Boolean)
                  .join("+"),
              });
            }
            break;
          }
        }
      }
    }
  }

  return {
    strayPixels,
    borderPixels,
    width,
    height,
    frameCount: frameBounds.length,
  };
}

/**
 * Zero out stray pixels in a PNG and write it back.
 */
function cleanStrayPixels(pngPath, strayPixels) {
  const buffer = readFileSync(pngPath);
  const png = PNG.sync.read(buffer);

  let cleaned = 0;
  for (const sp of strayPixels) {
    const idx = (sp.y * png.width + sp.x) * 4;
    png.data[idx] = 0;
    png.data[idx + 1] = 0;
    png.data[idx + 2] = 0;
    png.data[idx + 3] = 0;
    cleaned++;
  }

  const outBuffer = PNG.sync.write(png);
  writeFileSync(pngPath, outBuffer);
  return cleaned;
}

// ---- Main ----

const args = process.argv.slice(2);
let targets = [];

if (args.length > 0) {
  // Specific asset path (without extension)
  const basePath = args[0].replace(/\.(json|png)$/, "");
  targets.push(basePath);
} else {
  // Scan all figure spritesheets
  const figDir = "assets/habbo/figures";
  const files = readdirSync(figDir).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    targets.push(join(figDir, f.replace(".json", "")));
  }
}

const shouldClean = args.includes("--clean");
let totalStray = 0;
let totalBorder = 0;

for (const basePath of targets) {
  const jsonPath = basePath + ".json";
  const pngPath = basePath + ".png";
  const name = basename(basePath);

  console.log(`\nScanning: ${name}`);
  console.log(`  PNG: ${pngPath}`);
  console.log(`  JSON: ${jsonPath}`);

  const result = scanSpritesheet(pngPath, jsonPath);

  console.log(
    `  Image size: ${result.width}x${result.height}, Frames: ${result.frameCount}`,
  );
  console.log(`  Stray pixels (outside frames): ${result.strayPixels.length}`);
  console.log(
    `  Border pixels (at frame edges): ${result.borderPixels.length}`,
  );

  if (result.strayPixels.length > 0) {
    console.log(`\n  STRAY PIXELS FOUND:`);
    // Show up to 20 stray pixels
    const shown = result.strayPixels.slice(0, 20);
    for (const sp of shown) {
      console.log(
        `    (${sp.x}, ${sp.y}) rgba(${sp.r}, ${sp.g}, ${sp.b}, ${sp.a})`,
      );
    }
    if (result.strayPixels.length > 20) {
      console.log(
        `    ... and ${result.strayPixels.length - 20} more stray pixels`,
      );
    }

    if (shouldClean) {
      const cleaned = await cleanStrayPixels(pngPath, result.strayPixels);
      console.log(`  CLEANED: Zeroed ${cleaned} stray pixels in ${pngPath}`);
    }
  }

  totalStray += result.strayPixels.length;
  totalBorder += result.borderPixels.length;
}

console.log(`\n--- Summary ---`);
console.log(`Total spritesheets scanned: ${targets.length}`);
console.log(`Total stray pixels: ${totalStray}`);
console.log(`Total border pixels: ${totalBorder}`);

if (totalStray === 0) {
  console.log(
    `\nNo stray pixels found. Issue is likely canvas compositing, not PNG data.`,
  );
} else {
  console.log(
    `\nStray pixels found! Run with --clean to zero them out in-place.`,
  );
}

process.exit(totalStray > 0 ? 1 : 0);
