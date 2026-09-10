// src/boardSource.ts
// BoardSource port: where live board updates come from and how a full
// snapshot is pulled. Replaces the fixed 60s full poll with:
//
// - webhook: a GitHub webhook receiver (issues + projects_v2_item) debounces
//   events and triggers a full fetch + broadcast (the live path).
// - probe: a conditional ETag `updatedAt` request against the repo issues
//   endpoint at ~10s. 304 responses are rate-limit-free, so a full fetch
//   happens only when the board actually changed (the fallback path).
// - demo: nothing is configured; the client falls back to demo data.
//
// The port is deliberately transport-free: the server wires HTTP + WS around
// these helpers, so the classification, signature verification, debounce, and
// conditional-probe logic stay unit-testable.

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { KanbanCard } from './agentTypes.js';

export type BoardSourceKind = 'webhook' | 'probe' | 'demo';

/** Port: the configured delivery path plus a full-snapshot fetch. */
export interface BoardSource {
  readonly kind: BoardSourceKind;
  fetchAll(): Promise<KanbanCard[]>;
}

/** Pick the active source from configuration. */
export function classifyBoardSource(opts: {
  configured: boolean;
  webhookSecret?: string;
}): BoardSourceKind {
  if (!opts.configured) return 'demo';
  return opts.webhookSecret ? 'webhook' : 'probe';
}

/**
 * Node's `IncomingHttpHeaders` values are `string | string[] | undefined`
 * (repeated headers arrive as arrays). Collapse to the first string so callers
 * never pass a non-string into Buffer/string comparisons.
 */
function firstHeaderValue(value: string | string[] | undefined | null): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

/**
 * Verify GitHub's `X-Hub-Signature-256` HMAC over the raw request body.
 * Returns false when the secret or header is missing — callers decide whether
 * an unset secret means "accept unvalidated" (local dev) or reject.
 */
export function verifyWebhookSignature(
  secret: string,
  signatureHeader: string | string[] | undefined | null,
  rawBody: string | Buffer,
): boolean {
  const signature = firstHeaderValue(signatureHeader);
  if (!secret || !signature) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export interface BoardWebhookPayload {
  repository?: { full_name?: string };
}

/**
 * Which GitHub webhook events should trigger a board refetch. The board items
 * ARE this repo's issues, so `issues` is scoped to the watched repo while
 * `projects_v2_item` (column moves) is accepted as-is. `ping` and any other
 * event are ignored.
 */
export function isRelevantBoardEvent(
  eventName: string | string[] | undefined,
  payload: BoardWebhookPayload | undefined,
  repoFullName: string,
): boolean {
  const event = firstHeaderValue(eventName);
  if (event === 'projects_v2_item') return true;
  if (event === 'issues') {
    const full = payload?.repository?.full_name;
    return typeof full === 'string' && full.toLowerCase() === repoFullName.toLowerCase();
  }
  return false;
}

export interface Debouncer {
  trigger(): void;
  cancel(): void;
  pending(): boolean;
}

/** Trailing debounce: coalesces a burst of events into one call. */
export function createDebouncer(fn: () => void, waitMs: number): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    trigger() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, waitMs);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    pending() {
      return timer !== null;
    },
  };
}

export interface ProbeResult {
  changed: boolean;
  etag: string | null;
  lastUpdated?: string;
  status: number;
}

/**
 * One conditional `updatedAt` probe. A 304 means nothing changed since the
 * last ETag; a 200 means the response — and therefore the board — changed.
 */
export async function probeBoardUpdatedAt(opts: {
  url: string;
  token?: string;
  etag?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<ProbeResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'habbo-pixel-agents',
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.etag) headers['If-None-Match'] = opts.etag;

  const res = await fetchImpl(opts.url, { headers });
  if (res.status === 304) {
    return { changed: false, etag: opts.etag ?? null, status: 304 };
  }
  if (!res.ok) {
    throw new Error(`board probe failed: HTTP ${res.status}`);
  }
  const etag = res.headers.get('etag');
  const body = (await res.json()) as Array<{ updated_at?: string }>;
  return {
    changed: true,
    etag: etag ?? null,
    lastUpdated: Array.isArray(body) ? body[0]?.updated_at : undefined,
    status: res.status,
  };
}

export interface BoardProbeConfig {
  url: string;
  token?: string;
  intervalMs: number;
  fetchImpl?: typeof fetch;
}

/** Probe cadence bounds: too-small or non-finite values would tight-loop. */
const DEFAULT_PROBE_INTERVAL_MS = 10_000;
const MIN_PROBE_INTERVAL_MS = 1_000;

/**
 * Clamp a probe interval to a safe positive value. Non-finite, zero, or
 * negative input falls back to the ~10s default; tiny positive values clamp
 * to a 1s floor so a mis-parsed env var cannot hammer the GitHub API.
 */
export function normalizeProbeIntervalMs(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_PROBE_INTERVAL_MS;
  }
  return Math.max(MIN_PROBE_INTERVAL_MS, value);
}

export interface BoardSourceControllerOptions {
  kind: BoardSourceKind;
  fetchAll: () => Promise<KanbanCard[]>;
  onCards: (cards: KanbanCard[]) => void;
  /** Called whenever an update is delivered, naming the path that delivered it. */
  onSource?: (kind: BoardSourceKind) => void;
  probe?: BoardProbeConfig;
  /** Full-poll interval used only when no probe is configured (graceful degradation). */
  fallbackIntervalMs?: number;
  onError?: (err: unknown) => void;
  log?: (message: string) => void;
}

export interface BoardSourceController {
  readonly kind: BoardSourceKind;
  refresh(source?: BoardSourceKind): Promise<void>;
  start(): void;
  stop(): void;
}

/**
 * Drive a board source: an initial full fetch, a ~10s conditional probe when
 * configured, and an exposed `refresh` the webhook receiver calls after
 * debouncing. Probe and webhook share one controller so concurrent refreshes
 * collapse into a single in-flight fetch.
 */
export function createBoardSourceController(
  opts: BoardSourceControllerOptions,
): BoardSourceController {
  const log = opts.log ?? (() => {});
  const onError = opts.onError ?? (() => {});
  let timer: ReturnType<typeof setInterval> | null = null;
  let etag: string | null = null;
  let stopped = false;
  let inFlight: Promise<void> | null = null;

  async function refresh(source: BoardSourceKind = opts.kind): Promise<void> {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const cards = await opts.fetchAll();
        opts.onCards(cards);
        opts.onSource?.(source);
      } catch (err) {
        onError(err);
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  async function poll(): Promise<void> {
    if (stopped || !opts.probe) return;
    try {
      const result = await probeBoardUpdatedAt({
        url: opts.probe.url,
        token: opts.probe.token,
        etag,
        fetchImpl: opts.probe.fetchImpl,
      });
      etag = result.etag;
      if (result.changed) {
        log(`[BoardSource] probe: change detected (updatedAt=${result.lastUpdated ?? 'n/a'})`);
        await refresh('probe');
      }
    } catch (err) {
      onError(err);
    }
  }

  return {
    kind: opts.kind,
    refresh,
    start() {
      if (opts.kind === 'demo') return;
      if (opts.probe) {
        const intervalMs = normalizeProbeIntervalMs(opts.probe.intervalMs);
        void poll();
        timer = setInterval(() => void poll(), intervalMs);
      } else {
        void refresh(opts.kind);
        if (opts.fallbackIntervalMs && opts.fallbackIntervalMs > 0) {
          timer = setInterval(() => void refresh(opts.kind), opts.fallbackIntervalMs);
        }
      }
    },
    stop() {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
