import React from 'react';
import { createRoot } from 'react-dom/client';
import { RoomCanvas } from './RoomCanvas.js';

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
