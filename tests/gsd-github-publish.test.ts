// tests/gsd-github-publish.test.ts
// Fixture for M010/S02: publisher builds the canonical issue body, upserts
// idempotently by exact title, and reconcile comments use the canonical head
// while skipping already-closed issues.

import { describe, it, expect } from 'vitest';
import {
  buildIssueTitle,
  buildIssueBody,
  buildTrailer,
  hasBlockedLabel,
  isExactTitleMatch,
  upsertSliceIssue,
  ensureMilestoneLabel,
} from '../scripts/gsd-github-publish.mjs';
import { buildReactionComment, isIssueTerminal } from '../scripts/gsd-github-reactions.mjs';

const TRAILER_KEYS = ['milestone:', 'slice:', 'parent:', 'stacked-on:', 'outcomes:', 'human-merge:'];

function makeBody() {
  return buildIssueBody({
    milestone: 'M010',
    slice: 'S02',
    goal: 'Publish planned slices automatically.',
    demo: 'A canonical issue appears idempotently.',
    outcomes: [{ id: 'O-1', text: 'Publisher upserts canonically' }],
    exclusions: [{ id: 'X-1', text: 'No runtime changes' }],
    tasks: ['T01: publisher', 'T02: wording'],
    risk: 'medium',
    depends: ['S01'],
  });
}

describe('canonical issue body', () => {
  it('carries Goal/Demo/Outcomes(O-N)/Exclusions/GSD-tasks', () => {
    const body = makeBody();
    for (const section of ['## Goal', '## Demo', '## Outcomes', '## Exclusions', '## GSD tasks']) {
      expect(body).toContain(section);
    }
    expect(body).toContain('O-1');
    expect(body).toContain('X-1');
    expect(body).toContain('T01: publisher');
  });

  it('emits every gsd-meta trailer key', () => {
    const body = makeBody();
    expect(body).toContain('gsd-meta');
    for (const key of TRAILER_KEYS) {
      expect(body).toContain(key);
    }
  });

  it('builds the exact title and trailer', () => {
    expect(buildIssueTitle('M010', 'S02', 'Plan-time publisher')).toBe('M010/S02: Plan-time publisher');
    const trailer = buildTrailer({ milestone: 'M010', slice: 'S02', outcomes: ['O-1'] });
    for (const key of TRAILER_KEYS) {
      expect(trailer).toContain(key);
    }
  });
});

describe('idempotent upsert by exact title', () => {
  function stubExec(scenarios: { list: unknown[]; createOut?: string }) {
    const calls: string[][] = [];
    const fn = (cmd: string, args: string[]) => {
      calls.push([cmd, ...args]);
      if (args[0] === 'issue' && args[1] === 'list') return JSON.stringify(scenarios.list);
      if (args[0] === 'issue' && args[1] === 'create')
        return scenarios.createOut ?? 'https://github.com/o/r/issues/999';
      return '';
    };
    return { fn, calls };
  }

  it('creates when absent', () => {
    const { fn, calls } = stubExec({ list: [] });
    const res = upsertSliceIssue(fn as never, {
      milestoneId: 'M010',
      sliceId: 'S02',
      title: 'M010/S02: Foo',
      body: makeBody(),
    });
    expect(res.action).toBe('created');
    expect(calls.some((c) => c.includes('create'))).toBe(true);
  });

  it('edits body when present, never duplicates', () => {
    const { fn, calls } = stubExec({
      list: [{ number: 143, title: 'M010/S02: Foo', state: 'OPEN', labels: [] }],
    });
    const res = upsertSliceIssue(fn as never, {
      milestoneId: 'M010',
      sliceId: 'S02',
      title: 'M010/S02: Foo',
      body: makeBody(),
    });
    expect(res).toMatchObject({ action: 'updated', number: 143 });
    expect(calls.some((c) => c.includes('create'))).toBe(false);
    expect(calls.some((c) => c.includes('edit'))).toBe(true);
  });

  it('skips gsd:blocked issues', () => {
    const { fn } = stubExec({
      list: [{ number: 7, title: 'M010/S02: Foo', state: 'OPEN', labels: [{ name: 'gsd:blocked' }] }],
    });
    const res = upsertSliceIssue(fn as never, {
      milestoneId: 'M010',
      sliceId: 'S02',
      title: 'M010/S02: Foo',
      body: makeBody(),
    });
    expect(res.action).toBe('skipped-blocked');
  });

  it('dry-run never writes', () => {
    let wrote = false;
    const fn = () => {
      wrote = true;
      return '';
    };
    const res = upsertSliceIssue(fn as never, {
      milestoneId: 'M010',
      sliceId: 'S02',
      title: 'M010/S02: Foo',
      body: makeBody(),
      dryRun: true,
    });
    expect(res.action).toBe('dry-run');
    expect(wrote).toBe(false);
  });

  it('exact title matching is strict', () => {
    expect(isExactTitleMatch('M010/S02: Foo', 'M010/S02: Foo')).toBe(true);
    expect(isExactTitleMatch('M010/S02: Foo ', 'M010/S02: Foo')).toBe(true);
    expect(isExactTitleMatch('M010/S03: Foo', 'M010/S02: Foo')).toBe(false);
    expect(hasBlockedLabel({ labels: [{ name: 'gsd:blocked' }] })).toBe(true);
    expect(hasBlockedLabel({ labels: [] })).toBe(false);
    expect(ensureMilestoneLabel(() => '', 'M010', { dryRun: true }).action).toBe('dry-run');
  });
});

describe('canonical reconcile wording', () => {
  it('delivered head names merge + evidence then closes', () => {
    const comment = buildReactionComment(
      { milestoneId: 'M010', sliceId: 'S02', close: true, key: 'k1' } as never,
      { mergeSha: 'deadbeef', evidence: 'O-1 done' },
    );
    expect(comment).toContain('gsd-sync: M010/S02 delivered');
    expect(comment).toContain('deadbeef');
    expect(comment).toContain('O-1 done');
    expect(comment).toContain('<!-- gsd-sync -->');
  });

  it('seal-skipped head carries reasons and does not close', () => {
    const comment = buildReactionComment(
      { milestoneId: 'M010', sliceId: 'S02', close: false, key: 'k2' } as never,
      { reasons: 'waiting on S01' },
    );
    expect(comment).toContain('gsd-sync: M010/S02 sealed skipped');
    expect(comment).toContain('waiting on S01');
    expect(comment).toContain('leaving the issue open');
  });

  it('already-closed issues are terminal and skipped', () => {
    expect(isIssueTerminal({ state: 'CLOSED' })).toBe(true);
    expect(isIssueTerminal({ state: 'closed' })).toBe(true);
    expect(isIssueTerminal({ state: 'OPEN' })).toBe(false);
  });
});
