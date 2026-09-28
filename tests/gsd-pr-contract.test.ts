// tests/gsd-pr-contract.test.ts
// Evidence for M010/S03: the contract gate (scripts/gsd-pr-contract.mjs)
// mechanizes docs/guides/ISSUE-PR-CONTRACT.md — trailer parse, outcome parity
// refuse/accept, JEV-section match/mismatch, and fresh/stale approval branches
// (helpers live in scripts/gsd-github-reactions.mjs, re-exported by the gate).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  parseTrailer,
  parseIssueOutcomes,
  parseEvidenceOutcomes,
  checkParity,
  checkJevSection,
  checkJevReport,
  scopeMatches,
  governedRulesForFiles,
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
- O-2 — JEV section verified against the committed handoff report

## Exclusions

- X-1 — no runtime/UI changes

## GSD tasks

- T01 gate script

---
GSD slice M010/S03 (risk: medium, depends: S01,S02) — planned in \`.gsd/\`.
${TRAILER}`;

const prBodyWith = (jevSection: string, trailer: string = TRAILER) => `## Linked slice issue

Closes #144 (M010/S03: Lane enforcement)

## Outcome evidence

| Outcome | Evidence |
| ------- | -------- |
| O-1 | abc1234 gate script |
| O-2 | def5678 jev cross-check |

## Verification

- \`npx vitest run\` — pass

${jevSection}

${trailer}`;

const JEV_CLEAR = `## abide/JEV compliance

| Rule | Where applied | Band | Evidence |
| ---- | ------------- | ---- | -------- |
| no-frame-allocations | src/RoomCanvas.tsx (O-2) | clear | .abide/reports/gate-abc1234.json |
| typescript-eslint-recommended | src/RoomCanvas.tsx | clear | npm run lint |

Verdict: clear — .abide/reports/gate-abc1234.json`;

const RUBRIC = {
  rules: [
    {
      id: 'no-frame-allocations',
      status: 'active',
      scope: ['src/RoomCanvas.tsx', 'src/iso*Renderer*.ts'],
      check: { type: 'model' },
    },
    {
      id: 'typescript-eslint-recommended',
      status: 'active',
      scope: ['**/*.ts', '**/*.tsx'],
      check: { type: 'lint' },
    },
    {
      id: 'gsd-workflow',
      status: 'active',
      check: { type: 'unenforceable', reason: 'process, not code' },
    },
  ],
};

const REPORT = {
  head: { sha: 'abc1234' },
  verdict: 'clear',
  changedFiles: ['src/RoomCanvas.tsx'],
  findings: [{ rule: 'no-frame-allocations', band: 'clear', files: ['src/RoomCanvas.tsx'] }],
};

describe('scopeMatches', () => {
  it('matches rubric scope shapes', () => {
    expect(scopeMatches('**/*.ts', 'tests/a.ts')).toBe(true);
    expect(scopeMatches('**/*.ts', 'a.mjs')).toBe(false);
    expect(scopeMatches('src/iso*Renderer*.ts', 'src/isoTileRenderer.ts')).toBe(true);
    expect(scopeMatches('src/iso*Renderer*.ts', 'src/roomCanvas.ts')).toBe(false);
    expect(scopeMatches('src/RoomCanvas.tsx', 'src/RoomCanvas.tsx')).toBe(true);
  });

  it('matches the script extension globs the widened rules carry', () => {
    expect(scopeMatches('**/*.mjs', 'scripts/gsd-pr-contract.mjs')).toBe(true);
    expect(scopeMatches('**/*.mjs', 'esbuild.config.mjs')).toBe(true);
    expect(scopeMatches('**/*.mjs', 'bin/habbo-dashboard.mjs')).toBe(true);
    expect(scopeMatches('**/*.mts', 'scripts/jeve-report.d.mts')).toBe(true);
    expect(scopeMatches('**/*.cjs', 'packages/agent-dashboard/dist/x.cjs')).toBe(true);
    expect(scopeMatches('**/*.mjs', 'src/RoomCanvas.tsx')).toBe(false);
  });
});

// Whole-codebase governance: the committed rubric must scope script modules so a
// scripts/*.mjs diff is judged instead of falling through .ts/.tsx-only scopes.
const REAL_RUBRIC = JSON.parse(
  readFileSync(fileURLToPath(new URL('../.abide/rubric.json', import.meta.url)), 'utf8'),
);

describe('rubric script scopes', () => {
  it('governs root and scripts JS modules with lint rules and the model rules', () => {
    for (const file of ['scripts/gsd-pr-contract.mjs', 'scripts/web-server.mjs', 'esbuild.config.mjs']) {
      const ids = governedRulesForFiles(REAL_RUBRIC, [file]).map((r) => r.id);
      for (const id of [
        'hooks-top-level',
        'exhaustive-deps',
        'typescript-eslint-recommended',
        'no-new-object-in-memo-props',
        'no-derived-state-effect',
        'no-listener-without-cleanup',
        'no-fetch-in-components',
        'lazy-loading-fallback',
        'no-children-clone-for-state',
        'no-app-logic-in-components',
      ]) {
        expect(ids).toContain(id);
      }
    }
  });

  it('keeps only the JSX-only and path-specific rules narrow', () => {
    const ids = governedRulesForFiles(REAL_RUBRIC, ['scripts/web-server.mjs']).map((r) => r.id);
    // Context.Provider value needs JSX, so only .tsx files qualify.
    expect(ids).not.toContain('no-new-object-in-context-value');
    // Per-frame render path is pinned to the canvas/renderer sources.
    expect(ids).not.toContain('no-frame-allocations');
  });
});

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
    expect(parseEvidenceOutcomes(prBodyWith(JEV_CLEAR))).toEqual(['O-1', 'O-2']);
    const verdict = checkParity({
      prBody: prBodyWith(JEV_CLEAR),
      issueBody: ISSUE_BODY,
      milestone: 'M010',
      slice: 'S03',
    });
    expect(verdict).toMatchObject({ pass: true, missing: [], extra: [], reasons: [] });
  });

  it('refuses missing and extra outcome ids', () => {
    const missing = checkParity({
      prBody: prBodyWith(JEV_CLEAR).replace('| O-2 | def5678 jev cross-check |', '| O-9 | unknown |'),
      issueBody: ISSUE_BODY,
      milestone: 'M010',
      slice: 'S03',
    });
    expect(missing.pass).toBe(false);
    expect(missing.reasons).toContain('parity-extra-outcomes');
    const short = checkParity({
      prBody: prBodyWith(JEV_CLEAR, TRAILER.replace('outcomes: O-1,O-2', 'outcomes: O-1')).replace(
        '| O-2 | def5678 jev cross-check |\n',
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
      prBody: prBodyWith(JEV_CLEAR),
      issueBody: ISSUE_BODY,
      milestone: 'M010',
      slice: 'S04',
    });
    expect(wrongKeys.reasons).toContain('trailer-keys-mismatch');
    const noOutcomes = checkParity({
      prBody: prBodyWith(JEV_CLEAR),
      issueBody: '## Goal\ntext, no outcomes section',
      milestone: 'M010',
      slice: 'S03',
    });
    expect(noOutcomes.reasons).toContain('issue-outcomes-missing');
  });
});

describe('checkJevSection', () => {
  const files = ['src/RoomCanvas.tsx'];

  it('passes a matching section against the committed report', () => {
    const verdict = checkJevSection({
      prBody: prBodyWith(JEV_CLEAR),
      changedFiles: files,
      rubric: RUBRIC,
      report: REPORT,
      headSha: 'abc1234',
      isAncestor: () => true,
    });
    expect(verdict.inScope).toEqual(['no-frame-allocations', 'typescript-eslint-recommended']);
    expect(verdict).toMatchObject({ pass: true, reasons: [] });
  });

  it('accepts empty-with-reason when no governed rule scopes the diff', () => {
    const verdict = checkJevSection({
      prBody: prBodyWith(
        '## abide/JEV compliance\n\nNo governed rule scopes `scripts/*.mjs` — nothing judged.\n\nVerdict: empty (scripts-only change; no rubric scope covers .mjs)',
      ),
      changedFiles: ['scripts/gsd-pr-contract.mjs'],
      rubric: RUBRIC,
    });
    expect(verdict).toMatchObject({ pass: true, inScope: [] });
  });

  it('refuses missing sections, missing rows, act bands, and unverified verdicts', () => {
    expect(
      checkJevSection({ prBody: 'no jev here', changedFiles: files, rubric: RUBRIC }).reasons,
    ).toContain('jev-section-missing');
    const noRow = checkJevSection({
      prBody: prBodyWith(
        '## abide/JEV compliance\n\n| Rule | Where applied | Band | Evidence |\n| ---- | ------------- | ---- | -------- |\n\nVerdict: clear — report',
      ),
      changedFiles: files,
      rubric: RUBRIC,
      report: REPORT,
      headSha: 'abc1234',
    });
    expect(noRow.reasons).toContain('jev-row-missing:no-frame-allocations');
    const act = checkJevSection({
      prBody: prBodyWith(JEV_CLEAR.replace('| clear |', '| act |')),
      changedFiles: files,
      rubric: RUBRIC,
      report: { ...REPORT, findings: [{ rule: 'no-frame-allocations', band: 'act' }] },
      headSha: 'abc1234',
    });
    expect(act.reasons).toContain('jev-band-act:no-frame-allocations');
    const unverified = checkJevSection({
      prBody: prBodyWith(JEV_CLEAR.replace('Verdict: clear — .abide/reports/gate-abc1234.json', 'Verdict: unverified (tooling absent)')),
      changedFiles: files,
      rubric: RUBRIC,
      report: REPORT,
      headSha: 'abc1234',
    });
    expect(unverified.reasons).toContain('jev-verdict-unverified');
  });

  it('warns (not refuses) on flag bands', () => {
    const verdict = checkJevSection({
      prBody: prBodyWith(JEV_CLEAR.replace('| clear |', '| flag |')),
      changedFiles: files,
      rubric: RUBRIC,
      report: { ...REPORT, findings: [{ rule: 'no-frame-allocations', band: 'flag' }] },
      headSha: 'abc1234',
    });
    expect(verdict.pass).toBe(true);
    expect(verdict.warnings).toContain('jev-band-flag:no-frame-allocations');
  });

  it('requires the committed report when model-judged rules scope the diff', () => {
    const verdict = checkJevSection({
      prBody: prBodyWith(JEV_CLEAR),
      changedFiles: files,
      rubric: RUBRIC,
      report: null,
      headSha: 'abc1234',
    });
    expect(verdict.reasons).toContain('jev-report-missing');
  });
});

describe('checkJevReport', () => {
  it('refuses stale shas, uncovered files, and band drift', () => {
    expect(
      checkJevReport({ report: REPORT, prHeadSha: 'zzz9999', changedFiles: ['src/RoomCanvas.tsx'], isAncestor: () => false })
        .reasons,
    ).toContain('jev-report-stale');
    expect(
      checkJevReport({
        report: REPORT,
        prHeadSha: 'abc1234',
        changedFiles: ['src/RoomCanvas.tsx', 'src/isoTileRenderer.ts'],
      }).reasons,
    ).toContain('jev-report-uncovered-files');
    expect(
      checkJevReport({
        report: { ...REPORT, findings: [{ rule: 'no-frame-allocations', band: 'flag' }] },
        prHeadSha: 'abc1234',
        changedFiles: ['src/RoomCanvas.tsx'],
        rows: [{ rule: 'no-frame-allocations', where: 'x', band: 'clear', evidence: 'y' }],
      }).reasons,
    ).toContain('jev-report-band-mismatch:no-frame-allocations');
  });

  it('accepts an ancestor head sha and ignores report-only paths', () => {
    const verdict = checkJevReport({
      report: REPORT,
      prHeadSha: 'def5678',
      changedFiles: ['src/RoomCanvas.tsx', '.abide/reports/gate-def5678.json'],
      rows: [{ rule: 'no-frame-allocations', where: 'x', band: 'clear', evidence: 'y' }],
      isAncestor: (sha: string, head: string) => sha === 'abc1234' && head === 'def5678',
    });
    expect(verdict).toMatchObject({ pass: true, reasons: [] });
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
