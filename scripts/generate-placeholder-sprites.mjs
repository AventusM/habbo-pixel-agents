#!/usr/bin/env node
// Generate colored 64x64 PNG placeholders for furniture testing
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const furniture = [
  { name: 'chair', color: '#FF6B6B' },      // Red
  { name: 'desk', color: '#4ECDC4' },       // Cyan
  { name: 'computer', color: '#45B7D1' },   // Blue
  { name: 'lamp', color: '#FFA07A' },       // Light orange
  { name: 'plant', color: '#98D8C8' },      // Mint green
  { name: 'bookshelf', color: '#A78BFA' },  // Purple
  { name: 'rug', color: '#FDA4AF' },        // Pink
  { name: 'whiteboard', color: '#E2E8F0' }, // Light gray
];

const outputDir = 'assets/spritesheets';
fs.mkdirSync(outputDir, { recursive: true });

// Create furniture atlas (combine all sprites)
const atlasWidth = 256;
const atlasHeight = 256;
const canvas = createCanvas(atlasWidth, atlasHeight);
const ctx = canvas.getContext('2d');

const manifest = {
  frames: {},
  meta: {
    image: 'furniture_atlas.png',
    format: 'RGBA8888',
    size: { w: atlasWidth, h: atlasHeight }
  }
};

let x = 0;
let y = 0;

// Generate sprites and add to atlas
for (const { name, color } of furniture) {
  // Draw colored 64x64 sprite
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 64, 64);

  // Add white border for visibility
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, 62, 62);

  // Add text label
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(name.toUpperCase(), x + 32, y + 36);

  // Add manifest entries for directions 0 and 2
  manifest.frames[`${name}_64_a_0_0`] = {
    frame: { x, y, w: 64, h: 64 },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 },
    sourceSize: { w: 64, h: 64 }
  };

  manifest.frames[`${name}_64_a_2_0`] = {
    frame: { x, y, w: 64, h: 64 },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 },
    sourceSize: { w: 64, h: 64 }
  };

  // Move to next position in atlas
  x += 64;
  if (x >= atlasWidth) {
    x = 0;
    y += 64;
  }
}

// Save atlas PNG
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(path.join(outputDir, 'furniture_atlas.png'), buffer);

// Save manifest JSON
fs.writeFileSync(
  path.join(outputDir, 'furniture_atlas.json'),
  JSON.stringify(manifest, null, 2)
);

console.log('✓ Generated furniture_atlas.png (colored placeholders)');
console.log('✓ Generated furniture_atlas.json (8 furniture types × 2 directions)');
console.log(`✓ Atlas size: ${atlasWidth}×${atlasHeight}px`);
console.log(`✓ Sprites: ${Object.keys(manifest.frames).length} frames`);
