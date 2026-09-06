#!/usr/bin/env node
// scripts/download-habbo-assets.mjs
// Downloads curated Habbo assets from CakeChloe/cortex-assets
// Usage: node scripts/download-habbo-assets.mjs

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const BASE_URL = 'https://raw.githubusercontent.com/CakeChloe/cortex-assets/master';

// Furniture items (verified against cortex-assets)
const FURNITURE_ITEMS = [
  // Executive (exe_) — used by default room layout
  'exe_chair',          // Office chair
  'exe_table',          // Office desk/table
  'exe_light',          // Desk lamp
  'exe_plant',          // Office plant
  'exe_globe',          // Globe (decorative)
  'exe_sofa',           // Office sofa
  'exe_rug',            // Office rug
  'exe_copier',         // Copy machine

  // Habbo Club (hc_) — Members-only exclusive furniture
  'hc_chr',             // HC chair
  'hc_tbl',             // HC table
  'hc_dsk',             // HC desk
  'hc_lmp',             // HC lamp
  'hc_bkshlf',          // HC bookshelf
  'hc_crpt',            // HC carpet
  'hc_djset',           // HC DJ turntable
  'hc_wall_lamp',       // HC wall lamp

  // Fun & Games
  'edice',              // Dice
  'edicehc',            // HC dice
  'club_sofa',          // Club sofa
  'CF_1_coin_bronze',   // Bronze coin
  'CF_5_coin_silver',   // Silver coin
  'CF_10_coin_gold',    // Gold coin

  // Section-themed furniture (Phase 16)
  'country_gate',       // Country gate
  'tv_flat',            // Flat screen TV
  'shelves_armas',      // Server rack / shelves
  'ads_cltele',         // Habbo Club teleport booth (1x1, dirs 2/4)
];

// Avatar body + clothing
const FIGURE_ITEMS = [
  // Existing
  'hh_human_body',
  'hh_human_face',
  'Hair_M_yo',
  'Hair_U_Messy',
  'Shirt_M_Tshirt_Plain',
  'Trousers_U_Skinny_Jeans',
  'Shoes_U_Slipons',
  // New for Phase 14 (avatar builder catalog)
  'Hair_F_Bob',
  'Hair_U_Multi_Colour',
  'Shirt_F_Schoolshirt',
  'Shirt_F_Tshirt_Sleeved',
  'Shirt_M_Tshirt_Sleeved',
  'Shirt_F_Cardigan',
  'Shirt_M_Cardigan',
  'Shirt_F_Punk_Shirt',
  'Trousers_U_Sraight',
  'Trousers_U_runway',
  'Trousers_F_Leather_skirt',
  'Shoes_F_Schoolshoes',
  'Hat_U_sombrero',
  'Hat_U_urban',
];

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function downloadAsset(category, name, destDir) {
  const jsonUrl = `${BASE_URL}/${category}/${name}/${name}.json`;
  const pngUrl = `${BASE_URL}/${category}/${name}/${name}.png`;

  fs.mkdirSync(destDir, { recursive: true });

  // Download JSON
  const jsonDest = path.join(destDir, `${name}.json`);
  if (fs.existsSync(jsonDest)) {
    console.log(`  ⏭ ${name}.json already exists, skipping`);
  } else {
    console.log(`  ⬇ ${name}.json`);
    const jsonData = await download(jsonUrl);
    fs.writeFileSync(jsonDest, jsonData);
  }

  // Download PNG
  const pngDest = path.join(destDir, `${name}.png`);
  if (fs.existsSync(pngDest)) {
    console.log(`  ⏭ ${name}.png already exists, skipping`);
  } else {
    console.log(`  ⬇ ${name}.png`);
    const pngData = await download(pngUrl);
    fs.writeFileSync(pngDest, pngData);
  }
}

async function main() {
  console.log('Downloading Habbo assets from CakeChloe/cortex-assets...\n');

  // Download furniture
  const furnitureDir = 'assets/habbo-raw/furniture';
  console.log(`Furniture → ${furnitureDir}/`);
  for (const item of FURNITURE_ITEMS) {
    try {
      await downloadAsset('furnitures', item, furnitureDir);
      console.log(`  ✓ ${item}`);
    } catch (err) {
      console.error(`  ✗ ${item}: ${err.message}`);
    }
  }

  // Download figures
  const figuresDir = 'assets/habbo-raw/figures';
  console.log(`\nFigures → ${figuresDir}/`);
  for (const item of FIGURE_ITEMS) {
    try {
      await downloadAsset('figures', item, figuresDir);
      console.log(`  ✓ ${item}`);
    } catch (err) {
      console.error(`  ✗ ${item}: ${err.message}`);
    }
  }

  console.log('\n✓ Download complete!');
  console.log('Next: node scripts/convert-cortex-to-nitro.mjs');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
