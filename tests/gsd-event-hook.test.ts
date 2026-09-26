// tests/gsd-event-hook.test.ts
// Integration test for the guarded GitHub reactions in the event hook:
// fixture event log + stub gh on PATH; the live path (--once --github) must
// label, comment and close exactly once, and dedupe on re-run.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
    expect(record).toEqual([
      'issue edit 110 --add-label gsd:synced',
      'issue comment 110 --body GSD: M005/S06 completed — this issue is being closed to match GSD state. <!-- gsd-sync -->',
      'issue close 110',
    ]);
    expect(readFileSync(statePath, 'utf8')).toContain('uat-hook-1');

    const out2 = runHook(['--once', '--github', '--event-log', logPath, '--state', statePath]);
    expect(out2).toContain('already handled');
    expect(readFileSync(recordFile, 'utf8').trim().split('\n')).toHaveLength(3);

    rmSync(dir, { recursive: true, force: true });
  });
});
