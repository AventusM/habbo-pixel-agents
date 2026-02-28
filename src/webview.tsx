import React from 'react';
import { createRoot } from 'react-dom/client';
import { RoomCanvas } from './RoomCanvas.js';
import { SpriteCache } from './isoSpriteCache.js';

const DEMO_HEIGHTMAP = [
  '0000000000',
  '0111111110',
  '0111111110',
  '0111111110',
  '0111111110',
  '0111111110',
  '0111111110',
  '0111111110',
  '0000000000',
  '0000000000',
].join('\n');

// Initialize sprite cache and load assets BEFORE rendering
const spriteCache = new SpriteCache();

(async () => {
  try {
    const { chairPng, chairJson, furniturePng, furnitureJson, avatarPng, avatarJson } = (window as any).ASSET_URIS;

    console.log('Loading chair atlas from:', chairPng, chairJson);
    await spriteCache.loadAtlas('chair', chairPng, chairJson);
    console.log('✓ Chair atlas loaded successfully');

    console.log('Loading furniture atlas from:', furniturePng, furnitureJson);
    await spriteCache.loadAtlas('furniture', furniturePng, furnitureJson);
    console.log('✓ Furniture atlas loaded successfully');

    console.log('Loading avatar atlas from:', avatarPng, avatarJson);
    await spriteCache.loadAtlas('avatar', avatarPng, avatarJson);
    console.log('✓ Avatar atlas loaded successfully');

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

    // Test avatar frame lookup
    const avatarFrame = spriteCache.getFrame('avatar', 'avatar_0_body_0_idle_0');
    if (avatarFrame) {
      console.log('✓ Avatar frame lookup succeeded:', {
        name: 'avatar_0_body_0_idle_0',
        x: avatarFrame.x,
        y: avatarFrame.y,
        w: avatarFrame.w,
        h: avatarFrame.h,
      });
    }

    // Make sprite cache globally available for RoomCanvas
    (window as any).spriteCache = spriteCache;

    // NOW render RoomCanvas after assets are loaded
    const root = document.getElementById('root');
    if (root) {
      console.log('✓ Rendering RoomCanvas with loaded assets');
      createRoot(root).render(React.createElement(RoomCanvas, { heightmap: DEMO_HEIGHTMAP }));
    }
  } catch (error) {
    console.error('Asset loading failed:', error);
  }
})();
