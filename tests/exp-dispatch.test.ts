// tests/exp-dispatch.test.ts
// Unit tests for scripts/exp/dispatch.mjs: fan one issue out to N models
// with namespaced branches/worktrees. Uses a stubbed `gh`; dry-run writes
// nothing. The closed-issue setup case must fail before any worktree write.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let stubDir = '';

const STUB = `#!/usr/bin/env node
const args = process.argv.slice(2);
const j = (o) => { process.stdout.write(JSON.stringify(o)); };
if (args[0] === 'issue') {
  const state = process.env.STUB_ISSUE_STATE || 'OPEN';
  const labels = process.env.STUB_ISSUE_LABELS ? JSON.parse(process.env.STUB_ISSUE_LABELS) : [{ name: 'gsd' }];
  j({ number: 80, title: 'Test issue', state, labels });
} else { console.error('stub gh: unexpected ' + args.join(' ')); process.exit(3); }
`;

beforeAll(() => {
  stubDir = mkdtempSync(join(tmpdir(), 'exp-dispatch-stub-'));
  const p = join(stubDir, 'gh');
  writeFileSync(p, STUB);
  chmodSync(p, 0o755);
});

afterAll(() => {
  if (stubDir) rmSync(stubDir, { recursive: true, force: true });
});

function stubEnv(extra: Record<string, string> = {}) {
  return { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, ...extra };
}

describe('dispatch', () => {
  it('dry-run plans namespaced branches and worktrees per model', () => {
    const out = execFileSync(
      'node',
      [
        'scripts/exp/dispatch.mjs', '--issue', '80',
        '--models', 'opencode-go/deepseek-flash,opencode-go/glm-5.3',
        '--dry-run',
      ],
      { encoding: 'utf8', cwd: process.cwd(), env: stubEnv() },
    );
    const plan = JSON.parse(out);
    expect(plan.issue).toBe(80);
    expect(plan.run_id).toMatch(/^exp-/);
    expect(plan.plan).toHaveLength(2);
    expect(plan.plan[0].slug).toBe('deepseek-flash');
    expect(plan.plan[1].slug).toBe('glm-5-3');
    for (const p of plan.plan) {
      expect(p.branch).toMatch(/^exp\/80-[a-z0-9-]+-\d{8}-\d{6}$/);
      expect(p.worktree).toContain(join('.gsd', 'exp-worktrees'));
    }
    // dry-run must not create anything for this run (the parent dir may exist
    // from real runs; assert this plan left no trace)
    expect(existsSync(resolve(process.cwd(), '.gsd/exp-worktrees', plan.run_id))).toBe(false);
    for (const p of plan.plan) expect(existsSync(p.worktree)).toBe(false);
  });

  it('refuses setup on a non-open issue before writing anything', () => {
    const runId = `exp-test-closed-${Date.now()}`;
    const res = spawnSync(
      'node',
      ['scripts/exp/dispatch.mjs', '--issue', '80', '--models', 'opencode-go/deepseek-flash', '--run-id', runId],
      { encoding: 'utf8', cwd: process.cwd(), env: stubEnv({ STUB_ISSUE_STATE: 'CLOSED' }) },
    );
    expect(res.status).not.toBe(0);
    expect(String(res.stderr)).toMatch(/non-open/i);
    expect(existsSync(resolve(process.cwd(), '.gsd/exp-worktrees', runId))).toBe(false);
  });

  it('warns but proceeds when the issue is gsd:ready', () => {
    const res = spawnSync(
      'node',
      ['scripts/exp/dispatch.mjs', '--issue', '80', '--models', 'opencode-go/deepseek-flash', '--dry-run'],
      {
        encoding: 'utf8',
        cwd: process.cwd(),
        env: stubEnv({ STUB_ISSUE_LABELS: JSON.stringify([{ name: 'gsd:ready' }]) }),
      },
    );
    expect(res.status).toBe(0);
    expect(String(res.stderr)).toMatch(/gsd:ready/i);
    expect(JSON.parse(res.stdout).plan).toHaveLength(1);
  });
});
