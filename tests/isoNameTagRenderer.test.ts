// tests/isoNameTagRenderer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawNameTag } from '../src/isoNameTagRenderer.js';

describe('isoNameTagRenderer', () => {
  let mockCtx: any;

  beforeEach(() => {
    // Create mock canvas context with method tracking
    mockCtx = {
      font: '',
      fillStyle: '',
      textBaseline: '',
      measureText: vi.fn((text: string) => ({
        width: text.length * 6, // Approximate width (6px per char)
      })),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      fillText: vi.fn(),
    };
  });

  describe('drawNameTag', () => {
    it('calls ctx.roundRect for pill background', () => {
      drawNameTag(mockCtx, {
        name: 'Agent1',
        status: 'idle',
        anchorX: 100,
        anchorY: 100,
      });

      expect(mockCtx.roundRect).toHaveBeenCalled();
    });

    it('calls ctx.arc for status dot', () => {
      drawNameTag(mockCtx, {
        name: 'Agent1',
        status: 'idle',
        anchorX: 100,
        anchorY: 100,
      });

      expect(mockCtx.arc).toHaveBeenCalled();
    });

    it('status idle produces green dot (#00ff00)', () => {
      const fillStyleHistory: string[] = [];
      Object.defineProperty(mockCtx, 'fillStyle', {
        set: function(value: string) {
          fillStyleHistory.push(value);
        },
        get: function() {
          return fillStyleHistory[fillStyleHistory.length - 1] || '';
        },
      });

      drawNameTag(mockCtx, {
        name: 'Agent1',
        status: 'idle',
        anchorX: 100,
        anchorY: 100,
      });

      // Check that green color was set at some point
      expect(fillStyleHistory).toContain('#00ff00');
    });

    it('status active produces yellow dot (#ffff00)', () => {
      const fillStyleHistory: string[] = [];
      Object.defineProperty(mockCtx, 'fillStyle', {
        set: function(value: string) {
          fillStyleHistory.push(value);
        },
        get: function() {
          return fillStyleHistory[fillStyleHistory.length - 1] || '';
        },
      });

      drawNameTag(mockCtx, {
        name: 'Agent1',
        status: 'active',
        anchorX: 100,
        anchorY: 100,
      });

      // Yellow color should be set (used for both dot and text)
      expect(fillStyleHistory).toContain('#ffff00');
    });

    it('status waiting produces grey dot (#888888)', () => {
      drawNameTag(mockCtx, {
        name: 'Agent1',
        status: 'waiting',
        anchorX: 100,
        anchorY: 100,
      });

      // Check for grey color
      const fillStyleHistory: string[] = [];
      const originalFillStyleSetter = Object.getOwnPropertyDescriptor(mockCtx, 'fillStyle')?.set;

      // Track fillStyle changes
      Object.defineProperty(mockCtx, 'fillStyle', {
        set: function(value: string) {
          fillStyleHistory.push(value);
        },
        get: function() {
          return fillStyleHistory[fillStyleHistory.length - 1] || '';
        },
      });

      drawNameTag(mockCtx, {
        name: 'Agent1',
        status: 'waiting',
        anchorX: 100,
        anchorY: 100,
      });

      expect(fillStyleHistory).toContain('#888888');
    });

    it('status error produces red dot (#ff0000)', () => {
      const fillStyleHistory: string[] = [];
      Object.defineProperty(mockCtx, 'fillStyle', {
        set: function(value: string) {
          fillStyleHistory.push(value);
        },
        get: function() {
          return fillStyleHistory[fillStyleHistory.length - 1] || '';
        },
      });

      drawNameTag(mockCtx, {
        name: 'Agent1',
        status: 'error',
        anchorX: 100,
        anchorY: 100,
      });

      expect(fillStyleHistory).toContain('#ff0000');
    });

    it('active status shows yellow text, other statuses show white text', () => {
      const fillStyleHistory: string[] = [];
      Object.defineProperty(mockCtx, 'fillStyle', {
        set: function(value: string) {
          fillStyleHistory.push(value);
        },
        get: function() {
          return fillStyleHistory[fillStyleHistory.length - 1] || '';
        },
        configurable: true,
      });

      // Active: yellow text
      drawNameTag(mockCtx, {
        name: 'Agent1',
        status: 'active',
        anchorX: 100,
        anchorY: 100,
      });
      expect(fillStyleHistory).toContain('#ffff00');

      // Reset
      fillStyleHistory.length = 0;
      Object.defineProperty(mockCtx, 'fillStyle', {
        set: function(value: string) {
          fillStyleHistory.push(value);
        },
        get: function() {
          return fillStyleHistory[fillStyleHistory.length - 1] || '';
        },
        configurable: true,
      });

      // Idle: white text
      drawNameTag(mockCtx, {
        name: 'Agent1',
        status: 'idle',
        anchorX: 100,
        anchorY: 100,
      });
      expect(fillStyleHistory).toContain('#ffffff');
    });

    it('pill positioned above anchor (pillY < anchorY)', () => {
      const anchorY = 200;

      drawNameTag(mockCtx, {
        name: 'Agent1',
        status: 'idle',
        anchorX: 100,
        anchorY,
      });

      // Check roundRect call (pill background)
      const roundRectCall = mockCtx.roundRect.mock.calls[0];
      expect(roundRectCall).toBeDefined();
      const pillY = roundRectCall[1]; // Second parameter is Y position

      expect(pillY).toBeLessThan(anchorY);
    });

    it('semi-transparent background uses rgba(0,0,0,0.7)', () => {
      const fillStyleHistory: string[] = [];
      Object.defineProperty(mockCtx, 'fillStyle', {
        set: function(value: string) {
          fillStyleHistory.push(value);
        },
        get: function() {
          return fillStyleHistory[fillStyleHistory.length - 1] || '';
        },
      });

      drawNameTag(mockCtx, {
        name: 'Agent1',
        status: 'idle',
        anchorX: 100,
        anchorY: 100,
      });

      expect(fillStyleHistory).toContain('rgba(0, 0, 0, 0.7)');
    });

    it('text coordinates use Math.floor (no sub-pixel positions)', () => {
      drawNameTag(mockCtx, {
        name: 'Agent1',
        status: 'idle',
        anchorX: 100.5,
        anchorY: 100.7,
      });

      // Check fillText call for integer coordinates
      const fillTextCall = mockCtx.fillText.mock.calls[0];
      expect(fillTextCall).toBeDefined();
      const [, x, y] = fillTextCall;

      expect(x).toBe(Math.floor(x));
      expect(y).toBe(Math.floor(y));
    });
  });
});
