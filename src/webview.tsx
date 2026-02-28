import React from 'react';
import { createRoot } from 'react-dom/client';
import { RoomCanvas } from './RoomCanvas.js';
import { SpriteCache } from './isoSpriteCache.js';

const DEMO_HEIGHTMAP = [
  '0000000000',
  '0111100000',
  '0100000000',
  '0100000000',
  '0100000000',
  '0000000000',
  '0000000000',
  '0000000000',
  '0000000000',
  '0000000000',
].join('\n');

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(React.createElement(RoomCanvas, { heightmap: DEMO_HEIGHTMAP }));
}

// Initialize sprite cache and load chair atlas
const spriteCache = new SpriteCache();

(async () => {
  try {
    const { chairPng, chairJson, furniturePng, furnitureJson } = (window as any).ASSET_URIS;

    console.log('Loading chair atlas from:', chairPng, chairJson);
    await spriteCache.loadAtlas('chair', chairPng, chairJson);
    console.log('✓ Chair atlas loaded successfully');

    console.log('Loading furniture atlas from:', furniturePng, furnitureJson);
    await spriteCache.loadAtlas('furniture', furniturePng, furnitureJson);
    console.log('✓ Furniture atlas loaded successfully');

    // Test frame lookup
    const chairFrame = spriteCache.getFrame('chair', 'chair_64_a_0_0');
    if (chairFrame) {
      console.log('✓ Chair frame lookup succeeded:', {
        x: chairFrame.x,
        y: chairFrame.y,
        w: chairFrame.w,
        h: chairFrame.h,
      });
    }

    const deskFrame = spriteCache.getFrame('furniture', 'desk_64_a_0_0');
    if (deskFrame) {
      console.log('✓ Furniture frame lookup succeeded:', {
        name: 'desk_64_a_0_0',
        x: deskFrame.x,
        y: deskFrame.y,
        w: deskFrame.w,
        h: deskFrame.h,
      });
    }

    // Make sprite cache globally available for RoomCanvas
    (window as any).spriteCache = spriteCache;
  } catch (error) {
    console.error('Asset loading failed:', error);
  }
})();
