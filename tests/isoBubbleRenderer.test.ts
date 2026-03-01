// tests/isoBubbleRenderer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wrapText, drawSpeechBubble } from '../src/isoBubbleRenderer.js';

describe('isoBubbleRenderer', () => {
  let mockCtx: any;

  beforeEach(() => {
    // Create mock canvas context with method tracking
    mockCtx = {
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      textBaseline: '',
      measureText: vi.fn((text: string) => ({
        width: text.length * 6, // Approximate width (6px per char)
      })),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      roundRect: vi.fn(),
      fillText: vi.fn(),
    };
  });

  describe('wrapText', () => {
    it('splits long text into multiple lines', () => {
      const text = 'This is a very long sentence that should wrap to multiple lines';
      const maxWidth = 100;

      const lines = wrapText(mockCtx, text, maxWidth);

      expect(lines.length).toBeGreaterThan(1);
      expect(mockCtx.measureText).toHaveBeenCalled();
    });

    it('does NOT break words mid-character (splits at spaces)', () => {
      const text = 'word1 word2 word3';
      const maxWidth = 50;

      const lines = wrapText(mockCtx, text, maxWidth);

      // Each line should contain complete words, not partial words
      for (const line of lines) {
        // Line should not start or end with spaces (except possibly empty)
        if (line.trim()) {
          expect(line).toBe(line.trim());
        }
      }
    });

    it('allows single long word to overflow (no truncation)', () => {
      const longWord = 'supercalifragilisticexpialidocious';
      const maxWidth = 50;

      const lines = wrapText(mockCtx, longWord, maxWidth);

      expect(lines.length).toBe(1);
      expect(lines[0]).toBe(longWord);
    });

    it('returns empty array element for empty text', () => {
      const lines = wrapText(mockCtx, '', 100);

      expect(lines.length).toBe(1);
      expect(lines[0]).toBe('');
    });
  });

  describe('drawSpeechBubble', () => {
    it('calls ctx.roundRect and ctx.fillText', () => {
      drawSpeechBubble(mockCtx, {
        text: 'Hello',
        anchorX: 100,
        anchorY: 100,
      });

      expect(mockCtx.roundRect).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('waiting bubble text cycles based on currentTimeMs', () => {
      // Time 0-499ms: 1 dot
      drawSpeechBubble(
        mockCtx,
        { text: 'ignored', anchorX: 100, anchorY: 100, isWaiting: true },
        400
      );
      let lastCall = mockCtx.fillText.mock.calls[mockCtx.fillText.mock.calls.length - 1];
      expect(lastCall[0]).toBe('.');

      mockCtx.fillText.mockClear();

      // Time 500-999ms: 2 dots
      drawSpeechBubble(
        mockCtx,
        { text: 'ignored', anchorX: 100, anchorY: 100, isWaiting: true },
        700
      );
      lastCall = mockCtx.fillText.mock.calls[mockCtx.fillText.mock.calls.length - 1];
      expect(lastCall[0]).toBe('..');

      mockCtx.fillText.mockClear();

      // Time 1000-1499ms: 3 dots
      drawSpeechBubble(
        mockCtx,
        { text: 'ignored', anchorX: 100, anchorY: 100, isWaiting: true },
        1200
      );
      lastCall = mockCtx.fillText.mock.calls[mockCtx.fillText.mock.calls.length - 1];
      expect(lastCall[0]).toBe('...');
    });

    it('bubble positioned above anchor (bubbleY < anchorY)', () => {
      const anchorY = 200;

      drawSpeechBubble(mockCtx, {
        text: 'Test',
        anchorX: 100,
        anchorY,
      });

      // Check roundRect call (bubble background)
      const roundRectCall = mockCtx.roundRect.mock.calls[0];
      expect(roundRectCall).toBeDefined();
      const bubbleY = roundRectCall[1]; // Second parameter is Y position

      expect(bubbleY).toBeLessThan(anchorY);
    });

    it('text coordinates use Math.floor (no sub-pixel positions)', () => {
      drawSpeechBubble(mockCtx, {
        text: 'Test',
        anchorX: 100.5,
        anchorY: 100.7,
      });

      // Check fillText calls for integer coordinates
      const fillTextCalls = mockCtx.fillText.mock.calls;
      expect(fillTextCalls.length).toBeGreaterThan(0);

      for (const call of fillTextCalls) {
        const [, x, y] = call;
        expect(x).toBe(Math.floor(x));
        expect(y).toBe(Math.floor(y));
      }
    });

    it('sets font before calling measureText', () => {
      // Track call order
      const calls: string[] = [];
      const trackingCtx = {
        ...mockCtx,
        get font() {
          return mockCtx.font;
        },
        set font(value: string) {
          calls.push('font');
          mockCtx.font = value;
        },
        measureText: vi.fn((text: string) => {
          calls.push('measureText');
          return { width: text.length * 6 };
        }),
      };

      drawSpeechBubble(trackingCtx as any, {
        text: 'Test',
        anchorX: 100,
        anchorY: 100,
      });

      // Font should be set before measureText is called
      const fontIndex = calls.indexOf('font');
      const measureTextIndex = calls.indexOf('measureText');

      expect(fontIndex).toBeGreaterThanOrEqual(0);
      expect(measureTextIndex).toBeGreaterThan(fontIndex);
    });
  });
});
