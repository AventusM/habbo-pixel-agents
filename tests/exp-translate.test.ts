// tests/exp-translate.test.ts
// Unit tests for scripts/exp/translate-loop.mjs: normalize a gsd-loop run
// (issue + PR + verdict + checks) into a schema-valid per-run JSONL record.
// Runs the translator against a stubbed `gh` so no network is needed.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ISSUE_FIXTURE = {
  number: 79,
  title: 'M003/S05: Live board updates',
  state: 'CLOSED',
  labels: [{ name: 'gsd' }, { name: 'M003' }],
  closedAt: '2026-09-10T18:48:50Z',
  createdAt: '2026-09-06T19:18:26Z',
};

const PR_FIXTURE = {
  number: 92,
  title: 'feat(M003/S05): live board updates',
  state: 'MERGED',
  isDraft: false,
  mergedAt: '2026-09-10T18:48:48Z',
  mergeCommit: { oid: '181d0e98aaaabbbbccccddddeeeeffff00001111' },
  headRefName: 'gsd/79-live-board-updates',
  headRefOid: '6188dd74ef1a9791e3e04c12153143cf2cb1bf18',
  labels: [{ name: 'gsd:approved' }],
  createdAt: '2026-09-10T17:04:41Z',
  updatedAt: '2026-09-10T18:48:57Z',
  url: 'https://github.com/AventusM/habbo-pixel-agents/pull/92',
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  statusCheckRollup: [{ status: 'completed', conclusion: 'SUCCESS' }],
  closingIssuesReferences: [{ number: 79 }],
  comments: [
    {
      body: 'gsd-loop verdict for 6188dd74ef1a9791e3e04c12153143cf2cb1bf18 issue #79\n\nRequired CI: passing\n\n### Blocking\n\nNone.\n',
      author: { login: 'AventusM' },
      createdAt: '2026-09-10T17:32:07Z',
    },
  ],
};

let stubDir = '';

beforeAll(() => {
  stubDir = mkdtempSync(join(tmpdir(), 'exp-gh-stub-'));
  const stub = `#!/usr/bin/env node
const args = process.argv.slice(2);
const j = (o) => { process.stdout.write(JSON.stringify(o)); };
if (args[0] === 'repo') j({ nameWithOwner: 'AventusM/habbo-pixel-agents' });
else if (args[0] === 'issue') j(${JSON.stringify(ISSUE_FIXTURE)});
else if (args[0] === 'pr' && args[1] === 'list') j([]);
else if (args[0] === 'pr' && args[1] === 'view') j(${JSON.stringify(PR_FIXTURE)});
else { console.error('stub gh: unexpected ' + args.join(' ')); process.exit(3); }
`;
  const p = join(stubDir, 'gh');
  writeFileSync(p, stub);
  chmodSync(p, 0o755);
});

afterAll(() => {
  if (stubDir) rmSync(stubDir, { recursive: true, force: true });
});

function runTranslator(args: string[]) {
  const env = { ...process.env, PATH: `${stubDir}:${process.env.PATH}` };
  const out = execFileSync('node', ['scripts/exp/translate-loop.mjs', ...args], {
    encoding: 'utf8',
    cwd: process.cwd(),
    env,
  });
  return JSON.parse(out.trim().split('\n').pop() as string);
}

describe('translate-loop', () => {
  it('builds build/review/merge sections and evaluation for a merged approved PR', () => {
    const r = runTranslator([
      '--issue', '79', '--pr', '92',
      '--model', 'opencode-go/deepseek-flash',
      '--run-id', 'exp-test-79',
    ]);
    expect(r.run_id).toBe('exp-test-79');
    expect(r.issue).toBe(79);
    expect(r.path).toBe('gsd-loop');
    expect(r.model).toBe('opencode-go/deepseek-flash');
    expect(r.pr).toBe(92);
    expect(r.branch).toBe('gsd/79-live-board-updates');
    const kinds = r.sections.map((s: { section: string }) => s.section);
    expect(kinds).toEqual(['build', 'review', 'merge']);
    expect(r.sections[0].result).toBe('done');
    expect(r.sections[1].result).toBe('approved');
    expect(r.sections[1].verdict).toBe('6188dd74ef1a9791e3e04c12153143cf2cb1bf18');
    expect(r.sections[2].result).toBe('merged');
    expect(r.evaluation.merged).toBe(true);
    expect(r.evaluation.pr_url).toContain('/pull/92');
  });

  it('marks review as rework when the verdict is blocking and gsd:rework is set', () => {
    const reworkPr = {
      ...PR_FIXTURE,
      state: 'OPEN',
      mergedAt: null,
      labels: [{ name: 'gsd:rework' }],
      comments: [
        {
          body: 'gsd-loop verdict for aaaabbbb issue #79\n\n### Blocking\n\n- [BUG] something\n',
          author: { login: 'AventusM' },
          createdAt: '2026-09-10T17:32:07Z',
        },
      ],
    };
    const stub = `#!/usr/bin/env node
const args = process.argv.slice(2);
const j = (o) => { process.stdout.write(JSON.stringify(o)); };
if (args[0] === 'repo') j({ nameWithOwner: 'AventusM/habbo-pixel-agents' });
else if (args[0] === 'issue') j(${JSON.stringify({ ...ISSUE_FIXTURE, state: 'OPEN', closedAt: null })});
else if (args[0] === 'pr') j(${JSON.stringify(reworkPr)});
else process.exit(3);
`;
    const dir2 = mkdtempSync(join(tmpdir(), 'exp-gh-stub2-'));
    const p = join(dir2, 'gh');
    writeFileSync(p, stub);
    chmodSync(p, 0o755);
    try {
      const env = { ...process.env, PATH: `${dir2}:${process.env.PATH}` };
      const out = execFileSync(
        'node',
        ['scripts/exp/translate-loop.mjs', '--issue', '79', '--pr', '92', '--run-id', 'exp-test-rw'],
        { encoding: 'utf8', cwd: process.cwd(), env },
      );
      const r = JSON.parse(out.trim().split('\n').pop() as string);
      expect(r.sections.map((s: { section: string }) => s.section)).toEqual(['build', 'review']);
      expect(r.sections[1].result).toBe('rework');
      expect(r.evaluation.merged).toBe(false);
    } finally {
      rmSync(dir2, { recursive: true, force: true });
    }
  });

  it('emits the required schema keys', () => {
    const r = runTranslator(['--issue', '79', '--pr', '92', '--run-id', 'exp-test-schema']);
    for (const k of ['run_id', 'issue', 'path', 'model', 'sections']) {
      expect(r).toHaveProperty(k);
    }
    expect(execSync('node -e "JSON.parse(require(\'fs\').readFileSync(\'scripts/exp/schema.json\'))"').toString()).toBeDefined();
  });
});
