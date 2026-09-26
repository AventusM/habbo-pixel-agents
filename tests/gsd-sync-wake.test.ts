// tests/gsd-sync-wake.test.ts
// Consumer wake for the GitHub→GSD inbox (Q14): pure filters/formatting plus a
// CLI smoke on temp files (marks seen once, quiet on re-run, --no-mark reads only).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseInbox,
  collectPending,
  formatWake,
  markSeen,
} from '../scripts/gsd-sync-wake.mjs';

const intent = (over: Record<string, unknown> = {}) => ({
  v: 1,
  kind: 'github-sync-intent',
  ts: '2026-09-26T09:34:30.449Z',
  action: 'issues.closed',
  issue: 118,
  milestoneId: 'M099',
  sliceId: 'S01',
  key: 'k1',
  ...over,
});

describe('parseInbox', () => {
  it('parses valid lines and skips noise', () => {
    const text = [
      JSON.stringify(intent()),
      '',
      'not json',
      JSON.stringify({ no: 'key' }),
    ].join('\n');
    const parsed = parseInbox(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].key).toBe('k1');
  });
});

describe('collectPending', () => {
  it('filters seen keys and sorts newest first', () => {
    const older = intent({ key: 'a', ts: '2026-09-26T09:00:00Z' });
    const newer = intent({ key: 'b', ts: '2026-09-26T10:00:00Z' });
    const seen = intent({ key: 'c', ts: '2026-09-26T11:00:00Z' });
    const pending = collectPending([older, seen, newer], { c: 'x' });
    expect(pending.map((p) => p.key)).toEqual(['b', 'a']);
  });
});

describe('formatWake', () => {
  it('returns null when nothing is pending', () => {
    expect(formatWake([])).toBeNull();
    expect(formatWake(null)).toBeNull();
  });

  it('caps long lists and reports the remainder', () => {
    const many = Array.from({ length: 7 }, (_, i) => intent({ key: `k${i}`, issue: 100 + i }));
    const note = formatWake(many)!;
    expect(note).toContain('7 pending transitions');
    expect(note).toContain('…and 2 more');
  });

  it('labels the linked target', () => {
    const note = formatWake([intent()])!;
    expect(note).toContain('#118 (M099/S01) issues.closed');
  });
});

describe('markSeen', () => {
  it('returns a new map without mutating the input', () => {
    const seen = { old: 'y' };
    const next = markSeen(seen, [intent()], '2026-09-26T12:00:00Z');
    expect(next).toEqual({ old: 'y', k1: '2026-09-26T12:00:00Z' });
    expect(seen).toEqual({ old: 'y' });
  });
});

describe('CLI', () => {
  let dir = '';
  let inbox = '';

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'gsd-wake-'));
    inbox = join(dir, 'inbox.jsonl');
    writeFileSync(inbox, JSON.stringify(intent()) + '\n');
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('prints the wake note, marks seen, and goes quiet on a re-run', () => {
    const seen = join(dir, 'seen.json');
    const first = execFileSync(
      'node',
      ['scripts/hooks/gsd-sync-wake.mjs', '--inbox', inbox, '--seen', seen],
      { encoding: 'utf8' },
    ).trim();
    expect(first).toContain('#118 (M099/S01) issues.closed');
    expect(JSON.parse(readFileSync(seen, 'utf8'))).toHaveProperty('k1');

    const second = execFileSync(
      'node',
      ['scripts/hooks/gsd-sync-wake.mjs', '--inbox', inbox, '--seen', seen],
      { encoding: 'utf8' },
    ).trim();
    expect(second).toBe('');
  });

  it('--no-mark prints without consuming', () => {
    const dir2 = mkdtempSync(join(tmpdir(), 'gsd-wake2-'));
    const seen2 = join(dir2, 'seen.json');
    const out = execFileSync(
      'node',
      ['scripts/hooks/gsd-sync-wake.mjs', '--inbox', inbox, '--seen', seen2, '--no-mark'],
      { encoding: 'utf8' },
    ).trim();
    expect(out).toContain('#118');
    let existed = true;
    try {
      readFileSync(seen2, 'utf8');
    } catch {
      existed = false;
    }
    expect(existed).toBe(false);
    rmSync(dir2, { recursive: true, force: true });
  });
});
