// src/health.ts
// Health payload for the standalone web server's `GET /health` endpoint.
//
// Deliberately transport-free (same posture as src/boardSource.ts): the server
// wires HTTP around this helper so the payload shape and board-source reporting
// stay unit-testable without booting a listening socket. Tailscale/service
// health checks read the emitted JSON.

import type { BoardSourceKind } from './boardSource.js';

/** `unset` means no live board path has reported yet (e.g. ADO full-poll only). */
export type HealthBoardSource = BoardSourceKind | 'unset';

export interface HealthPayload {
  status: 'ok';
  uptimeSeconds: number;
  boardSource: HealthBoardSource;
  clients: number;
  port: number;
}

function nonNegativeInt(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

/**
 * Build the `/health` body. The endpoint always reports `status: ok` because
 * reaching the handler already proves the process is serving; uptime and client
 * counts are normalized to non-negative integers so a bad input cannot produce
 * an invalid payload.
 */
export function buildHealthPayload(opts: {
  uptimeSeconds: number;
  boardSource?: BoardSourceKind | null;
  clients: number;
  port: number;
}): HealthPayload {
  return {
    status: 'ok',
    uptimeSeconds: nonNegativeInt(opts.uptimeSeconds),
    boardSource: opts.boardSource ?? 'unset',
    clients: nonNegativeInt(opts.clients),
    port: opts.port,
  };
}
