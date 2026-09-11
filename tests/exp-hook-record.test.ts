// tests/exp-hook-record.test.ts
// Unit tests for scripts/exp/hook-record.mjs: deterministic turn-end capture.
// Simulates spec, worker, and review stop-hooks appending section records,
// plus the silent skip when no run id is present and rejection of bad input.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let dir = '';

function cleanEnv() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k === 'EXP_RUN_ID' || k === 'EXP_ISSUE' || k === 'EXP_PATH' || k === 'EXP_MODEL' || k === 'EXP_OUT') {
      delete env[k];
    }
  }
  return env;
}

function hook(args: string[], out: string) {
  return execFileSync('node', ['scripts/exp/hook-record.mjs', '--out', out, ...args], {
    encoding: 'utf8',
    cwd: process.cwd(),
    env: cleanEnv(),
  });
}

function lines(out: string) {
  return readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'exp-hook-'));
});

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('hook-record', () => {
  it('appends spec, worker, and review turn-end records for one run', () => {
    const out = join(dir, 'run.jsonl');
    const run = ['--run-id', 'exp-test-hook', '--issue', '80', '--model', 'opencode-go/deepseek-flash', '--path', 'gsd-loop'];

    hook(['--section', 'spec', '--result', 'done', '--summary', 'contract: 7 outcomes, no Fly.io', ...run], out);
    hook(
      [
        '--section', 'build', '--result', 'done',
        '--summary', 'branch exp/80-flash, 605 tests pass',
        '--tests', '605 passed', '--branch', 'exp/80-flash', '--pr', '99',
        ...run,
      ],
      out,
    );
    hook(
      ['--section', 'review', '--result', 'approved', '--summary', 'verdict clean', '--verdict', 'abc123', ...run],
      out,
    );

    const recs = lines(out);
    expect(recs).toHaveLength(3);
    expect(recs.map((r: { section: string }) => r.section)).toEqual(['spec', 'build', 'review']);
    for (const r of recs) {
      expect(r.run_id).toBe('exp-test-hook');
      expect(r.issue).toBe(80);
      expect(r.model).toBe('opencode-go/deepseek-flash');
      expect(new Date(r.ended_at).getTime()).not.toBeNaN();
    }
    expect(recs[1].tests).toBe('605 passed');
    expect(recs[1].pr).toBe(99);
    expect(recs[2].verdict).toBe('abc123');
  });

  it('skips silently with exit 0 when no run id is present', () => {
    const out = join(dir, 'norun.jsonl');
    const res = spawnSync(
      'node',
      ['scripts/exp/hook-record.mjs', '--out', out, '--section', 'build', '--result', 'done'],
      { encoding: 'utf8', cwd: process.cwd(), env: cleanEnv() },
    );
    expect(res.status).toBe(0);
    expect(existsSync(out)).toBe(false);
    expect(String(res.stderr)).toMatch(/no run id/i);
  });

  it('writes nothing under scripts/exp/runs/ when no run id is present', () => {
    const runs = join('scripts', 'exp', 'runs');
    const before = existsSync(runs) ? readdirSync(runs) : [];
    const res = spawnSync(
      'node',
      ['scripts/exp/hook-record.mjs', '--section', 'build', '--result', 'done'],
      { encoding: 'utf8', cwd: process.cwd(), env: cleanEnv() },
    );
    expect(res.status).toBe(0);
    expect(String(res.stderr)).toMatch(/no run id/i);
    const after = existsSync(runs) ? readdirSync(runs) : [];
    expect(after).toEqual(before);
  });

  it('emits a run record carrying the schema-required keys (run_id, issue, path, model, sections)', () => {
    const out = join(dir, 'shape.jsonl');
    const run = [
      '--run-id', 'exp-20260911-97-hook-shape',
      '--issue', '97',
      '--path', 'direct',
      '--model', 'opencode-go/deepseek-v4-flash',
    ];

    hook(['--section', 'spec', '--result', 'done', '--summary', 'fixture spec entry', ...run], out);
    hook(
      [
        '--section', 'build', '--result', 'done',
        '--summary', 'fixture build entry', '--tests', '2 passed', ...run,
      ],
      out,
    );

    const recs = lines(out);
    expect(recs).toHaveLength(2);

    for (const r of recs) {
      expect(r.run_id).toBe('exp-20260911-97-hook-shape');
      expect(r.issue).toBe(97);
      expect(r.path).toBe('direct');
      expect(r.model).toBe('opencode-go/deepseek-v4-flash');
    }

    const runRecord = {
      run_id: recs[0].run_id,
      issue: recs[0].issue,
      path: recs[0].path,
      model: recs[0].model,
      sections: recs,
    };
    for (const k of ['run_id', 'issue', 'path', 'model', 'sections']) {
      expect(runRecord).toHaveProperty(k);
    }
    expect(runRecord.sections.map((s: { section: string }) => s.section)).toEqual(['spec', 'build']);
  });

  it('rejects an unknown section', () => {
    const out = join(dir, 'bad.jsonl');
    expect(() =>
      hook(['--section', 'nope', '--result', 'done', '--run-id', 'exp-test-bad'], out),
    ).toThrow();
    expect(existsSync(out)).toBe(false);
  });
});
