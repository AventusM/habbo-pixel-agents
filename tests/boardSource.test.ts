// tests/boardSource.test.ts
// Unit tests for the BoardSource port: source classification, webhook
// signature verification + event filtering, debounce, ETag probe, and the
// controller that ties webhook/probe/full-poll together.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  classifyBoardSource,
  verifyWebhookSignature,
  isRelevantBoardEvent,
  createDebouncer,
  probeBoardUpdatedAt,
  createBoardSourceController,
  normalizeProbeIntervalMs,
} from '../src/boardSource.js';

function fakeResponse(
  status: number,
  opts: { etag?: string; body?: unknown } = {},
): ReturnType<typeof fetch> {
  const headers = {
    get: (name: string) =>
      name.toLowerCase() === 'etag' && opts.etag ? opts.etag : null,
  };
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    headers,
    json: async () => opts.body,
  } as unknown as Response);
}

describe('classifyBoardSource', () => {
  it('reports demo when no board is configured', () => {
    expect(classifyBoardSource({ configured: false })).toBe('demo');
    expect(classifyBoardSource({ configured: false, webhookSecret: 's' })).toBe('demo');
  });

  it('reports probe when configured without a webhook secret', () => {
    expect(classifyBoardSource({ configured: true })).toBe('probe');
    expect(classifyBoardSource({ configured: true, webhookSecret: '' })).toBe('probe');
  });

  it('reports webhook when configured with a webhook secret', () => {
    expect(classifyBoardSource({ configured: true, webhookSecret: 's3cret' })).toBe('webhook');
  });
});

describe('verifyWebhookSignature', () => {
  it('accepts a body signed with the configured secret', async () => {
    const { createHmac } = await import('node:crypto');
    const body = JSON.stringify({ action: 'edited' });
    const sig = `sha256=${createHmac('sha256', 's3cret').update(body).digest('hex')}`;
    expect(verifyWebhookSignature('s3cret', sig, body)).toBe(true);
    expect(verifyWebhookSignature('s3cret', sig, Buffer.from(body))).toBe(true);
  });

  it('rejects a wrong secret, a wrong signature, and a missing header', () => {
    const body = 'payload';
    expect(verifyWebhookSignature('s3cret', 'sha256=deadbeef', body)).toBe(false);
    expect(verifyWebhookSignature('other', 'sha256=deadbeef', body)).toBe(false);
    expect(verifyWebhookSignature('s3cret', undefined, body)).toBe(false);
    expect(verifyWebhookSignature('', 'sha256=deadbeef', body)).toBe(false);
  });

  it('accepts a repeated header delivered as a string[]', async () => {
    const { createHmac } = await import('node:crypto');
    const body = JSON.stringify({ action: 'edited' });
    const sig = `sha256=${createHmac('sha256', 's3cret').update(body).digest('hex')}`;
    expect(verifyWebhookSignature('s3cret', [sig], body)).toBe(true);
    expect(verifyWebhookSignature('s3cret', [], body)).toBe(false);
  });
});

describe('isRelevantBoardEvent', () => {
  const repo = 'AventusM/habbo-pixel-agents';

  it('accepts issue events for the watched repo (case-insensitive)', () => {
    expect(isRelevantBoardEvent('issues', { repository: { full_name: repo } }, repo)).toBe(true);
    expect(isRelevantBoardEvent('issues', { repository: { full_name: repo.toUpperCase() } }, repo)).toBe(true);
  });

  it('rejects issue events for another repo', () => {
    expect(isRelevantBoardEvent('issues', { repository: { full_name: 'other/repo' } }, repo)).toBe(false);
    expect(isRelevantBoardEvent('issues', {}, repo)).toBe(false);
  });

  it('accepts project column moves', () => {
    expect(isRelevantBoardEvent('projects_v2_item', {}, repo)).toBe(true);
  });

  it('ignores ping and unknown events', () => {
    expect(isRelevantBoardEvent('ping', {}, repo)).toBe(false);
    expect(isRelevantBoardEvent(undefined, {}, repo)).toBe(false);
  });

  it('accepts an event name delivered as a string[]', () => {
    expect(isRelevantBoardEvent(['issues'], { repository: { full_name: repo } }, repo)).toBe(true);
    expect(isRelevantBoardEvent(['projects_v2_item'], {}, repo)).toBe(true);
    expect(isRelevantBoardEvent([], {}, repo)).toBe(false);
  });
});

describe('normalizeProbeIntervalMs', () => {
  it('keeps a finite positive interval at or above the 1s floor', () => {
    expect(normalizeProbeIntervalMs(10_000)).toBe(10_000);
    expect(normalizeProbeIntervalMs(1_500)).toBe(1_500);
    expect(normalizeProbeIntervalMs(500)).toBe(1_000);
  });

  it('falls back to the ~10s default for non-finite or non-positive values', () => {
    expect(normalizeProbeIntervalMs(Number.NaN)).toBe(10_000);
    expect(normalizeProbeIntervalMs(Number.POSITIVE_INFINITY)).toBe(10_000);
    expect(normalizeProbeIntervalMs(0)).toBe(10_000);
    expect(normalizeProbeIntervalMs(-5)).toBe(10_000);
    expect(normalizeProbeIntervalMs(undefined)).toBe(10_000);
  });
});

describe('createDebouncer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('coalesces a burst into one call', () => {
    const fn = vi.fn();
    const debouncer = createDebouncer(fn, 300);
    debouncer.trigger();
    debouncer.trigger();
    debouncer.trigger();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(debouncer.pending()).toBe(false);
  });

  it('cancel prevents a pending call', () => {
    const fn = vi.fn();
    const debouncer = createDebouncer(fn, 300);
    debouncer.trigger();
    debouncer.cancel();
    vi.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('probeBoardUpdatedAt', () => {
  it('reports changed=false on 304 and preserves the ETag', async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(304));
    const result = await probeBoardUpdatedAt({
      url: 'https://api.github.com/repos/o/r/issues',
      etag: '"abc"',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.changed).toBe(false);
    expect(result.etag).toBe('"abc"');
    expect(result.status).toBe(304);
  });

  it('reports changed=true on 200 with the new ETag and updatedAt', async () => {
    const body = [{ updated_at: '2026-09-10T16:18:20Z' }];
    const fetchImpl = vi.fn(async () => fakeResponse(200, { etag: '"new"', body }));
    const result = await probeBoardUpdatedAt({
      url: 'https://api.github.com/repos/o/r/issues',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.changed).toBe(true);
    expect(result.etag).toBe('"new"');
    expect(result.lastUpdated).toBe('2026-09-10T16:18:20Z');
  });

  it('sends If-None-Match and Authorization when provided', async () => {
    const fetchImpl = vi.fn(
      async (_url: string, _init?: { headers: Record<string, string> }) => fakeResponse(304),
    );
    await probeBoardUpdatedAt({
      url: 'https://api.github.com/repos/o/r/issues',
      token: 'tok',
      etag: '"e"',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const init = fetchImpl.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers['If-None-Match']).toBe('"e"');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('throws on a non-ok, non-304 response', async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(403));
    await expect(
      probeBoardUpdatedAt({
        url: 'https://api.github.com/repos/o/r/issues',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow('HTTP 403');
  });
});

describe('createBoardSourceController', () => {
  it('probe mode: first probe fetches, a 304 does not refetch', async () => {
    vi.useFakeTimers();
    const responses = [
      fakeResponse(200, { etag: '"a"', body: [{ updated_at: 't1' }] }),
      fakeResponse(304),
    ];
    const fetchImpl = vi.fn(async () => responses.shift() ?? fakeResponse(304));
    const fetchAll = vi.fn(async () => [{ id: 'c1', title: 'Card', status: 'Todo' }]);
    const onCards = vi.fn();
    const onSource = vi.fn();

    const controller = createBoardSourceController({
      kind: 'probe',
      fetchAll,
      onCards,
      onSource,
      probe: { url: 'https://api.github.com/repos/o/r/issues', intervalMs: 10000, fetchImpl: fetchImpl as unknown as typeof fetch },
    });
    controller.start();

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchAll).toHaveBeenCalledTimes(1);
    expect(onCards).toHaveBeenCalledWith([{ id: 'c1', title: 'Card', status: 'Todo' }]);
    expect(onSource).toHaveBeenLastCalledWith('probe');

    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchAll).toHaveBeenCalledTimes(1);

    controller.stop();
    vi.useRealTimers();
  });

  it('webhook mode: refresh reports the webhook source', async () => {
    const fetchAll = vi.fn(async () => []);
    const onSource = vi.fn();
    const controller = createBoardSourceController({
      kind: 'webhook',
      fetchAll,
      onCards: vi.fn(),
      onSource,
    });
    await controller.refresh('webhook');
    expect(onSource).toHaveBeenCalledWith('webhook');
  });

  it('demo mode: start does nothing', async () => {
    const fetchAll = vi.fn(async () => []);
    const onCards = vi.fn();
    const controller = createBoardSourceController({ kind: 'demo', fetchAll, onCards });
    controller.start();
    await Promise.resolve();
    expect(fetchAll).not.toHaveBeenCalled();
    expect(onCards).not.toHaveBeenCalled();
  });

  it('falls back to a full poll when no probe is configured', async () => {
    vi.useFakeTimers();
    const fetchAll = vi.fn(async () => []);
    const controller = createBoardSourceController({
      kind: 'probe',
      fetchAll,
      onCards: vi.fn(),
      fallbackIntervalMs: 60000,
    });
    controller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchAll).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchAll).toHaveBeenCalledTimes(2);
    controller.stop();
    vi.useRealTimers();
  });

  it('collapses concurrent refreshes into one fetch', async () => {
    let resolveFetch: (cards: never[]) => void = () => {};
    const fetchAll = vi.fn(() => new Promise<never[]>((resolve) => { resolveFetch = resolve; }));
    const controller = createBoardSourceController({
      kind: 'webhook',
      fetchAll,
      onCards: vi.fn(),
    });
    const first = controller.refresh('webhook');
    const second = controller.refresh('webhook');
    resolveFetch([]);
    await Promise.all([first, second]);
    expect(fetchAll).toHaveBeenCalledTimes(1);
  });

  it('clamps a non-finite probe interval instead of tight-looping', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => fakeResponse(304));
    const controller = createBoardSourceController({
      kind: 'probe',
      fetchAll: vi.fn(async () => []),
      onCards: vi.fn(),
      probe: {
        url: 'https://api.github.com/repos/o/r/issues',
        intervalMs: Number.NaN,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    });
    controller.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10_000);
    // Initial poll + one tick at the clamped default; a NaN/0 interval would fire repeatedly.
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(2);
    controller.stop();
    vi.useRealTimers();
  });
});
