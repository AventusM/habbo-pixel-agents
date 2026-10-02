#!/usr/bin/env node
// scripts/gsd-pr-contract.mjs
// Contract gate (M010/S03): mechanizes docs/guides/ISSUE-PR-CONTRACT.md for the
// review+merge lane. Parses the gsd-meta trailer from a slice PR body and checks
// outcome parity against the linked slice issue. abide/JEV judging moved to CI
// (.github/workflows/abide-judge.yml) and is no longer verified here. Refuses
// with a non-zero exit plus a machine-readable reason; --dry-run prints the
// verdict without writing (the gate never writes — it only reads).
//
// Usage:
//   node scripts/gsd-pr-contract.mjs --pr 123 --issue 144 [--dry-run]
//   node scripts/gsd-pr-contract.mjs --pr-file <path> --issue-file <path> [--dry-run]
//   node scripts/gsd-pr-contract.mjs --pr-body "<...>" --issue-body "<...>" [--dry-run]
//   --milestone/--slice pin the expected trailer keys; --comments-file <gh
//   comments json> plus --head-date <iso> feed the fresh-approval check;
//   --json emits one JSON object.
//
// Exit codes: 0 pass (gate clear), 1 refuse (a listed reason blocks),
// 2 usage error. Reasons are kebab-case strings (see REFUSALS below).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  isApprovalBody,
  findFreshApproval,
  approvalLifts,
} from './gsd-github-reactions.mjs';

export { isApprovalBody, findFreshApproval, approvalLifts };

export const EXIT_PASS = 0;
export const EXIT_REFUSE = 1;
export const EXIT_USAGE = 2;

/** Every refusal reason this gate can emit (machine-readable contract). */
export const REFUSALS = [
  'missing-trailer',
  'trailer-keys-mismatch',
  'trailer-outcomes-invalid',
  'issue-outcomes-missing',
  'parity-missing-outcomes',
  'parity-extra-outcomes',
];

// --- trailer + outcome parsing (contract sections 2, 3, 4) ---

const TRAILER_RX = /<!--\s*gsd-meta([\s\S]*?)-->/;
const OUTCOME_ID_RX = /^O-\d+$/;

/** Parse the gsd-meta trailer block. Returns {ok, trailer|error}. */
export function parseTrailer(body) {
  const text = String(body ?? '');
  const m = TRAILER_RX.exec(text);
  if (!m) return { ok: false, error: 'missing-trailer' };
  const trailer = { milestone: '', slice: '', parent: 'main', stackedOn: '', outcomes: [], humanMerge: false };
  for (const line of m[1].split('\n')) {
    const kv = /^\s*([a-z-]+)\s*:\s*(.*?)\s*$/.exec(line);
    if (!kv) continue;
    const [, key, value] = kv;
    if (key === 'milestone') trailer.milestone = value;
    else if (key === 'slice') trailer.slice = value;
    else if (key === 'parent') trailer.parent = value || 'main';
    else if (key === 'stacked-on') trailer.stackedOn = value;
    else if (key === 'outcomes') {
      trailer.outcomes = value.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (key === 'human-merge') trailer.humanMerge = value.toLowerCase() === 'true';
  }
  if (!trailer.milestone || !trailer.slice) return { ok: false, error: 'trailer-keys-mismatch' };
  const invalid = trailer.outcomes.filter((o) => !OUTCOME_ID_RX.test(o));
  if (invalid.length > 0) return { ok: false, error: 'trailer-outcomes-invalid', detail: invalid.join(',') };
  return { ok: true, trailer };
}

/** Outcome IDs from a `## Outcomes` section (`- O-N — text` bullets). */
export function parseIssueOutcomes(body) {
  const section = sectionText(String(body ?? ''), 'Outcomes');
  if (!section) return [];
  const ids = [];
  for (const line of section.split('\n')) {
    const m = /^\s*[-*]\s*(O-\d+)\s*[—–-]\s*\S/.exec(line);
    if (m) ids.push(m[1]);
  }
  return [...new Set(ids)];
}

/** Outcome IDs claimed by the PR evidence table (`| O-N | ... |` rows). */
export function parseEvidenceOutcomes(body) {
  const section = sectionText(String(body ?? ''), 'Outcome evidence');
  if (!section) return [];
  const ids = [];
  for (const line of section.split('\n')) {
    const m = /^\s*\|\s*(O-\d+)\s*\|/.exec(line);
    if (m) ids.push(m[1]);
  }
  return [...new Set(ids)];
}

/** Raw text of a `## <name>` section (up to the next `## `, `---`, or end). */
export function sectionText(body, name) {
  const lines = String(body ?? '').split('\n');
  const head = lines.findIndex((l) => new RegExp(`^##\\s+${name}\\s*$`, 'i').test(l.trim()));
  if (head === -1) return '';
  const rest = [];
  for (const line of lines.slice(head + 1)) {
    if (/^##\s+\S/.test(line.trim()) || /^\s*---\s*$/.test(line)) break;
    rest.push(line);
  }
  return rest.join('\n').trim();
}

/**
 * Outcome parity (contract section 2): the PR-claimed set (trailer outcomes ∪
 * evidence-table outcomes) must equal the issue set exactly. Refuses on
 * missing OR extra outcome IDs.
 */
export function checkParity({ prBody, issueBody, milestone = '', slice = '' }) {
  const reasons = [];
  const parsed = parseTrailer(prBody);
  if (!parsed.ok) {
    return { pass: false, missing: [], extra: [], reasons: [parsed.error] };
  }
  const { trailer } = parsed;
  if ((milestone && trailer.milestone !== milestone) || (slice && trailer.slice !== slice)) {
    reasons.push('trailer-keys-mismatch');
  }
  const issueIds = parseIssueOutcomes(issueBody);
  if (issueIds.length === 0) {
    reasons.push('issue-outcomes-missing');
    return { pass: reasons.length === 0, missing: [], extra: [], reasons };
  }
  const claimed = [...new Set([...trailer.outcomes, ...parseEvidenceOutcomes(prBody)])];
  const missing = issueIds.filter((id) => !claimed.includes(id));
  const extra = claimed.filter((id) => !issueIds.includes(id));
  if (missing.length > 0) reasons.push('parity-missing-outcomes');
  if (extra.length > 0) reasons.push('parity-extra-outcomes');
  return { pass: reasons.length === 0, missing, extra, reasons };
}

// --- CLI: inputs, gh fetching, verdict output ---

function flagValue(argv, name, fallback = null) {
  const idx = argv.indexOf(name);
  return idx !== -1 && argv[idx + 1] && !argv[idx + 1].startsWith('--') ? argv[idx + 1] : fallback;
}

function readMaybeFile(value) {
  if (typeof value === 'string' && value.startsWith('@')) {
    return fs.readFileSync(path.resolve(value.slice(1)), 'utf8');
  }
  return value;
}

function ghJson(args) {
  const out = execFileSync('gh', args, { encoding: 'utf8' });
  return JSON.parse(out);
}

function printUsage() {
  console.log(
    'Usage: node scripts/gsd-pr-contract.mjs (--pr <n> | --pr-file <p> | --pr-body <text>) ' +
      '(--issue <n> | --issue-file <p> | --issue-body <text>) ' +
      '[--milestone <M00X> --slice <S0Y>] ' +
      '[--comments-file <p> --head-date <iso> --owner <login>] [--json] [--dry-run]',
  );
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const asJson = argv.includes('--json');
  const milestone = flagValue(argv, '--milestone', '');
  const slice = flagValue(argv, '--slice', '');

  let prBody = flagValue(argv, '--pr-body', null);
  let issueBody = flagValue(argv, '--issue-body', null);
  const prNum = flagValue(argv, '--pr', null);
  const issueNum = flagValue(argv, '--issue', null);
  const prFile = flagValue(argv, '--pr-file', null);
  const issueFile = flagValue(argv, '--issue-file', null);
  if (prFile) prBody = `@${prFile}`;
  if (issueFile) issueBody = `@${issueFile}`;
  let comments = [];
  const commentsFile = flagValue(argv, '--comments-file', null);
  if (commentsFile) {
    try {
      comments = JSON.parse(readMaybeFile(`@${commentsFile}`));
    } catch {
      console.error('[gsd-pr-contract] cannot parse --comments-file');
      process.exit(EXIT_USAGE);
    }
  }
  const headDate = flagValue(argv, '--head-date', '');
  const owners = argv.filter((a, i) => argv[i - 1] === '--owner');

  try {
    if (prNum) {
      const pr = ghJson(['pr', 'view', prNum, '--json', 'body,headRefOid,files,comments,commits']);
      prBody = pr.body || '';
      if (comments.length === 0) comments = pr.comments || [];
    }
    if (issueNum) {
      const issue = ghJson(['issue', 'view', issueNum, '--json', 'body']);
      issueBody = issue.body || '';
    }
  } catch (err) {
    console.error(`[gsd-pr-contract] gh fetch failed: ${err.message}`);
    process.exit(EXIT_USAGE);
  }

  if (prBody == null || issueBody == null) {
    printUsage();
    process.exit(EXIT_USAGE);
  }
  prBody = readMaybeFile(prBody);
  issueBody = readMaybeFile(issueBody);

  const parity = checkParity({ prBody, issueBody, milestone, slice });

  let approval = { fresh: false, approval: null };
  if (comments.length > 0 && headDate) {
    approval = findFreshApproval(comments, headDate, owners.length > 0 ? owners : null);
  }
  const trailer = parseTrailer(prBody);
  const gates = approvalLifts({
    approval: approval.approval,
    gates: {
      humanMergeOnly: /human merge only/i.test(prBody),
      humanMergeTrailer: trailer.ok && trailer.trailer.humanMerge,
      stacked: Boolean(trailer.ok && trailer.trailer.stackedOn),
      labels: [],
    },
  });

  const verdict = {
    pass: parity.pass,
    parity,
    approval: { fresh: approval.fresh, by: approval.approval?.author || null, at: approval.approval?.createdAt || null },
    gates,
  };

  if (asJson) {
    console.log(JSON.stringify(verdict, null, 2));
  } else {
    const mode = dryRun ? 'dry-run' : 'live';
    console.log(`[gsd-pr-contract] ${mode}: parity ${parity.pass ? 'PASS' : 'REFUSE'} (${parity.reasons.join(',') || 'ok'})`);
    if (!parity.pass) {
      if (parity.missing.length > 0) console.log(`[gsd-pr-contract] missing outcomes: ${parity.missing.join(',')}`);
      if (parity.extra.length > 0) console.log(`[gsd-pr-contract] extra outcomes: ${parity.extra.join(',')}`);
    }
    console.log(`[gsd-pr-contract] approval: ${approval.fresh ? `fresh (${approval.approval.author})` : 'none/stale'}`);
    console.log(`[gsd-pr-contract] verdict: ${verdict.pass ? 'GATE CLEAR' : 'GATE REFUSES'}`);
  }
  process.exit(verdict.pass ? EXIT_PASS : EXIT_REFUSE);
}
