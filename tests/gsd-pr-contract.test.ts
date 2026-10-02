// tests/gsd-pr-contract.test.ts
// Evidence for M010/S03: the contract gate (scripts/gsd-pr-contract.mjs)
// mechanizes docs/guides/ISSUE-PR-CONTRACT.md — trailer parse, outcome parity
// refuse/accept, and fresh/stale approval branches (helpers live in
// scripts/gsd-github-reactions.mjs, re-exported by the gate). abide/JEV judging
// moved to CI (.github/workflows/abide-judge.yml).

import { describe, it, expect } from 'vitest';
import {
  parseTrailer,
  parseIssueOutcomes,
  parseEvidenceOutcomes,
  checkParity,
  isApprovalBody,
  findFreshApproval,
  approvalLifts,
} from '../scripts/gsd-pr-contract.mjs';
import {
  buildReactionComment,
  classifyGsdEvent,
  isIssueTerminal,
} from '../scripts/gsd-github-reactions.mjs';

const TRAILER = `<!-- gsd-meta
milestone: M010
slice: S03
parent: main
stacked-on:
outcomes: O-1,O-2
human-merge: false
-->`;

const ISSUE_BODY = `## Goal

Gate the contract.

## Demo

Scratch PR passes the gate.

## Outcomes

- O-1 — Trailer parse + outcome-parity gate refuses on mismatch
- O-2 — Evidence table outcomes match the issue

## Exclusions

- X-1 — no runtime/UI changes

## GSD tasks

- T01 gate script

---
GSD slice M010/S03 (risk: medium, depends: S01,S02) — planned in \`.gsd/\`.
${TRAILER}`;

const prBodyWith = (trailer: string = TRAILER) => `## Linked slice issue

Closes #144 (M010/S03: Lane enforcement)

## Outcome evidence

| Outcome | Evidence |
| ------- | -------- |
| O-1 | abc1234 gate script |
| O-2 | def5678 parity cross-check |

## Verification

- \`npx vitest run\` — pass

${trailer}`;

describe('parseTrailer', () => {
  it('parses every registered key', () => {
    const stacked = TRAILER.replace('stacked-on:', 'stacked-on: gsd/m010-s02-x').replace(
      'human-merge: false',
      'human-merge: true',
    );
    const parsed = parseTrailer(`body\n${stacked}`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('expected ok trailer');
    expect(parsed.trailer).toMatchObject({
      milestone: 'M010',
      slice: 'S03',
      parent: 'main',
      stackedOn: 'gsd/m010-s02-x',
      outcomes: ['O-1', 'O-2'],
      humanMerge: true,
    });
  });

  it('refuses a missing trailer', () => {
    expect(parseTrailer('no trailer here')).toEqual({ ok: false, error: 'missing-trailer' });
  });

  it('refuses invalid outcome ids and missing keys', () => {
    const badOutcomes = parseTrailer(TRAILER.replace('outcomes: O-1,O-2', 'outcomes: O-1,banana'));
    expect(badOutcomes.ok).toBe(false);
    if (badOutcomes.ok) throw new Error('expected refused trailer');
    expect(badOutcomes.error).toBe('trailer-outcomes-invalid');
    const noKeys = parseTrailer('<!-- gsd-meta\nparent: main\n-->');
    expect(noKeys).toEqual({ ok: false, error: 'trailer-keys-mismatch' });
  });
});

describe('checkParity', () => {
  it('accepts exact outcome agreement', () => {
    expect(parseIssueOutcomes(ISSUE_BODY)).toEqual(['O-1', 'O-2']);
    expect(parseEvidenceOutcomes(prBodyWith())).toEqual(['O-1', 'O-2']);
    const verdict = checkParity({
      prBody: prBodyWith(),
      issueBody: ISSUE_BODY,
      milestone: 'M010',
      slice: 'S03',
    });
    expect(verdict).toMatchObject({ pass: true, missing: [], extra: [], reasons: [] });
  });

  it('refuses missing and extra outcome ids', () => {
    const missing = checkParity({
      prBody: prBodyWith().replace('| O-2 | def5678 parity cross-check |', '| O-9 | unknown |'),
      issueBody: ISSUE_BODY,
      milestone: 'M010',
      slice: 'S03',
    });
    expect(missing.pass).toBe(false);
    expect(missing.reasons).toContain('parity-extra-outcomes');
    const short = checkParity({
      prBody: prBodyWith(TRAILER.replace('outcomes: O-1,O-2', 'outcomes: O-1')).replace(
        '| O-2 | def5678 parity cross-check |\n',
        '',
      ),
      issueBody: ISSUE_BODY,
      milestone: 'M010',
      slice: 'S03',
    });
    expect(short.pass).toBe(false);
    expect(short.missing).toEqual(['O-2']);
    expect(short.reasons).toContain('parity-missing-outcomes');
  });

  it('refuses absent trailers, wrong keys, and issues without Outcomes', () => {
    expect(checkParity({ prBody: 'nothing', issueBody: ISSUE_BODY }).reasons).toContain('missing-trailer');
    const wrongKeys = checkParity({
      prBody: prBodyWith(),
      issueBody: ISSUE_BODY,
      milestone: 'M010',
      slice: 'S04',
    });
    expect(wrongKeys.reasons).toContain('trailer-keys-mismatch');
    const noOutcomes = checkParity({
      prBody: prBodyWith(),
      issueBody: '## Goal\ntext, no outcomes section',
      milestone: 'M010',
      slice: 'S03',
    });
    expect(noOutcomes.reasons).toContain('issue-outcomes-missing');
  });
});

describe('fresh owner approval (contract section 5)', () => {
  const HEAD = '2026-09-27T12:00:00Z';
  const comment = (over: Record<string, unknown> = {}) => ({
    body: 'ok',
    author: { login: 'AventusM' },
    createdAt: '2026-09-27T13:00:00Z',
    ...over,
  });

  it('recognizes the approval vocabulary and rejects lane chatter', () => {
    for (const body of ['ok', 'OK!', 'lgtm', 'Ship it.', 'go ahead', '/approve', 'gsd:approve this']) {
      expect(isApprovalBody(body)).toBe(true);
    }
    for (const body of ['', 'looks fine', 'gsd-loop verdict for abc', 'GSD: reconcile', 'ok but fix x']) {
      expect(isApprovalBody(body)).toBe(false);
    }
  });

  it('honors fresh approvals and ignores stale, bot, and non-owner ones', () => {
    expect(findFreshApproval([comment()], HEAD).fresh).toBe(true);
    expect(findFreshApproval([comment({ createdAt: '2026-09-27T11:00:00Z' })], HEAD).fresh).toBe(false);
    expect(findFreshApproval([comment({ createdAt: HEAD })], HEAD).fresh).toBe(false);
    expect(findFreshApproval([comment({ author: { login: 'gsd-loop[bot]' } })], HEAD).fresh).toBe(false);
    expect(findFreshApproval([comment()], HEAD, ['someone-else']).fresh).toBe(false);
    expect(findFreshApproval([comment()], HEAD, ['aventusm']).approval?.author).toBe('AventusM');
    expect(findFreshApproval([{ body: 'nice', author: { login: 'AventusM' }, createdAt: '2026-09-27T13:00:00Z' }], HEAD).fresh).toBe(false);
  });

  it('lifts stacked/human-gated blockers but never blocked, rework, CI, or JEV', () => {
    const lifted = approvalLifts({
      approval: { body: 'ok', author: 'AventusM', createdAt: HEAD },
      gates: { stacked: true, humanMergeTrailer: true, escalated: true, blocked: true, rework: true, ciFailing: true, jevMissing: true },
    });
    expect(lifted.lifted).toEqual(expect.arrayContaining(['stacked', 'humanMergeTrailer', 'escalated']));
    expect(lifted.stillBlocking).toEqual(expect.arrayContaining(['blocked', 'rework', 'ciFailing', 'jevMissing']));
    expect(approvalLifts({ approval: null, gates: { stacked: true } })).toMatchObject({
      lifted: [],
      stillBlocking: ['stacked'],
    });
    const viaLabels = approvalLifts({
      approval: { body: 'lgtm', author: 'AventusM', createdAt: HEAD },
      gates: { labels: [{ name: 'gsd:escalated' }, { name: 'gsd:blocked' }] },
    });
    expect(viaLabels.lifted).toContain('escalated');
    expect(viaLabels.stillBlocking).toContain('blocked');
  });
});

describe('seal-path wording (contract section 6)', () => {
  const event = (cmd: string, over: Record<string, unknown> = {}) => ({
    cmd,
    params: { milestoneId: 'M010', sliceId: 'S03' },
    ts: '2026-09-27T10:00:00Z',
    actor: 'agent',
    hash: 'seal-key-1',
    ...over,
  });
  const reaction = (cmd: string) => classifyGsdEvent(event(cmd, { v: 2 }));

  it('delivers with merge commit + evidence, marker, and dedupe key', () => {
    const body = buildReactionComment(reaction('complete-slice')!, {
      mergeSha: 'abc1234',
      evidence: 'O-1 done',
    });
    expect(body).toContain('gsd-sync: M010/S03 delivered');
    expect(body).toContain('abc1234');
    expect(body).toContain('O-1 done');
    expect(body).toContain('<!-- gsd-sync -->');
    expect(body).toContain('gsd-key: seal-key-1');
  });

  it('seals skipped with reasons and leaves the issue open', () => {
    const body = buildReactionComment(reaction('skip-slice')!, { reasons: 'waiting on S02' });
    expect(body).toContain('gsd-sync: M010/S03 sealed skipped');
    expect(body).toContain('waiting on S02');
    expect(body).toContain('leaving the issue open');
    expect(body).toContain('<!-- gsd-sync -->');
  });

  it('skips already-closed issues', () => {
    expect(isIssueTerminal({ state: 'CLOSED' })).toBe(true);
    expect(isIssueTerminal({ state: 'open' })).toBe(false);
  });
});
