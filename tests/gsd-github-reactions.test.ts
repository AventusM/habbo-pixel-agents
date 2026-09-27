// tests/gsd-github-reactions.test.ts
// Guards for the GSD→GitHub reaction classifier (M005/S06): command mapping,
// loop guards, marker, and title matching against the prefix convention.

import { describe, it, expect } from 'vitest';
import {
  classifyGsdEvent,
  buildReactionComment,
  matchesIssueTitle,
} from '../scripts/gsd-github-reactions.mjs';

const entry = (over: Record<string, unknown> = {}) => ({
  v: 2,
  cmd: 'complete-slice',
  params: { milestoneId: 'M005', sliceId: 'S06' },
  ts: '2026-09-26T10:00:00Z',
  actor: 'agent',
  hash: 'abc123',
  session_id: 's1',
  ...over,
});

describe('classifyGsdEvent', () => {
  it('maps complete-slice to comment + close', () => {
    const reaction = classifyGsdEvent(entry());
    expect(reaction).toMatchObject({
      kind: 'gsd-github-reaction',
      cmd: 'complete-slice',
      milestoneId: 'M005',
      sliceId: 'S06',
      close: true,
      verb: 'completed',
      hop: 1,
      key: 'abc123',
    });
  });

  it('maps skip-slice to comment only', () => {
    const reaction = classifyGsdEvent(entry({ cmd: 'skip-slice' }));
    expect(reaction?.close).toBe(false);
    expect(reaction?.verb).toBe('skipped');
  });

  it('ignores unknown commands', () => {
    expect(classifyGsdEvent(entry({ cmd: 'plan-slice' }))).toBeNull();
    expect(classifyGsdEvent(entry({ cmd: 'complete-task' }))).toBeNull();
  });

  it('requires milestone, slice and hash', () => {
    expect(classifyGsdEvent(entry({ params: { milestoneId: 'M005' } }))).toBeNull();
    expect(classifyGsdEvent(entry({ params: {} }))).toBeNull();
    expect(classifyGsdEvent(entry({ hash: undefined }))).toBeNull();
    expect(classifyGsdEvent(null)).toBeNull();
  });

  it('never echoes github-sync actors (one hop max)', () => {
    expect(classifyGsdEvent(entry({ actor: 'github-sync' }))).toBeNull();
  });
});

describe('buildReactionComment', () => {
  it('carries the gsd-sync marker and the canonical delivered head', () => {
    const comment = buildReactionComment(classifyGsdEvent(entry())!);
    expect(comment).toContain('gsd-sync: M005/S06 delivered');
    expect(comment).toContain('<!-- gsd-sync -->');
    expect(comment).toContain('gsd-key: abc123');
    expect(comment).toContain('closing to match');
  });

  it('describes seal-skipped without a close', () => {
    const comment = buildReactionComment(classifyGsdEvent(entry({ cmd: 'skip-slice' }))!);
    expect(comment).toContain('gsd-sync: M005/S06 sealed skipped');
    expect(comment).toContain('leaving the issue open');
    expect(comment).toContain('<!-- gsd-sync -->');
  });

  it('names merge commit and evidence on delivered, reasons on skipped', () => {
    const delivered = buildReactionComment(classifyGsdEvent(entry())!, {
      mergeSha: 'abc1234',
      evidence: 'O-1 done',
    });
    expect(delivered).toContain('abc1234');
    expect(delivered).toContain('O-1 done');
    const skipped = buildReactionComment(classifyGsdEvent(entry({ cmd: 'skip-slice' }))!, {
      reasons: 'waiting on S01',
    });
    expect(skipped).toContain('waiting on S01');
  });
});

describe('isIssueTerminal', () => {
  it('skips already-closed issues', async () => {
    const { isIssueTerminal } = await import('../scripts/gsd-github-reactions.mjs');
    expect(isIssueTerminal({ state: 'CLOSED' })).toBe(true);
    expect(isIssueTerminal({ state: 'closed' })).toBe(true);
    expect(isIssueTerminal({ state: 'OPEN' })).toBe(false);
    expect(isIssueTerminal(null)).toBe(false);
  });
});

describe('matchesIssueTitle', () => {
  const reaction = classifyGsdEvent(entry())!;

  it('matches the exact slice prefix', () => {
    expect(matchesIssueTitle('M005/S06: GSD→GitHub hook reactions', reaction)).toBe(true);
  });

  it('rejects other slices, milestone-only and unprefixed titles', () => {
    expect(matchesIssueTitle('M005/S07: Backfill + UAT round-trip', reaction)).toBe(false);
    expect(matchesIssueTitle('M005: GSD↔GitHub Two-Way Sync', reaction)).toBe(false);
    expect(matchesIssueTitle('regular issue', reaction)).toBe(false);
  });
});
