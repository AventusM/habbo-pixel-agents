// tests/health.test.ts
// Unit tests for the standalone web server's /health payload builder.

import { describe, it, expect } from 'vitest';
import { buildHealthPayload } from '../src/health.js';

describe('buildHealthPayload', () => {
  it('reports ok with the normalized counters', () => {
    expect(
      buildHealthPayload({ uptimeSeconds: 12.9, boardSource: 'probe', clients: 3, port: 3000 }),
    ).toEqual({
      status: 'ok',
      uptimeSeconds: 12,
      boardSource: 'probe',
      clients: 3,
      port: 3000,
    });
  });

  it('reports unset board source before any path delivers an update', () => {
    expect(
      buildHealthPayload({ uptimeSeconds: 0, boardSource: null, clients: 0, port: 3000 })
        .boardSource,
    ).toBe('unset');
    expect(
      buildHealthPayload({ uptimeSeconds: 0, clients: 0, port: 3000 }).boardSource,
    ).toBe('unset');
  });

  it('passes through every live board source', () => {
    for (const source of ['webhook', 'probe', 'demo'] as const) {
      expect(
        buildHealthPayload({ uptimeSeconds: 1, boardSource: source, clients: 0, port: 80 })
          .boardSource,
      ).toBe(source);
    }
  });

  it('clamps non-finite or negative counters to zero', () => {
    expect(
      buildHealthPayload({
        uptimeSeconds: Number.NaN,
        boardSource: 'demo',
        clients: -2,
        port: 3000,
      }),
    ).toMatchObject({ uptimeSeconds: 0, clients: 0 });
  });
});
