// tests/exp-dispatch.test.ts
// Hermetic tests for scripts/exp/dispatch.mjs: plan two models with --dry-run,
// validate arguments, and run a full dispatch + cleanup cycle inside a
// throwaway git repo (no network, no touch of the real checkout).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let dir = '';
let repo = '';
let runs = '';
let wt = '';
let bodyFile = '';

const SCRIPT = ['scripts/exp/dispatch.mjs'];

function run(args: string[], cwd: string) {
  return execFileSync('node', [...SCRIPT.map((s) => join(process.cwd(), s)), ...args], {
    encoding: 'utf8',
    cwd,
    env: { ...process.env },
  });
}

function runFail(args: string[], cwd: string) {
  return spawnSync('node', [...SCRIPT.map((s) => join(process.cwd(), s)), ...args], {
    encoding: 'utf8',
    cwd,
  });
}

function git(args: string[], cwd: string) {
  return execFileSync('git', args, { encoding: 'utf8', cwd });
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'exp-dispatch-'));
  repo = join(dir, 'repo');
  runs = join(dir, 'runs');
  wt = join(dir, 'wt');
  mkdirSync(repo, { recursive: true });
  git(['init', '-q'], repo);
  git(['config', 'user.email', 't@t.t'], repo);
  git(['config', 'user.name', 't'], repo);
  writeFileSync(join(repo, 'f.txt'), 'x\n');
  git(['add', '.'], repo);
  git(['commit', '-qm', 'init'], repo);
  bodyFile = join(dir, 'issue.txt');
  writeFileSync(bodyFile, 'Some title\n\n## Outcomes\n- [ ] do the thing\n');
});

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const BASE = ['--repo', '__REPO__', '--runs-dir', '__RUNS__', '--worktree-root', '__WT__'];
function loc(): string[] {
  return BASE.flatMap((s) =>
    s === '__REPO__' ? [repo] : s === '__RUNS__' ? [runs] : s === '__WT__' ? [wt] : [s],
  );
}

describe('dispatch', () => {
  it('dry-run plans one run per model with exp branch names', () => {
    const out = run(
      [
        '--issue', '97',
        '--models', 'opencode-go/deepseek-v4-flash,opencode-go/kimi-k2.7-code',
        '--run', '20260912-153000',
        '--issue-body-file', bodyFile,
        '--dry-run',
        ...loc(),
      ],
      dir,
    );
    expect(out).toMatch(/RUN exp-20260912-153000-97-opencode-go-deepseek-v4-flash exp\/97-opencode-go-deepseek-v4-flash-20260912-153000/);
    expect(out).toMatch(/RUN exp-20260912-153000-97-opencode-go-kimi-k2\.7-code exp\/97-opencode-go-kimi-k2\.7-code-20260912-153000/);
    expect(out).toMatch(/DRY-RUN \(no writes\)/);
    expect(existsSync(wt)).toBe(false);
    expect(existsSync(runs)).toBe(false);
  });

  it('rejects a bad issue number and a model without provider prefix', () => {
    const r1 = runFail(['--issue', '0', '--models', 'opencode-go/x', ...loc()], dir);
    expect(r1.status).toBe(2);
    const r2 = runFail(['--issue', '97', '--models', 'plainname', ...loc()], dir);
    expect(r2.status).toBe(2);
    expect(String(r2.stderr)).toMatch(/opencode-go/);
  });

  it('full cycle: dispatch writes worktrees + registry + prompts, cleanup removes lanes and keeps records', () => {
    const out = run(
      [
        '--issue', '97',
        '--models', 'opencode-go/deepseek-v4-flash,opencode-go/kimi-k2.7-code',
        '--run', '20260912-153001',
        '--issue-body-file', bodyFile,
        ...loc(),
      ],
      dir,
    );
    expect(out).toMatch(/OPERATOR next/);
    for (const s of ['opencode-go-deepseek-v4-flash', 'opencode-go-kimi-k2.7-code']) {
      const runId = `exp-20260912-153001-97-${s}`;
      expect(existsSync(join(wt, runId))).toBe(true);
      const meta = JSON.parse(readFileSync(join(runs, `${runId}.meta.json`), 'utf8'));
      expect(meta.branch).toBe(`exp/97-${s}-20260912-153001`);
      expect(meta.issue).toBe(97);
      expect(meta.base_sha).toMatch(/^[0-9a-f]{40}$/);
      const prompt = readFileSync(join(runs, `${runId}.prompt.md`), 'utf8');
      expect(prompt).toContain(`export EXP_RUN_ID=${runId}`);
      expect(prompt).toContain('export EXP_ISSUE=97');
      expect(prompt).toContain(`--run-id ${runId} --issue 97 --model opencode-go/`);
      expect(prompt).toContain('never git add -A');
      expect(prompt).toContain('Draft PR only. NEVER merge');
      expect(prompt).toContain('## Outcomes');
    }
    const branches = git(['branch', '--list', 'exp/97-*'], repo);
    expect(branches).toMatch(/exp\/97-opencode-go-deepseek-v4-flash-20260912-153001/);

    const clean = run(['--cleanup', '--issue', '97', '--run', '20260912-153001', ...loc()], dir);
    expect(clean).toMatch(/removed 2 worktree/);
    expect(existsSync(join(wt, 'exp-20260912-153001-97-opencode-go-deepseek-v4-flash'))).toBe(false);
    expect(git(['branch', '--list', 'exp/97-*'], repo)).toBe('');
    // Records are evaluation artifacts: kept.
    expect(existsSync(join(runs, 'exp-20260912-153001-97-opencode-go-deepseek-v4-flash.meta.json'))).toBe(true);
  });
});
