// tests/setup.ts
// Minimal canvas mocking for jsdom environment

import { beforeAll } from 'vitest';

beforeAll(() => {
  // Mock OffscreenCanvas if not available in jsdom
  if (typeof OffscreenCanvas === 'undefined') {
    (global as any).OffscreenCanvas = class {
      width: number;
      height: number;

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }

      getContext() {
        return {
          scale: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          fill: () => {},
          fillStyle: '',
          imageSmoothingEnabled: true,
        };
      }
    };
  }

  // Mock window object for Node environment
  if (typeof window === 'undefined') {
    (global as any).window = {
      devicePixelRatio: 1,
      _debuggedFurniture: undefined,
      _debuggedAvatars: undefined,
    };
  } else if (!window.devicePixelRatio) {
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    });
  }

  // Mock createImageBitmap for sprite cache tests
  if (typeof globalThis.createImageBitmap === 'undefined') {
    (globalThis as any).createImageBitmap = async (img: HTMLImageElement) => ({
      width: img.width,
      height: img.height,
      close: () => {},
    });
  }
});
