#!/usr/bin/env node
// scripts/convert-cortex-to-nitro.mjs
// Converts cortex-assets custom JSON → Nitro unbundled schema
// Usage: node scripts/convert-cortex-to-nitro.mjs

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const RAW_DIR = 'assets/habbo-raw';
const OUT_DIR = 'assets/habbo';

/**
 * Get PNG dimensions using sips (macOS) or file command fallback
 */
function getPngDimensions(pngPath) {
  try {
    const output = execSync(`sips -g pixelWidth -g pixelHeight "${pngPath}" 2>/dev/null`, { encoding: 'utf8' });
    const w = parseInt(output.match(/pixelWidth:\s*(\d+)/)?.[1] || '0');
    const h = parseInt(output.match(/pixelHeight:\s*(\d+)/)?.[1] || '0');
    return { w, h };
  } catch {
    // Fallback: parse PNG header bytes
    const buf = fs.readFileSync(pngPath);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    return { w, h };
  }
}

/**
 * Convert a cortex-assets furniture JSON to Nitro unbundled format.
 *
 * Cortex input: { assets: { key: { offsets, sprite?, source?, flipH? } }, visualization, logic }
 * Nitro output: { name, type, spritesheet (TexturePacker), assets (offsets), visualization, logic }
 */
function convertFurniture(name, rawJson, pngSize) {
  const cortex = rawJson;
  const frames = {};
  const nitroAssets = {};

  for (const [key, asset] of Object.entries(cortex.assets)) {
    // Only convert 64-size sprites (skip 32-size thumbnails and icons)
    if (!key.includes('_64_') && !key.includes('_icon_')) continue;

    // Build asset offset entry (Nitro uses negated offsets)
    nitroAssets[key] = {
      x: asset.offsets ? -asset.offsets.left : 0,
      y: asset.offsets ? -asset.offsets.top : 0,
      source: asset.source || null,
      flipH: asset.flipH === 1 || asset.flipH === true,
    };

    // Build spritesheet frame if this asset has sprite data (not a source reference)
    if (asset.sprite) {
      frames[key] = {
        frame: {
          x: asset.sprite.left,
          y: asset.sprite.top,
          w: asset.sprite.width,
          h: asset.sprite.height,
        },
        rotated: false,
        trimmed: false,
        spriteSourceSize: {
          x: 0, y: 0,
          w: asset.sprite.width,
          h: asset.sprite.height,
        },
        sourceSize: {
          w: asset.sprite.width,
          h: asset.sprite.height,
        },
      };
    }
  }

  // Extract direction info
  const directions = cortex.visualization?.directions || {};
  const directionNumbers = Object.keys(directions).map(Number);

  return {
    name,
    type: 'furniture',
    spritesheet: {
      frames,
      meta: {
        image: `${name}.png`,
        format: 'RGBA8888',
        size: pngSize,
      },
    },
    assets: nitroAssets,
    visualization: {
      layerCount: cortex.visualization?.layerCount || 1,
      directions,
    },
    logic: {
      dimensions: cortex.logic?.dimensions || [1, 1, 1],
      directions: directionNumbers.length > 0 ? directionNumbers : [0, 2, 4, 6],
    },
  };
}

/**
 * Convert a cortex-assets figure JSON to Nitro unbundled format.
 *
 * Cortex figure input: flat { "h_std_bd_1_0_0": { offset: "-20,49", left, top, width, height } }
 * Output: same Nitro schema but type = "figure"
 */
function convertFigure(name, rawJson, pngSize) {
  const frames = {};
  const nitroAssets = {};

  for (const [key, sprite] of Object.entries(rawJson)) {
    // Skip REGPOINTS entries (registration point metadata, not sprites)
    if (key.includes('REGPOINTS')) continue;

    // Skip metadata entries (empty objects like "manifest":{} and "AssetName":{})
    if (!sprite.offset && !sprite.left && !sprite.link) continue;

    // Parse offset string "x,y"
    let offsetX = 0, offsetY = 0;
    if (sprite.offset) {
      const parts = sprite.offset.split(',');
      offsetX = parseInt(parts[0]);
      offsetY = parseInt(parts[1]);
    }

    // Handle link references: entry shares sprite data from another key
    if (sprite.link) {
      // Resolve link target to get sprite coordinates
      const target = rawJson[sprite.link];
      if (target && target.left) {
        const w = parseInt(target.width);
        const h = parseInt(target.height);
        const left = parseInt(target.left);
        const top = parseInt(target.top);

        frames[key] = {
          frame: { x: left, y: top, w, h },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w, h },
          sourceSize: { w, h },
        };
      } else {
        // Link target not found or also a link — record as source reference
        nitroAssets[key] = {
          x: offsetX,
          y: offsetY,
          source: sprite.link,
          flipH: false,
        };
        continue;
      }

      nitroAssets[key] = {
        x: offsetX,
        y: offsetY,
        source: null,
        flipH: false,
      };
      continue;
    }

    // Normal sprite entry with left/top/width/height
    const w = parseInt(sprite.width);
    const h = parseInt(sprite.height);
    const left = parseInt(sprite.left);
    const top = parseInt(sprite.top);

    frames[key] = {
      frame: { x: left, y: top, w, h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h },
      sourceSize: { w, h },
    };

    nitroAssets[key] = {
      x: offsetX,
      y: offsetY,
      source: null,
      flipH: false,
    };
  }

  return {
    name,
    type: 'figure',
    spritesheet: {
      frames,
      meta: {
        image: `${name}.png`,
        format: 'RGBA8888',
        size: pngSize,
      },
    },
    assets: nitroAssets,
    visualization: { layerCount: 1, directions: {} },
    logic: { dimensions: [1, 1, 1], directions: [0, 1, 2, 3, 4, 5, 6, 7] },
  };
}

function main() {
  console.log('Converting cortex-assets → Nitro unbundled schema...\n');

  const manifest = { furniture: [], figures: [] };

  // Convert furniture
  const furnitureRaw = path.join(RAW_DIR, 'furniture');
  const furnitureOut = path.join(OUT_DIR, 'furniture');

  if (fs.existsSync(furnitureRaw)) {
    fs.mkdirSync(furnitureOut, { recursive: true });
    const jsonFiles = fs.readdirSync(furnitureRaw).filter(f => f.endsWith('.json'));

    for (const jsonFile of jsonFiles) {
      const name = jsonFile.replace('.json', '');
      const rawJson = JSON.parse(fs.readFileSync(path.join(furnitureRaw, jsonFile), 'utf8'));
      const pngPath = path.join(furnitureRaw, `${name}.png`);

      if (!fs.existsSync(pngPath)) {
        console.warn(`  ⚠ No PNG for ${name}, skipping`);
        continue;
      }

      const pngSize = getPngDimensions(pngPath);
      const nitro = convertFurniture(name, rawJson, pngSize);

      // Write converted JSON
      fs.writeFileSync(
        path.join(furnitureOut, `${name}.json`),
        JSON.stringify(nitro, null, 2)
      );

      // Copy PNG
      fs.copyFileSync(pngPath, path.join(furnitureOut, `${name}.png`));

      manifest.furniture.push(name);
      console.log(`  ✓ ${name} (${Object.keys(nitro.spritesheet.frames).length} frames, ${Object.keys(nitro.assets).length} assets)`);
    }
  } else {
    console.warn('⚠ No furniture raw assets found. Run download script first.');
  }

  // Convert figures
  const figuresRaw = path.join(RAW_DIR, 'figures');
  const figuresOut = path.join(OUT_DIR, 'figures');

  if (fs.existsSync(figuresRaw)) {
    fs.mkdirSync(figuresOut, { recursive: true });
    const jsonFiles = fs.readdirSync(figuresRaw).filter(f => f.endsWith('.json'));

    for (const jsonFile of jsonFiles) {
      const name = jsonFile.replace('.json', '');
      const rawJson = JSON.parse(fs.readFileSync(path.join(figuresRaw, jsonFile), 'utf8'));
      const pngPath = path.join(figuresRaw, `${name}.png`);

      if (!fs.existsSync(pngPath)) {
        console.warn(`  ⚠ No PNG for ${name}, skipping`);
        continue;
      }

      const pngSize = getPngDimensions(pngPath);
      const nitro = convertFigure(name, rawJson, pngSize);

      fs.writeFileSync(
        path.join(figuresOut, `${name}.json`),
        JSON.stringify(nitro, null, 2)
      );

      fs.copyFileSync(pngPath, path.join(figuresOut, `${name}.png`));

      manifest.figures.push(name);
      console.log(`  ✓ ${name} (${Object.keys(nitro.spritesheet.frames).length} frames)`);
    }
  } else {
    console.warn('⚠ No figure raw assets found. Run download script first.');
  }

  // Write manifest
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\n✓ Conversion complete!`);
  console.log(`  Manifest: ${path.join(OUT_DIR, 'manifest.json')}`);
  console.log(`  Furniture: ${manifest.furniture.length} items`);
  console.log(`  Figures: ${manifest.figures.length} items`);
  console.log('\nNext: npm run build');
}

main();
