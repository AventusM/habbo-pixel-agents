// tests/exp-select-brief.test.ts
// Hermetic tests for scripts/exp/select-brief.mjs: dry-run planning for two
// candidates, judge/build-model disjoint refusal, and a full briefing cycle
// inside throwaway dirs (PRs via --prs-file, issue via --issue-file).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let dir = '';
let repo = '';
let runs = '';
let wt = '';
let shaA = '';
let shaB = '';

function script(): string[] {
  return ['node', join(process.cwd(), 'scripts/exp/select-brief.mjs')];
}

function git(args: string[], cwd: string) {
  return execFileSync('git', args, { encoding: 'utf8', cwd });
}

function loc(): string[] {
  return ['--repo', repo, '--runs-dir', runs, '--worktree-root', wt];
}

function prsFile(): string {
  const p = join(dir, 'prs.json');
  writeFileSync(
    p,
    JSON.stringify([
      { number: 99, title: 'cand A', headSha: shaA, headRefName: 'exp/a', baseRefName: 'main', url: 'https://example.test/pr/99', buildModel: 'opencode-go/kimi-k2.7-code' },
      { number: 100, title: 'cand B', headSha: shaB, headRefName: 'exp/b', baseRefName: 'main', url: 'https://example.test/pr/100', buildModel: 'opencode-go/deepseek-v4-flash' },
    ]),
  );
  return p;
}

function issueFile(): string {
  const p = join(dir, 'issue.txt');
  writeFileSync(p, 'Some title\n\n## Outcomes\n- [ ] do the thing\n');
  return p;
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'exp-select-'));
  repo = join(dir, 'repo');
  runs = join(dir, 'runs');
  wt = join(dir, 'wt');
  mkdirSync(repo, { recursive: true });
  mkdirSync(runs, { recursive: true });
  git(['init', '-q'], repo);
  git(['config', 'user.email', 't@t.t'], repo);
  git(['config', 'user.name', 't'], repo);
  writeFileSync(join(repo, 'a.txt'), 'a\n');
  git(['add', '.'], repo);
  git(['commit', '-qm', 'a'], repo);
  shaA = git(['rev-parse', 'HEAD'], repo).trim();
  writeFileSync(join(repo, 'b.txt'), 'b\n');
  git(['add', '.'], repo);
  git(['commit', '-qm', 'b'], repo);
  shaB = git(['rev-parse', 'HEAD'], repo).trim();
});

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('select-brief', () => {
  it('dry-run plans one judge run over two candidates', () => {
    const out = execFileSync(
      'node',
      [...script().slice(1), '--issue', '97', '--prs', '99,100', '--run', '20260912-153000',
        '--prs-file', prsFile(), '--issue-file', issueFile(), '--dry-run', ...loc()],
      { encoding: 'utf8', cwd: dir },
    );
    expect(out).toMatch(/JUDGE exp-20260912-153000-97-select-opencode-go-kimi-k3 issue=97/);
    expect(out).toMatch(/CANDIDATE pr=99 model=opencode-go\/kimi-k2\.7-code/);
    expect(out).toMatch(/CANDIDATE pr=100 model=opencode-go\/deepseek-v4-flash/);
    expect(out).toMatch(/DRY-RUN \(no writes\)/);
    expect(existsSync(join(wt, '.select'))).toBe(false);
  });

  it('requires two or more PRs and refuses a judge matching a build model', () => {
    const r1 = spawnSync('node', [...script().slice(1), '--issue', '97', '--prs', '99', ...loc()], {
      encoding: 'utf8', cwd: dir,
    });
    expect(r1.status).toBe(2);
    const r2 = spawnSync(
      'node',
      [...script().slice(1), '--issue', '97', '--prs', '99,100', '--model', 'opencode-go/kimi-k2.7-code',
        '--prs-file', prsFile(), '--issue-file', issueFile(), ...loc()],
      { encoding: 'utf8', cwd: dir },
    );
    expect(r2.status).toBe(2);
    expect(String(r2.stderr)).toMatch(/disjoint/);
  });

  it('full cycle writes candidate dirs + prompt + meta; cleanup keeps records', () => {
    const run = '20260912-153001';
    const judge = `exp-${run}-97-select-opencode-go-kimi-k3`;
    const out = execFileSync(
      'node',
      [...script().slice(1), '--issue', '97', '--prs', '99,100', '--run', run,
        '--prs-file', prsFile(), '--issue-file', issueFile(), ...loc()],
      { encoding: 'utf8', cwd: dir },
    );
    expect(out).toMatch(/OPERATOR next/);
    for (const [n, sha] of [[99, shaA], [100, shaB]] as const) {
      const lane = join(wt, '.select', judge, `pr${n}`);
      expect(existsSync(lane)).toBe(true);
      expect(git(['rev-parse', 'HEAD'], lane).trim()).toBe(sha);
    }
    const prompt = readFileSync(join(runs, `${judge}.prompt.md`), 'utf8');
    expect(prompt).toContain('exp-select for issue #97: winner #<M>');
    expect(prompt).toContain(`export EXP_RUN_ID=${judge}`);
    expect(prompt).toContain('--section review --result approved');
    expect(prompt).toContain('Judge the artifacts, never the models');
    const meta = JSON.parse(readFileSync(join(runs, `${judge}.meta.json`), 'utf8'));
    expect(meta.kind).toBe('select');
    expect(meta.candidates).toHaveLength(2);

    const clean = execFileSync('node', [...script().slice(1), '--cleanup', '--run-id', judge, ...loc()], {
      encoding: 'utf8', cwd: dir,
    });
    expect(clean).toMatch(new RegExp(`REMOVED ${judge}`));
    expect(existsSync(join(wt, '.select', judge))).toBe(false);
    expect(existsSync(join(runs, `${judge}.prompt.md`))).toBe(true);
    expect(existsSync(join(runs, `${judge}.meta.json`))).toBe(true);
  });
});
