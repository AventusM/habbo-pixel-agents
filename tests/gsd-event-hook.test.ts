// tests/gsd-event-hook.test.ts
// Integration test for the guarded GitHub reactions in the event hook:
// fixture event log + stub gh on PATH; the live path (--once --github) must
// label, comment and close exactly once, and dedupe on re-run.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let stubDir = '';
let recordFile = '';

const STUB = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === 'label' && args[1] === 'create') process.exit(1); // pretend it already exists
if (args[0] === 'issue' && args[1] === 'list') {
  process.stdout.write(JSON.stringify([
    { number: 110, title: 'M005/S06: GSD→GitHub hook reactions', state: 'OPEN' },
    { number: 123, title: 'M008/S02: Presentational split of room chrome', state: 'OPEN' },
  ]));
  process.exit(0);
}
if (args[0] === 'issue' && ['edit', 'comment', 'close'].includes(args[1])) {
  fs.appendFileSync(process.env.GH_RECORD_FILE, args.join(' ') + '\\n');
  process.exit(0);
}
console.error('stub gh: unexpected ' + args.join(' '));
process.exit(3);
`;

beforeAll(() => {
  stubDir = mkdtempSync(join(tmpdir(), 'gsd-hook-stub-'));
  const ghPath = join(stubDir, 'gh');
  writeFileSync(ghPath, STUB);
  chmodSync(ghPath, 0o755);
  recordFile = join(stubDir, 'record.txt');
  writeFileSync(recordFile, '');
});

afterAll(() => {
  if (stubDir) rmSync(stubDir, { recursive: true, force: true });
});

beforeEach(() => {
  writeFileSync(recordFile, '');
});

function runHook(args: string[]): string {
  return execFileSync('node', ['scripts/hooks/gsd-event-hook.mjs', ...args], {
    encoding: 'utf8',
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: `${stubDir}:${process.env.PATH}`,
      GH_RECORD_FILE: recordFile,
    },
  });
}

describe('gsd-event-hook github reactions', () => {
  it('labels, comments and closes the matched issue exactly once', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gsd-hook-fx-'));
    const logPath = join(dir, 'event-log.jsonl');
    const statePath = join(dir, 'state.json');
    writeFileSync(
      logPath,
      JSON.stringify({
        v: 2,
        cmd: 'complete-slice',
        params: { milestoneId: 'M005', sliceId: 'S06' },
        ts: '2026-09-26T12:00:00Z',
        actor: 'agent',
        hash: 'uat-hook-1',
        session_id: 'test',
      }) + '\n',
    );

    const out = runHook(['--once', '--github', '--event-log', logPath, '--state', statePath]);
    expect(out).toContain('commented + closed');

    const record = readFileSync(recordFile, 'utf8').trim().split('\n');
    expect(record[0]).toBe('issue edit 110 --add-label gsd:synced');
    expect(record[1]).toContain('issue comment 110 --body gsd-sync: M005/S06 delivered');
    expect(record[1]).toContain('<!-- gsd-sync -->');
    expect(record[2]).toBe('issue close 110');
    expect(readFileSync(statePath, 'utf8')).toContain('uat-hook-1');

    const out2 = runHook(['--once', '--github', '--event-log', logPath, '--state', statePath]);
    expect(out2).toContain('already handled');
    expect(readFileSync(recordFile, 'utf8').trim().split('\n')).toHaveLength(3);

    rmSync(dir, { recursive: true, force: true });
  });
});

describe('gsd-event-hook synthetic seal (continuation lane)', () => {
  function sealArgs(seal: string): { args: string[]; statePath: string; dir: string } {
    const dir = mkdtempSync(join(tmpdir(), 'gsd-seal-fx-'));
    const statePath = join(dir, 'state.json');
    return {
      dir,
      statePath,
      args: ['--github', '--milestone', 'M008', '--slice', 'S02', '--seal', seal, '--state', statePath],
    };
  }

  it('skip seal comments without closing, and dedupes on re-run', () => {
    const { dir, args } = sealArgs('skipped');
    expect(runHook(args)).toContain('#123 commented');
    const lines = readFileSync(recordFile, 'utf8').trim().split('\n');
    expect(lines[0]).toBe('issue edit 123 --add-label gsd:synced');
    expect(lines[1]).toContain('issue comment 123 --body gsd-sync: M008/S02 sealed skipped');
    expect(lines[1]).toContain('<!-- gsd-sync -->');
    expect(lines).toHaveLength(2);
    expect(runHook(args)).toContain('already handled');
    expect(readFileSync(recordFile, 'utf8').trim().split('\n')).toHaveLength(2);
    rmSync(dir, { recursive: true, force: true });
  });

  it('complete seal comments and closes', () => {
    const { dir, args } = sealArgs('completed');
    expect(runHook(args)).toContain('#123 commented + closed');
    const lines = readFileSync(recordFile, 'utf8').trim().split('\n');
    expect(lines[0]).toBe('issue edit 123 --add-label gsd:synced');
    expect(lines[1]).toContain('issue comment 123 --body gsd-sync: M008/S02 delivered');
    expect(lines[1]).toContain('<!-- gsd-sync -->');
    expect(lines[2]).toBe('issue close 123');
    rmSync(dir, { recursive: true, force: true });
  });

  it('does nothing without --github or --dry-run', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gsd-seal-fx-'));
    const statePath = join(dir, 'state.json');
    const out = runHook(['--milestone', 'M008', '--slice', 'S02', '--seal', 'skipped', '--state', statePath]);
    expect(out).toContain('nothing to do');
    expect(readFileSync(recordFile, 'utf8').trim()).toBe('');
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports no matching issue without acting', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gsd-seal-fx-'));
    const statePath = join(dir, 'state.json');
    const out = runHook(['--github', '--milestone', 'M999', '--slice', 'S01', '--seal', 'skipped', '--state', statePath]);
    expect(out).toContain('no matching issue');
    expect(readFileSync(recordFile, 'utf8').trim()).toBe('');
    rmSync(dir, { recursive: true, force: true });
  });
});
