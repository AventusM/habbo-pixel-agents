#!/usr/bin/env node
// scripts/exp/hook-record.mjs (M004/S01)
// Deterministic turn-end capture for experiment runs. Agent hooks
// (spec / worker / review stop) call this to append one structured section
// record per turn, in the same shape as scripts/exp/schema.json sections.
//
// Correlation: --run-id flag or EXP_RUN_ID env (set by the S02 dispatcher).
// Without a run id the hook exits 0 silently so ordinary work is unaffected.
// Optional context via flags or EXP_ISSUE / EXP_PATH / EXP_MODEL / EXP_OUT.
//
// Usage:
//   node scripts/exp/hook-record.mjs --section build --result done \
//     --summary "..." [--run-id ...] [--issue 80] [--model ...] [--out ...]
// Exit 0 on success or intentional skip; exit 2 on invalid input.

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SECTIONS = new Set(['spec', 'build', 'review', 'merge']);
const RESULTS = new Set(['done', 'idle', 'blocked', 'rework', 'approved', 'merged', 'failed']);

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      console.error(`hook-record: unexpected positional arg ${JSON.stringify(a)}`);
      process.exit(2);
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) {
      console.error(`hook-record: --${key} needs a value`);
      process.exit(2);
    }
    o[key] = next;
    i++;
  }
  return o;
}

function asInt(raw, name) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    console.error(`hook-record: --${name} must be a non-negative integer, got ${JSON.stringify(raw)}`);
    process.exit(2);
  }
  return n;
}

function asTime(raw, name, fallback) {
  const v = raw ?? fallback;
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) {
    console.error(`hook-record: --${name} must be ISO date-time, got ${JSON.stringify(raw)}`);
    process.exit(2);
  }
  return t.toISOString();
}

function main() {
  const f = parseArgs(process.argv.slice(2));
  const runId = f['run-id'] ?? process.env.EXP_RUN_ID ?? null;
  if (!runId) {
    console.error('hook-record: no run id (pass --run-id or set EXP_RUN_ID); skipping');
    return;
  }

  const section = f.section ?? null;
  if (!section || !SECTIONS.has(section)) {
    console.error(`hook-record: --section must be one of ${[...SECTIONS].join('|')}`);
    process.exit(2);
  }
  const result = f.result ?? null;
  if (!result || !RESULTS.has(result)) {
    console.error(`hook-record: --result must be one of ${[...RESULTS].join('|')}`);
    process.exit(2);
  }

  const now = new Date().toISOString();
  const record = {
    run_id: runId,
    issue: asInt(f.issue ?? process.env.EXP_ISSUE, 'issue'),
    path: f.path ?? process.env.EXP_PATH ?? null,
    model: f.model ?? process.env.EXP_MODEL ?? null,
    section,
    started_at: asTime(f['started-at'], 'started-at', now),
    ended_at: asTime(f['ended-at'], 'ended-at', now),
    result,
    summary: f.summary ?? '',
    tool_calls: asInt(f['tool-calls'], 'tool-calls'),
    tests: f.tests ?? null,
    verdict: f.verdict ?? null,
    verdict_url: f['verdict-url'] ?? null,
    branch: f.branch ?? null,
    pr: asInt(f.pr, 'pr'),
    pr_url: f['pr-url'] ?? null,
  };

  const out =
    f.out ?? process.env.EXP_OUT ?? resolve(process.cwd(), 'scripts/exp/runs', `${runId}.jsonl`);
  mkdirSync(dirname(out), { recursive: true });
  const line = JSON.stringify(record);
  appendFileSync(out, line + '\n');
  process.stdout.write(line + '\n');
}

main();
