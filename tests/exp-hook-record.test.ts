// tests/exp-hook-record.test.ts
// Unit tests for scripts/exp/hook-record.mjs: deterministic turn-end capture.
// Simulates spec, worker, and review stop-hooks appending section records,
// plus the silent skip when no run id is present and rejection of bad input.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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

  it('rejects an unknown section', () => {
    const out = join(dir, 'bad.jsonl');
    expect(() =>
      hook(['--section', 'nope', '--result', 'done', '--run-id', 'exp-test-bad'], out),
    ).toThrow();
    expect(existsSync(out)).toBe(false);
  });

  // Issue #97, outcome 1: invoking hook-record with no --run-id and no EXP_RUN_ID
  // must exit 0 and write nothing under the default scripts/exp/runs/ directory.
  // (The existing "skips silently with exit 0" case passes --out explicitly; this
  // case proves the default-out branch is also a no-op.)
  it('exits 0 with no --run-id and no EXP_RUN_ID, writing nothing under scripts/exp/runs/', () => {
    const runsDir = resolve(process.cwd(), 'scripts/exp/runs');
    const snapshot = (): string[] =>
      existsSync(runsDir) ? readdirSync(runsDir).sort() : [];
    const before = snapshot();
    const res = spawnSync(
      'node',
      ['scripts/exp/hook-record.mjs', '--section', 'build', '--result', 'done'],
      { encoding: 'utf8', cwd: process.cwd(), env: cleanEnv() },
    );
    const after = snapshot();
    expect(res.status).toBe(0);
    expect(res.stderr).toMatch(/no run id/i);
    expect(after).toEqual(before);
  });

  // Issue #97, outcome 2: an emitted record conforms to the schema-required keys
  // declared in scripts/exp/schema.json (run_id, issue, path, model, sections).
  // The hook emits one section record per call, so the section-level keys
  // (run_id, issue, path, model) appear on the record itself; the aggregate
  // `sections` key is enforced at the schema level and the section record also
  // carries the section-level required keys (section, result) plus the
  // started_at/ended_at date-time fields used downstream.
  it('emitted record carries schema-required keys run_id, issue, path, model (plus section/result)', () => {
    const schema = JSON.parse(
      readFileSync(resolve(process.cwd(), 'scripts/exp/schema.json'), 'utf8'),
    );
    expect(schema.required).toEqual(['run_id', 'issue', 'path', 'model', 'sections']);
    expect(schema.properties.sections.items.required).toEqual(['section', 'result']);

    const out = join(dir, 'shape.jsonl');
    const run = [
      '--run-id', 'exp-shape-test',
      '--issue', '97',
      '--model', 'opencode-go/minimax-m3',
      '--path', 'direct',
    ];
    hook(['--section', 'build', '--result', 'done', '--summary', 'schema shape check', ...run], out);

    const recs = lines(out);
    expect(recs).toHaveLength(1);
    const r = recs[0];

    for (const k of ['run_id', 'issue', 'path', 'model']) {
      expect(r).toHaveProperty(k);
    }
    expect(r.run_id).toBe('exp-shape-test');
    expect(r.issue).toBe(97);
    expect(r.path).toBe('direct');
    expect(r.model).toBe('opencode-go/minimax-m3');

    expect(r.section).toBe('build');
    expect(r.result).toBe('done');

    expect(new Date(r.started_at).getTime()).not.toBeNaN();
    expect(new Date(r.ended_at).getTime()).not.toBeNaN();
  });
});
