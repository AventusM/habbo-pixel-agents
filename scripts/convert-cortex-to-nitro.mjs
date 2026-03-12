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

function main() {
  console.log('Converting cortex-assets → Nitro unbundled schema...\n');

  const manifest = { furniture: [] };

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

  // Write manifest
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\n✓ Conversion complete!`);
  console.log(`  Manifest: ${path.join(OUT_DIR, 'manifest.json')}`);
  console.log(`  Furniture: ${manifest.furniture.length} items`);
  console.log('\nNext: npm run build');
}

main();
