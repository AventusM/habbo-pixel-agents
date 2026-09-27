#!/usr/bin/env node
// scripts/gsd-github-publish.mjs
// Plan-time publisher (M010/S02, D035): builds the canonical slice-issue body
// per docs/guides/ISSUE-PR-CONTRACT.md sections 1,3,4 from GSD slice state
// (DB or roadmap file) and creates-or-updates the issue idempotently by exact
// title match with labels enhancement,gsd,gsd:synced,M00X.
//
// Usage:
//   node scripts/gsd-github-publish.mjs --milestone M010 --slice S02 [--dry-run]
//   node scripts/gsd-github-publish.mjs --milestone M010 [--dry-run]
//   --dry-run prints the canonical body without writing (read-only).
//   Never touches issues carrying gsd:blocked. Cap: callers publish at most
//   8 slices per pass (enforced by the lane, not here).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const SYNC_LABELS_BASE = ['enhancement', 'gsd', 'gsd:synced'];
export const BOT_MARKER = '<!-- gsd-sync -->';
export const PUBLISH_CAP = 8;

/** Exact canonical title: "M010/S02: <slice title>". */
export function buildIssueTitle(milestoneId, sliceId, sliceTitle) {
  return `${milestoneId}/${sliceId}: ${sliceTitle}`;
}

/** Canonical gsd-meta trailer (contract section 3). */
export function buildTrailer({ milestone, slice, parent = 'main', stackedOn = '', outcomes = [], humanMerge = false }) {
  const list = Array.isArray(outcomes) ? outcomes.join(',') : outcomes;
  return [
    '<!-- gsd-meta',
    `milestone: ${milestone}`,
    `slice: ${slice}`,
    `parent: ${parent}`,
    `stacked-on: ${stackedOn}`,
    `outcomes: ${list}`,
    `human-merge: ${humanMerge ? 'true' : 'false'}`,
    '-->',
  ].join('\n');
}

/**
 * Canonical slice-issue body (contract section 1 + footer + trailer).
 * Outcomes/exclusions are [{id, text}] with stable O-N / X-N ids.
 */
export function buildIssueBody({
  milestone,
  slice,
  goal,
  demo,
  outcomes = [],
  exclusions = [],
  tasks = [],
  risk = 'medium',
  depends = [],
  parent = 'main',
  humanMerge = false,
}) {
  const outcomeLines =
    outcomes.length > 0
      ? outcomes.map((o) => `- ${o.id} — ${o.text}`).join('\n')
      : '- O-1 — <verifiable end state>';
  const exclusionLines =
    exclusions.length > 0
      ? exclusions.map((x) => `- ${x.id} — ${x.text}`).join('\n')
      : '- X-1 — <explicit non-goal>';
  const taskLines =
    tasks.length > 0
      ? tasks.map((t) => `- ${t}`).join('\n')
      : '- Planned at execution time by the worker lane';
  const outcomeIds = outcomes.length > 0 ? outcomes.map((o) => o.id) : ['O-1'];
  const dependsText = Array.isArray(depends) ? depends.join(',') || 'none' : depends || 'none';
  return [
    '## Goal',
    '',
    goal || '<one-sentence deliverable>',
    '',
    '## Demo',
    '',
    demo || '<observable end state — what a human checks>',
    '',
    '## Outcomes',
    '',
    outcomeLines,
    '',
    '## Exclusions',
    '',
    exclusionLines,
    '',
    '## GSD tasks',
    '',
    taskLines,
    '',
    '---',
    `GSD slice ${milestone}/${slice} (risk: ${risk}, depends: ${dependsText}) — planned in \`.gsd/\`; the two-way sync will label/comment/close this issue when the slice reaches a terminal state.`,
    '',
    buildTrailer({ milestone, slice, parent, outcomes: outcomeIds, humanMerge }),
  ].join('\n');
}

/** True when the issue carries gsd:blocked (never touch). */
export function hasBlockedLabel(issue) {
  const labels = Array.isArray(issue?.labels) ? issue.labels : [];
  return labels.some((l) => (typeof l === 'string' ? l : l?.name) === 'gsd:blocked');
}

/** Exact title match (trimmed) — the idempotency key for upsert. */
export function isExactTitleMatch(issueTitle, expectedTitle) {
  return typeof issueTitle === 'string' && issueTitle.trim() === expectedTitle.trim();
}

function defaultExec(cmd, args, opts) {
  return execFileSync(cmd, args, { encoding: 'utf8', ...opts });
}

/** Ensure the M00X milestone label exists (best-effort; already-exists is fine). */
export function ensureMilestoneLabel(execFn, milestoneId, { dryRun = false } = {}) {
  if (dryRun) return { action: 'dry-run', milestoneId };
  try {
    execFn('gh', ['label', 'create', milestoneId, '--description', `Milestone ${milestoneId}`, '--color', '5319e7']);
  } catch {
    // label already exists — idempotent
  }
  return { action: 'ensured', milestoneId };
}

/** List candidate issues by slice prefix; the caller picks the exact title match. */
export function listCandidateIssues(execFn, milestoneId, sliceId) {
  const query = `${milestoneId}/${sliceId} in:title`;
  const out = execFn('gh', [
    'issue', 'list', '--state', 'all', '--search', query,
    '--json', 'number,title,state,labels', '--limit', '20',
  ]);
  const parsed = JSON.parse(out);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Idempotent upsert by exact title: create when absent, edit body when present
 * (never duplicate). Skips gsd:blocked issues. Returns {action, number?}.
 */
export function upsertSliceIssue(
  execFn,
  { milestoneId, sliceId, title, body, dryRun = false },
) {
  const expectedTitle = title;
  let candidates = [];
  if (!dryRun) {
    candidates = listCandidateIssues(execFn, milestoneId, sliceId);
  }
  const existing = candidates.find((i) => isExactTitleMatch(i?.title, expectedTitle)) ?? null;
  const labels = [...SYNC_LABELS_BASE, milestoneId].join(',');
  if (dryRun) {
    return { action: 'dry-run', title: expectedTitle, body };
  }
  if (existing) {
    if (hasBlockedLabel(existing)) {
      return { action: 'skipped-blocked', number: existing.number };
    }
    execFn('gh', ['issue', 'edit', String(existing.number), '--body', body]);
    return { action: 'updated', number: existing.number };
  }
  const out = execFn('gh', [
    'issue', 'create', '--title', expectedTitle, '--label', labels, '--body', body,
  ]);
  const m = /\/issues\/(\d+)/.exec(String(out));
  return { action: 'created', number: m ? Number(m[1]) : undefined, raw: String(out).trim() };
}

// --- slice state loading (DB first, roadmap/PLAN fallback) ---

function tryReadDbSlices(milestoneId) {
  try {
    const out = execFileSync(
      'sqlite3',
      ['.gsd/gsd.db', `SELECT id,title,goal,demo,success_criteria,risk,depends FROM slices WHERE milestone_id='${milestoneId}' ORDER BY id;`],
      { encoding: 'utf8' },
    );
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [id, title, goal, demo, success, risk, depends] = line.split('|');
        return { id, title, goal, demo, success, risk, depends };
      });
  } catch {
    return null;
  }
}

function tryReadDbTasks(milestoneId, sliceId) {
  try {
    const out = execFileSync(
      'sqlite3',
      ['.gsd/gsd.db', `SELECT id,title FROM tasks WHERE milestone_id='${milestoneId}' AND slice_id='${sliceId}' ORDER BY sequence, id;`],
      { encoding: 'utf8' },
    );
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [id, title] = line.split('|');
        return `${id}: ${title}`;
      });
  } catch {
    return [];
  }
}

function findPhaseDir(milestoneNum) {
  const phases = '.gsd/phases';
  try {
    for (const name of fs.readdirSync(phases)) {
      if (name.startsWith(`${milestoneNum}-`) || name.startsWith(`${milestoneNum}`)) {
        return path.join(phases, name);
      }
    }
  } catch {
    // no phases dir
  }
  return null;
}

/** Load one slice's publish state; returns null when unknown. */
export function getSliceState(milestoneId, sliceId) {
  const num = milestoneId.replace(/^M0*/, '');
  const dbSlices = tryReadDbSlices(milestoneId);
  const dbHit = dbSlices?.find((s) => s.id === sliceId);
  const tasks = tryReadDbTasks(milestoneId, sliceId);
  if (dbHit) {
    return {
      milestoneId,
      sliceId,
      title: dbHit.title || `${milestoneId}/${sliceId}`,
      goal: dbHit.goal || '',
      demo: dbHit.demo || '',
      outcomes: [],
      exclusions: [],
      tasks,
      risk: dbHit.risk || 'medium',
      depends: (() => {
        try {
          const d = JSON.parse(dbHit.depends || '[]');
          return Array.isArray(d) ? d : [];
        } catch {
          return [];
        }
      })(),
    };
  }
  const dir = findPhaseDir(num.padStart(2, '0'));
  if (!dir) return null;
  try {
    const roadmap = fs.readFileSync(path.join(dir, `${num.padStart(2, '0')}-ROADMAP.md`), 'utf8');
    const rx = new RegExp(`\\*\\*${sliceId}:\\s*(.+?)\\*\\*`);
    const m = rx.exec(roadmap);
    if (!m) return null;
    return {
      milestoneId,
      sliceId,
      title: m[1].trim(),
      goal: '',
      demo: '',
      outcomes: [],
      exclusions: [],
      tasks,
      risk: 'medium',
      depends: [],
    };
  } catch {
    return null;
  }
}

/** Load all slices for a milestone (DB first). */
export function getMilestoneSlices(milestoneId) {
  const dbSlices = tryReadDbSlices(milestoneId);
  if (dbSlices && dbSlices.length > 0) return dbSlices.map((s) => s.id);
  return [];
}

function flagValue(argv, name, fallback = null) {
  const idx = argv.indexOf(name);
  return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : fallback;
}

function printUsage() {
  console.log('Usage: node scripts/gsd-github-publish.mjs --milestone <M00X> [--slice <S0Y>] [--dry-run]');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const argv = process.argv.slice(2);
  const milestoneId = flagValue(argv, '--milestone', null);
  const sliceId = flagValue(argv, '--slice', null);
  const dryRun = argv.includes('--dry-run');
  if (!milestoneId) {
    printUsage();
    process.exit(2);
  }
  const slices = sliceId ? [sliceId] : getMilestoneSlices(milestoneId);
  if (slices.length === 0) {
    console.error(`[gsd-github-publish] no slices found for ${milestoneId}`);
    process.exit(1);
  }
  if (slices.length > PUBLISH_CAP) {
    console.error(`[gsd-github-publish] refusing: ${slices.length} slices exceeds cap ${PUBLISH_CAP}`);
    process.exit(2);
  }
  if (!dryRun) ensureMilestoneLabel(defaultExec, milestoneId);
  else console.log(`[gsd-github-publish] dry-run: would ensure label ${milestoneId}`);
  for (const sid of slices.slice(0, PUBLISH_CAP)) {
    const state = getSliceState(milestoneId, sid);
    if (!state) {
      console.log(`[gsd-github-publish] ${milestoneId}/${sid} — no local slice state, skipping`);
      continue;
    }
    const title = buildIssueTitle(milestoneId, sid, state.title);
    const body = buildIssueBody({
      milestone: milestoneId,
      slice: sid,
      goal: state.goal,
      demo: state.demo,
      outcomes: state.outcomes,
      exclusions: state.exclusions,
      tasks: state.tasks,
      risk: state.risk,
      depends: state.depends,
    });
    if (dryRun) {
      console.log(`[gsd-github-publish] dry-run ${milestoneId}/${sid}: would upsert "${title}"`);
      console.log('--- body begin ---');
      console.log(body);
      console.log('--- body end ---');
      continue;
    }
    const result = upsertSliceIssue(defaultExec, { milestoneId, sliceId: sid, title, body });
    console.log(`[gsd-github-publish] ${milestoneId}/${sid} ${result.action}${result.number ? ` #${result.number}` : ''}`);
  }
}
