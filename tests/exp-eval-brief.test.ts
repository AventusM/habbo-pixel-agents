// tests/exp-eval-brief.test.ts
// Hermetic tests for scripts/exp/eval-brief.mjs: dry-run planning,
// reviewer/build-model disjoint refusal, and a full briefing cycle inside
// throwaway dirs (PR via --pr-file, no network, no touch of real checkout).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let dir = '';
let repo = '';
let runs = '';
let wt = '';

const RUN_ID = 'exp-20260912-153002-97-opencode-go-deepseek-v4-flash';
const BUILD_MODEL = 'opencode-go/deepseek-v4-flash';

function script(): string[] {
  return ['node', join(process.cwd(), 'scripts/exp/eval-brief.mjs')];
}

function git(args: string[], cwd: string) {
  return execFileSync('git', args, { encoding: 'utf8', cwd });
}

function loc(): string[] {
  return ['--repo', repo, '--runs-dir', runs, '--worktree-root', wt];
}

function prFileFor(sha: string): string {
  const p = join(dir, 'pr.json');
  writeFileSync(
    p,
    JSON.stringify({ number: 100, title: 'exp PR', headSha: sha, headRefName: 'exp/x', baseRefName: 'main', url: 'https://example.test/pr/100' }),
  );
  return p;
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'exp-eval-'));
  repo = join(dir, 'repo');
  runs = join(dir, 'runs');
  wt = join(dir, 'wt');
  mkdirSync(repo, { recursive: true });
  mkdirSync(runs, { recursive: true });
  git(['init', '-q'], repo);
  git(['config', 'user.email', 't@t.t'], repo);
  git(['config', 'user.name', 't'], repo);
  writeFileSync(join(repo, 'f.txt'), 'x\n');
  git(['add', '.'], repo);
  git(['commit', '-qm', 'init'], repo);
  writeFileSync(
    join(runs, `${RUN_ID}.meta.json`),
    JSON.stringify({ run_id: RUN_ID, issue: 97, model: BUILD_MODEL, branch: 'exp/97-x', base_sha: '0'.repeat(40) }),
  );
});

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('eval-brief', () => {
  it('dry-run plans the eval without writes', () => {
    const sha = git(['rev-parse', 'HEAD'], repo).trim();
    const out = execFileSync(
      'node',
      [...script().slice(1), '--pr-file', prFileFor(sha), '--run-id', RUN_ID, '--dry-run', ...loc()],
      { encoding: 'utf8', cwd: dir },
    );
    expect(out).toMatch(new RegExp(`EVAL ${RUN_ID} pr=100 model=opencode-go/kimi-k3`));
    expect(out).toMatch(/DRY-RUN \(no writes\)/);
    expect(existsSync(join(wt, '.eval'))).toBe(false);
  });

  it('refuses a reviewer model equal to the build model', () => {
    const sha = git(['rev-parse', 'HEAD'], repo).trim();
    const r = spawnSync(
      'node',
      [...script().slice(1), '--pr-file', prFileFor(sha), '--run-id', RUN_ID, '--model', BUILD_MODEL, ...loc()],
      { encoding: 'utf8', cwd: dir },
    );
    expect(r.status).toBe(2);
    expect(String(r.stderr)).toMatch(/disjoint/);
  });

  it('full cycle writes detached worktree + prompt; cleanup keeps the prompt', () => {
    const sha = git(['rev-parse', 'HEAD'], repo).trim();
    const out = execFileSync(
      'node',
      [...script().slice(1), '--pr-file', prFileFor(sha), '--run-id', RUN_ID, ...loc()],
      { encoding: 'utf8', cwd: dir },
    );
    expect(out).toMatch(/OPERATOR next/);
    const lane = join(wt, '.eval', `${RUN_ID}-eval`);
    expect(existsSync(lane)).toBe(true);
    expect(git(['rev-parse', 'HEAD'], lane).trim()).toBe(sha);
    const prompt = readFileSync(join(runs, `${RUN_ID}.eval.prompt.md`), 'utf8');
    expect(prompt).toContain('R1 scope containment');
    expect(prompt).toContain('tsc --noEmit');
    expect(prompt).toContain('gsd:approved');
    expect(prompt).toContain(`gsd-loop verdict for ${sha} issue #97`);
    expect(prompt).toContain('### Blocking');
    expect(prompt).toContain(`export EXP_RUN_ID=${RUN_ID}`);
    expect(prompt).toContain('READ-ONLY');
    expect(prompt).toContain(join(runs, `${RUN_ID}.verdict.md`));

    const clean = execFileSync(
      'node',
      [...script().slice(1), '--cleanup', '--run-id', RUN_ID, ...loc()],
      { encoding: 'utf8', cwd: dir },
    );
    expect(clean).toMatch(new RegExp(`REMOVED ${RUN_ID}-eval`));
    expect(existsSync(lane)).toBe(false);
    expect(existsSync(join(runs, `${RUN_ID}.eval.prompt.md`))).toBe(true);
  });
});
