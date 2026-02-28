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
    const { chairPng, chairJson } = (window as any).ASSET_URIS;

    console.log('Loading chair atlas from:', chairPng, chairJson);

    await spriteCache.loadAtlas('chair', chairPng, chairJson);

    console.log('✓ Chair atlas loaded successfully');

    // Test frame lookup
    const frame = spriteCache.getFrame('chair', 'chair_64_a_0_0');
    if (frame) {
      console.log('✓ Frame lookup succeeded:', {
        x: frame.x,
        y: frame.y,
        w: frame.w,
        h: frame.h,
        bitmapWidth: frame.bitmap.width,
        bitmapHeight: frame.bitmap.height,
      });
    } else {
      console.warn('Frame lookup returned null — check frame name in manifest');
    }
  } catch (error) {
    console.error('Asset loading failed:', error);
  }
})();
