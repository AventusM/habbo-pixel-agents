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
          save: () => {},
          restore: () => {},
          translate: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          fill: () => {},
          stroke: () => {},
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
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

  // AudioContext mock for audio tests (Phase 8)
  class MockAudioContext {
    state: 'suspended' | 'running' | 'closed' = 'suspended';
    destination = {};

    async resume() {
      this.state = 'running';
    }

    async decodeAudioData(buffer: ArrayBuffer): Promise<AudioBuffer> {
      if (buffer.byteLength === 0) {
        throw new DOMException('Empty buffer', 'EncodingError');
      }
      return {
        duration: 1.0,
        numberOfChannels: 2,
        sampleRate: 44100,
      } as AudioBuffer;
    }

    createBufferSource() {
      return {
        buffer: null,
        connect: () => {},
        start: () => {},
      };
    }
  }

  (global as any).AudioContext = MockAudioContext;
});
