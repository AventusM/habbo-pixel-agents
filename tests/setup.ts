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

  // Mock window.devicePixelRatio if not available
  if (typeof window !== 'undefined' && !window.devicePixelRatio) {
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    });
  }
});
