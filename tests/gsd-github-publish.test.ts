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
  SCRATCH_LABELS,
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

describe('scratch walkthrough issues (M010/S04)', () => {
  function scratchBody() {
    return buildIssueBody({
      milestone: 'M010',
      slice: 'S04',
      goal: 'Prove the full structured-output loop end to end.',
      demo: 'A recorded walkthrough on a scratch slice.',
      outcomes: [{ id: 'O-1', text: 'Walkthrough recorded' }],
      exclusions: [{ id: 'X-1', text: 'No merges' }],
      tasks: ['T01: setup + publish'],
      scratch: true,
    });
  }

  it('keeps canonical sections and trailer, swaps the sync footer', () => {
    const body = scratchBody();
    for (const section of ['## Goal', '## Demo', '## Outcomes', '## Exclusions', '## GSD tasks']) {
      expect(body).toContain(section);
    }
    expect(body).toContain('gsd-meta');
    expect(body).toContain('not synced (no gsd:synced label, SCRATCH title)');
    expect(body).not.toContain('the two-way sync will label/comment/close');
  });

  it('creates without sync labels and updates on re-run, never duplicates', () => {
    const calls: string[][] = [];
    const listOnce = [{ number: 901, title: 'SCRATCH: M010/S04 walkthrough', state: 'OPEN', labels: [] }];
    let listCalls = 0;
    const fn = (cmd: string, args: string[]) => {
      calls.push([cmd, ...args]);
      if (args[0] === 'issue' && args[1] === 'list') {
        listCalls += 1;
        return JSON.stringify(listCalls === 1 ? [] : listOnce);
      }
      if (args[0] === 'issue' && args[1] === 'create') return 'https://github.com/o/r/issues/901';
      return '';
    };
    const first = upsertSliceIssue(fn as never, {
      milestoneId: 'M010',
      sliceId: 'S04',
      title: 'SCRATCH: M010/S04 walkthrough',
      body: scratchBody(),
      labels: SCRATCH_LABELS,
    });
    expect(first.action).toBe('created');
    const createCall = calls.find((c) => c.includes('create'));
    const labelValue = createCall?.[createCall.indexOf('--label') + 1] ?? '';
    expect(labelValue).toContain('enhancement');
    expect(labelValue).not.toContain('gsd:synced');
    expect(labelValue).not.toContain('gsd');
    const second = upsertSliceIssue(fn as never, {
      milestoneId: 'M010',
      sliceId: 'S04',
      title: 'SCRATCH: M010/S04 walkthrough',
      body: scratchBody(),
      labels: SCRATCH_LABELS,
    });
    expect(second).toMatchObject({ action: 'updated', number: 901 });
    expect(calls.filter((c) => c.includes('create')).length).toBe(1);
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
