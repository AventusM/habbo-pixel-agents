// tests/dev-capture.test.ts
// M009/S01 T03 — locks the browser dev-capture payload/filename builders and
// the guarded DOM delivery helpers. The suite runs in the `node` environment,
// so the DOM helpers are exercised through stubbed globals.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildDevCapturePayload,
  buildDevCaptureFilename,
  triggerDownload,
  downloadJson,
  copyTextBestEffort,
} from '../src/devCapture.js';

describe('buildDevCapturePayload', () => {
  it('mirrors the VS Code postMessage shape with an injected timestamp', () => {
    const payload = buildDevCapturePayload(
      'data:image/png;base64,AAA',
      ['[12:00:00 LOG] hi'],
      1700000000000,
    );
    expect(payload).toEqual({
      type: 'devCapture',
      timestamp: 1700000000000,
      screenshot: 'data:image/png;base64,AAA',
      logs: ['[12:00:00 LOG] hi'],
    });
  });

  it('copies the log buffer so later console lines do not mutate the payload', () => {
    const logs = ['a'];
    const payload = buildDevCapturePayload('data:', logs, 1);
    logs.push('b');
    expect(payload.logs).toEqual(['a']);
  });

  it('defaults the timestamp to now', () => {
    const before = Date.now();
    const payload = buildDevCapturePayload('data:', []);
    expect(payload.timestamp).toBeGreaterThanOrEqual(before);
  });
});

describe('buildDevCaptureFilename', () => {
  it('mirrors the extension tmp-file naming for both artifacts', () => {
    expect(buildDevCaptureFilename(1700000000000, 'png')).toBe('habbo-capture-1700000000000.png');
    expect(buildDevCaptureFilename(1700000000000, 'json')).toBe('habbo-capture-1700000000000.json');
  });
});

describe('browser delivery helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('triggerDownload clicks an anchor with href + download set', () => {
    const clicked: Array<{ href: string; download: string }> = [];
    vi.stubGlobal('document', {
      createElement: () => {
        const anchor = {
          href: '',
          download: '',
          click: () => clicked.push({ href: anchor.href, download: anchor.download }),
        };
        return anchor;
      },
    });

    triggerDownload('data:image/png;base64,AAA', 'shot.png');

    expect(clicked).toEqual([{ href: 'data:image/png;base64,AAA', download: 'shot.png' }]);
  });

  it('downloadJson serializes the payload and revokes the object URL', () => {
    const clicked: string[] = [];
    const revoked: string[] = [];
    vi.stubGlobal('document', {
      createElement: () => ({ href: '', download: '', click: () => clicked.push('click') }),
    });
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:fake',
      revokeObjectURL: (url: string) => revoked.push(url),
    });

    downloadJson({ type: 'devCapture', logs: [] }, 'x.json');

    expect(clicked).toEqual(['click']);
    expect(revoked).toEqual(['blob:fake']);
  });

  it('is a no-op outside a DOM', () => {
    expect(() => triggerDownload('data:', 'x.png')).not.toThrow();
    expect(() => downloadJson({}, 'x.json')).not.toThrow();
  });

  it('copyTextBestEffort returns false when the clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    await expect(copyTextBestEffort('x')).resolves.toBe(false);
  });

  it('copyTextBestEffort writes text and reports success', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyTextBestEffort('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('copyTextBestEffort swallows clipboard rejections', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async () => {
          throw new Error('denied');
        },
      },
    });
    await expect(copyTextBestEffort('x')).resolves.toBe(false);
  });
});