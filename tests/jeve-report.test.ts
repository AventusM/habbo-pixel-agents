// tests/jeve-report.test.ts
// Q15: pure aggregation/verdict/markdown for the JEV handoff report plus an
// offline CLI smoke on temp fixtures (no network, no live abide, no git deps).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseEvents,
  matchGlob,
  ruleGovernsFile,
  governedModelRules,
  decideVerdict,
  buildReport,
  renderMarkdown,
} from '../scripts/jeve-report.mjs';
import type { BuildReportInput, JeveReport, Rubric, RubricRule } from '../scripts/jeve-report.mjs';

const GENERATED = '2026-09-26T17:00:00.000Z';
const EARLY = '2026-09-26T10:00:00.000Z';
const MID = '2026-09-26T11:00:00.000Z';
const LATE = '2026-09-26T16:30:00.000Z';
const HEAD_SHA = '1234567890abcdef1234567890abcdef12345678';
const ROOT = process.cwd();
const CLI = 'scripts/hooks/jeve-report.mjs';

function modelRule(id: string, scope?: string[]): RubricRule {
  return {
    id,
    text: `${id} rule text`,
    source: { path: '.abide/rubric.json', line: 1 },
    check: { type: 'model' },
    status: 'active',
    origin: 'project',
    ...(scope ? { scope } : {}),
  };
}

function lintRule(id: string): RubricRule {
  return {
    id,
    text: `${id} lint text`,
    source: { path: '.abide/rubric.json', line: 1 },
    check: { type: 'lint' },
    status: 'active',
    origin: 'project',
  };
}

function rubricOf(rules: RubricRule[]): Rubric {
  return { version: 1, compiledAt: GENERATED, sources: [], rules };
}

function verdict(ruleId: string, band: string, probability = 0.1): Record<string, unknown> {
  return { ruleId, band, probability };
}

interface CheckParts {
  at?: string;
  files?: string[];
  verdicts?: Array<Record<string, unknown>>;
  costUsd?: number;
}

function checkLine(parts: CheckParts = {}): string {
  return JSON.stringify({
    kind: 'check',
    at: parts.at ?? '2026-09-26T16:00:00.000Z',
    sessionId: 'ses_test',
    promptId: 'msg_test',
    files: parts.files ?? [],
    rules: 1,
    usage: { inputTokens: 10, outputTokens: 5, costUsd: parts.costUsd ?? 0.0001 },
    verdicts: parts.verdicts ?? [],
    blocked: false,
  });
}

function skipLine(parts: { at?: string; reason?: string } = {}): string {
  return JSON.stringify({
    kind: 'skip',
    at: parts.at ?? '2026-09-26T16:00:00.000Z',
    sessionId: 'ses_test',
    reason: parts.reason ?? 'turn diff incomplete',
    files: [],
  });
}

interface FixtureOpts {
  changedFiles?: string[];
  deletedFiles?: string[];
  rubric?: Rubric;
  eventsText?: string;
  baseTime?: string | null;
  liveResult?: BuildReportInput['liveResult'];
  extraNotes?: string[];
}

function fixtureReport(opts: FixtureOpts = {}): JeveReport {
  return buildReport({
    repoRoot: '/repo',
    repoName: 'AventusM/habbo-pixel-agents',
    branch: 'gsd/q15-jeve-handoff',
    base: { ref: 'origin/main', sha: 'ad4f6a0' + '0'.repeat(33) },
    head: { sha: HEAD_SHA, subject: 'feat: test subject' },
    changedFiles: opts.changedFiles ?? ['src/a.ts'],
    deletedFiles: opts.deletedFiles ?? [],
    rubric: opts.rubric ?? rubricOf([]),
    eventsText: opts.eventsText ?? '',
    liveResult: opts.liveResult ?? null,
    baseTime: opts.baseTime ?? null,
    generatedAt: GENERATED,
    extraNotes: opts.extraNotes ?? [],
  });
}

describe('parseEvents', () => {
  it('ignores malformed lines and unknown kinds', () => {
    const text = [
      checkLine({ files: ['src/a.ts'] }),
      'not json',
      JSON.stringify({ kind: 'compile-needed', at: LATE }),
      skipLine({}),
      '',
    ].join('\n');
    const parsed = parseEvents(text);
    expect(parsed.checks).toHaveLength(1);
    expect(parsed.skips).toHaveLength(1);
  });
});

describe('globs', () => {
  it('supports ** across dirs (zero dirs too), * in-segment, and ?', () => {
    expect(matchGlob('**/*.tsx', 'a.tsx')).toBe(true);
    expect(matchGlob('**/*.tsx', 'src/deep/a.tsx')).toBe(true);
    expect(matchGlob('**/*.tsx', 'a.ts')).toBe(false);
    expect(matchGlob('src/web/**/*.ts', 'src/web/wsClient.ts')).toBe(true);
    expect(matchGlob('src/web/**/*.ts', 'src/web/nested/a.ts')).toBe(true);
    expect(matchGlob('src/*.ts', 'src/deep/a.ts')).toBe(false);
    expect(matchGlob('src/iso*Renderer*.ts', 'src/isoTileRenderer.ts')).toBe(true);
    expect(matchGlob('src/?.ts', 'src/a.ts')).toBe(true);
    expect(matchGlob('src/?.ts', 'src/ab.ts')).toBe(false);
  });

  it('treats an absent scope as all files', () => {
    expect(ruleGovernsFile(modelRule('all'), 'docs/guide.md')).toBe(true);
    expect(ruleGovernsFile(modelRule('scoped', ['**/*.ts']), 'docs/guide.md')).toBe(false);
    const governed = governedModelRules(
      rubricOf([modelRule('a'), modelRule('b'), lintRule('lint')]),
      ['src/a.ts'],
    );
    expect(governed.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('aggregation', () => {
  it('takes the worst band per rule and overall', () => {
    const rules = [
      modelRule('r-clear', ['**/*.ts']),
      modelRule('r-act', ['**/*.ts']),
      modelRule('r-blocked', ['**/*.ts']),
    ];
    const eventsText = [
      checkLine({
        files: ['src/a.ts'],
        verdicts: [verdict('r-clear', 'clear', 0.01), verdict('r-act', 'act', 0.6)],
      }),
      checkLine({
        at: LATE,
        files: ['src/a.ts'],
        verdicts: [verdict('r-act', 'clear', 0.02), verdict('r-blocked', 'blocked', 0.9)],
      }),
    ].join('\n');
    const report = fixtureReport({ rubric: rubricOf(rules), eventsText });
    expect(report.rules.map((r) => r.id)).toEqual(['r-clear', 'r-act', 'r-blocked']);
    expect(report.rules.map((r) => r.band)).toEqual(['clear', 'act', 'blocked']);
    expect(report.rules[1].probability).toBe(0.6);
    expect(report.rules[1].checks).toBe(2);
    expect(report.rules[1].lastAt).toBe(LATE);
    expect(report.verdict).toBe('blocked');
    expect(report.totals.blocked).toBe(1);
    expect(report.totals.checks).toBe(4);
  });

  it('does not let a clear verdict hide an unverified rule', () => {
    const rules = [modelRule('r1', ['**/*.ts']), modelRule('r2', ['**/*.ts'])];
    const eventsText = checkLine({
      files: ['src/a.ts'],
      verdicts: [verdict('r1', 'clear', 0.03)],
    });
    const report = fixtureReport({ rubric: rubricOf(rules), eventsText });
    expect(report.verdict).toBe('unverified');
    expect(report.rules[1].evidence).toBe('none');
    expect(report.totals.unverified).toBe(1);
  });

  it('merges live verdicts with event evidence (worst band wins)', () => {
    const report = fixtureReport({
      rubric: rubricOf([modelRule('r1', ['**/*.ts'])]),
      eventsText: checkLine({
        files: ['src/a.ts'],
        verdicts: [verdict('r1', 'clear', 0.01)],
      }),
      liveResult: {
        ran: true,
        spendUsd: 0.000025,
        sections: [{ phase: 'edit', files: ['src/a.ts'], verdicts: [verdict('r1', 'act', 0.5)] }],
      },
    });
    expect(report.rules[0].band).toBe('act');
    expect(report.rules[0].evidence).toBe('event+live');
    expect(report.live.ran).toBe(true);
    expect(report.totals.costUsd).toBeCloseTo(0.000125, 8);
  });
});

describe('verdicts', () => {
  it('reports unverified without evidence and clear with clear evidence', () => {
    const rules = [modelRule('r1', ['**/*.ts'])];
    const bare = fixtureReport({ rubric: rubricOf(rules), eventsText: skipLine({}) });
    expect(bare.rules[0].band).toBe('unverified');
    expect(bare.rules[0].evidence).toBe('none');
    expect(bare.verdict).toBe('unverified');
    expect(bare.totals.skips).toBe(1);

    const supported = fixtureReport({
      rubric: rubricOf(rules),
      eventsText: checkLine({
        files: ['src/a.ts'],
        verdicts: [verdict('r1', 'clear', 0.02)],
      }),
    });
    expect(supported.rules[0].band).toBe('clear');
    expect(supported.rules[0].evidence).toBe('event');
    expect(supported.verdict).toBe('clear');
  });

  it('is empty with no changed files or no governed rules', () => {
    const noFiles = fixtureReport({
      changedFiles: [],
      rubric: rubricOf([modelRule('r1', ['**/*.ts'])]),
    });
    expect(noFiles.verdict).toBe('empty');
    const noRules = fixtureReport({ rubric: rubricOf([modelRule('r1', ['**/*.tsx'])]) });
    expect(noRules.verdict).toBe('empty');
    expect(decideVerdict({ changedFiles: [], rules: [{ band: 'blocked' }] })).toBe('empty');
    expect(decideVerdict({ changedFiles: ['x'], rules: [] })).toBe('empty');
    expect(decideVerdict({ changedFiles: ['x'], rules: [{ band: 'clear' }, { band: 'act' }] })).toBe(
      'act',
    );
    expect(
      decideVerdict({ changedFiles: ['x'], rules: [{ band: 'clear' }, { band: 'unverified' }] }),
    ).toBe('unverified');
  });
});

describe('files', () => {
  it('marks checked, unseen, and no-rules files', () => {
    const report = fixtureReport({
      changedFiles: ['src/a.ts', 'src/b.ts', 'docs/guide.md'],
      rubric: rubricOf([modelRule('r1', ['**/*.ts'])]),
      eventsText: checkLine({
        files: ['src/a.ts'],
        verdicts: [verdict('r1', 'clear')],
      }),
    });
    const byPath = new Map(report.files.map((file) => [file.path, file]));
    expect(byPath.get('src/a.ts')?.status).toBe('checked');
    expect(byPath.get('src/b.ts')?.status).toBe('unseen');
    expect(byPath.get('docs/guide.md')?.status).toBe('no-rules');
    expect(byPath.get('src/b.ts')?.governedRules).toEqual(['r1']);
    expect(byPath.get('docs/guide.md')?.governedRules).toEqual([]);
    expect(report.totals.governedFiles).toBe(2);
    expect(report.totals.files).toBe(3);
  });
});

describe('skips and window', () => {
  it('counts skip events and notes their distinct reasons', () => {
    const eventsText = [
      skipLine({ reason: 'turn diff incomplete: git could not snapshot the working tree in time' }),
      skipLine({ at: '2026-09-26T16:20:00.000Z', reason: 'no api key' }),
    ].join('\n');
    const report = fixtureReport({
      rubric: rubricOf([modelRule('r1', ['**/*.ts'])]),
      eventsText,
    });
    expect(report.totals.skips).toBe(2);
    const note = report.notes.find((entry) => entry.includes('skip event'));
    expect(note).toContain('turn diff incomplete: git could not snapshot the working tree in time');
    expect(note).toContain('no api key');
    expect(report.verdict).toBe('unverified');
  });

  it('bounds events to the base time when one is set', () => {
    const eventsText = [
      checkLine({
        at: EARLY,
        files: ['src/a.ts'],
        verdicts: [verdict('r1', 'clear')],
      }),
      checkLine({
        at: '2026-09-26T12:00:00.000Z',
        files: ['src/a.ts'],
        verdicts: [verdict('r1', 'act')],
      }),
    ].join('\n');
    const report = fixtureReport({
      rubric: rubricOf([modelRule('r1', ['**/*.ts'])]),
      eventsText,
      baseTime: MID,
    });
    expect(report.rules[0].band).toBe('act');
    expect(report.rules[0].checks).toBe(1);
    expect(report.notes.some((entry) => entry.includes('events bounded to base commit time'))).toBe(
      true,
    );
  });
});

describe('markdown', () => {
  it('contains the head sha, verdict heading, and every rule id', () => {
    const rules = [modelRule('r-clear', ['**/*.ts']), modelRule('r-quiet', ['**/*.ts'])];
    const report = fixtureReport({
      rubric: rubricOf(rules),
      eventsText: checkLine({
        files: ['src/a.ts'],
        verdicts: [verdict('r-clear', 'clear', 0.01)],
      }),
    });
    const markdown = renderMarkdown(report);
    expect(markdown).toContain(`head: ${HEAD_SHA}`);
    expect(markdown).toContain('# JEV handoff report — UNVERIFIED');
    expect(markdown).toContain('## Rules');
    expect(markdown).toContain('## Files');
    expect(markdown).toContain('## Verdict');
    for (const rule of rules) expect(markdown).toContain(rule.id);
    expect(markdown).toContain('src/a.ts');
  });
});

describe('CLI', () => {
  let dir = '';
  let rubricPath = '';
  let clearEventsPath = '';
  let bareEventsPath = '';
  let sourceFile = '';

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'jeve-'));
    mkdirSync(join(dir, 'fixtures'), { recursive: true });
    sourceFile = join(dir, 'a.ts');
    writeFileSync(sourceFile, 'export const a = 1;\n');
    rubricPath = join(dir, 'fixtures', 'rubric.json');
    writeFileSync(rubricPath, JSON.stringify(rubricOf([modelRule('r1', ['**/*.ts'])])));
    clearEventsPath = join(dir, 'fixtures', 'events-clear.jsonl');
    writeFileSync(
      clearEventsPath,
      checkLine({ files: [sourceFile], verdicts: [verdict('r1', 'clear', 0.02)] }) + '\n',
    );
    bareEventsPath = join(dir, 'fixtures', 'events-skip.jsonl');
    writeFileSync(bareEventsPath, skipLine({}) + '\n');
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function run(args: string[]): { status: number; stdout: string } {
    try {
      const stdout = execFileSync('node', [CLI, ...args], { cwd: ROOT, encoding: 'utf8' });
      return { status: 0, stdout };
    } catch (err) {
      const failure = err as { status?: number; stdout?: string | Buffer };
      return { status: failure.status ?? 1, stdout: String(failure.stdout ?? '') };
    }
  }

  function baseArgs(out: string, eventsPath: string): string[] {
    return [
      '--events', eventsPath,
      '--rubric', rubricPath,
      '--files', sourceFile,
      '--head-sha', HEAD_SHA,
      '--base-sha', HEAD_SHA,
      '--out', out,
      '--name', 'test',
      '--quiet',
    ];
  }

  it('writes <name>-<sha8>.json + .md and exits 0 for clear', () => {
    const out = join(dir, 'out-clear');
    const result = run(baseArgs(out, clearEventsPath));
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    const jsonPath = join(out, `test-${HEAD_SHA.slice(0, 8)}.json`);
    const mdPath = join(out, `test-${HEAD_SHA.slice(0, 8)}.md`);
    const report = JSON.parse(readFileSync(jsonPath, 'utf8')) as JeveReport;
    expect(report.verdict).toBe('clear');
    expect(report.changedFiles).toEqual([sourceFile]);
    expect(report.live.ran).toBe(false);
    expect(readFileSync(mdPath, 'utf8')).toContain('# JEV handoff report — CLEAR');

    const strict = run([...baseArgs(out, clearEventsPath), '--require-clear']);
    expect(strict.status).toBe(0);
  });

  it('exits 1 with --require-clear when evidence is unverified', () => {
    const out = join(dir, 'out-unverified');
    const result = run([...baseArgs(out, bareEventsPath), '--require-clear']);
    expect(result.status).toBe(1);
    const report = JSON.parse(
      readFileSync(join(out, `test-${HEAD_SHA.slice(0, 8)}.json`), 'utf8'),
    ) as JeveReport;
    expect(report.verdict).toBe('unverified');
  });

  it('treats a missing changed file as deleted and exits 0 for empty', () => {
    const missing = join(dir, 'gone.ts');
    const out = join(dir, 'out-empty');
    const result = run([
      '--events', clearEventsPath,
      '--rubric', rubricPath,
      '--files', missing,
      '--head-sha', HEAD_SHA,
      '--base-sha', HEAD_SHA,
      '--out', out,
      '--name', 'test',
      '--quiet',
      '--require-clear',
    ]);
    expect(result.status).toBe(0);
    const report = JSON.parse(
      readFileSync(join(out, `test-${HEAD_SHA.slice(0, 8)}.json`), 'utf8'),
    ) as JeveReport;
    expect(report.verdict).toBe('empty');
    expect(report.deletedFiles).toEqual([missing]);
  });
});
