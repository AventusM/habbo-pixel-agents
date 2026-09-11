#!/usr/bin/env node
// scripts/exp/translate-loop.mjs (M004/S01)
// Normalize one gsd-loop run (issue + PR + verdicts + checks) into a
// schema-valid per-run JSONL record (scripts/exp/schema.json).
// The worker PR is the evaluation artifact.
//
// Usage:
//   node scripts/exp/translate-loop.mjs --issue 79 [--pr 92]
//     [--model opencode-go/deepseek-flash] [--run-id exp-...] [--path gsd-loop]
// Emits one JSON object per line to stdout.

import { execFileSync } from 'node:child_process';

function ghJson(args) {
  const out = execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  return JSON.parse(out);
}

function parseArgs(argv) {
  const out = { path: 'gsd-loop', model: 'unknown', runId: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--issue') out.issue = Number(argv[++i]);
    else if (a === '--pr') out.pr = Number(argv[++i]);
    else if (a === '--model') out.model = String(argv[++i]);
    else if (a === '--run-id') out.runId = String(argv[++i]);
    else if (a === '--path') out.path = String(argv[++i]);
  }
  if (!Number.isInteger(out.issue) || out.issue < 1) {
    console.error('translate-loop: --issue N is required');
    process.exit(2);
  }
  return out;
}

function verdictFirstLine(body) {
  return String(body || '').split('\n')[0] || '';
}

function isVerdict(line, issue) {
  return line.startsWith('gsd-loop verdict for ') && line.endsWith(` issue #${issue}`);
}

function verdictSha(line) {
  const m = /^gsd-loop verdict for ([0-9a-f]{7,40}) issue #\d+/.exec(line);
  return m ? m[1] : null;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const repo = ghJson(['repo', 'view', '--json', 'nameWithOwner']).nameWithOwner;
  const [owner, name] = repo.split('/');

  const issue = ghJson([
    'issue', 'view', String(opts.issue),
    '--json', 'number,title,state,labels,closedAt,createdAt',
  ]);

  // Find the PR: explicit --pr, else the merged/open PR closing the issue,
  // else the newest gsd/<issue>-* branch PR.
  let prNumber = opts.pr ?? null;
  let pr = null;
  if (prNumber == null) {
    const prs = ghJson([
      'pr', 'list', '--state', 'all', '--limit', '100',
      '--json', 'number,state,headRefName,closingIssuesReferences,createdAt',
    ]);
    const linked = prs
      .filter((p) => (p.closingIssuesReferences || []).some((r) => r.number === opts.issue))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const branded = prs
      .filter((p) => String(p.headRefName || '').startsWith(`gsd/${opts.issue}-`))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    prNumber = (linked[0] ?? branded[0] ?? {}).number ?? null;
  }
  if (prNumber != null) {
    pr = ghJson([
      'pr', 'view', String(prNumber),
      '--json',
      'number,title,state,isDraft,mergedAt,mergeCommit,headRefName,headRefOid,labels,createdAt,updatedAt,url,mergeable,mergeStateStatus,statusCheckRollup,closingIssuesReferences,comments',
    ]);
  }

  // Verdict comments authored on the PR (conversation timeline).
  const verdicts = [];
  if (pr && Array.isArray(pr.comments)) {
    for (const c of pr.comments) {
      const line = verdictFirstLine(c.body);
      if (isVerdict(line, opts.issue)) {
        verdicts.push({
          sha: verdictSha(line),
          createdAt: c.createdAt,
          author: c.author && c.author.login,
          blocking: /### Blocking[\s\S]*?-\s+\[/.test(String(c.body || '')),
        });
      }
    }
  }
  verdicts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const verdict = verdicts[verdicts.length - 1] ?? null;

  const labels = ((pr && pr.labels) || []).map((l) => l.name);
  const approved = labels.includes('gsd:approved');
  const rework = labels.includes('gsd:rework');
  const checks = Array.isArray(pr && pr.statusCheckRollup) ? pr.statusCheckRollup : [];
  const failing = checks.filter((c) =>
    ['FAILURE', 'CANCELLED', 'ACTION_REQUIRED', 'TIMED_OUT'].includes(c.status || c.conclusion),
  );
  const ciPass = checks.length > 0 && failing.length === 0;

  const runId =
    opts.runId ?? `exp-${new Date().toISOString().slice(0, 10)}-${opts.issue}-${(opts.model || 'unknown').split('/').pop()}`;

  const sections = [];
  if (pr) {
    sections.push({
      section: 'build',
      started_at: pr.createdAt,
      ended_at: pr.updatedAt,
      result: 'done',
      summary: `${pr.title} (${pr.headRefName})`,
      model: opts.model,
      tool_calls: null,
      tests: ciPass ? 'ci passing' : null,
      verdict: null,
      verdict_url: null,
    });
  }
  if (verdict) {
    sections.push({
      section: 'review',
      started_at: verdict.createdAt,
      ended_at: verdict.createdAt,
      result: approved ? 'approved' : rework || verdict.blocking ? 'rework' : 'blocked',
      summary: `verdict for ${String(verdict.sha || '').slice(0, 8)} issue #${opts.issue}${approved ? ' (gsd:approved)' : ''}${rework ? ' (gsd:rework)' : ''}`,
      model: opts.model,
      tool_calls: null,
      tests: ciPass ? 'ci passing' : null,
      verdict: verdict.sha,
      verdict_url: pr ? pr.url : null,
    });
  }
  if (pr && pr.state === 'MERGED') {
    sections.push({
      section: 'merge',
      started_at: pr.mergedAt,
      ended_at: pr.mergedAt,
      result: 'merged',
      summary: `merged as ${((pr.mergeCommit || {}).oid || '').slice(0, 8)}`,
      model: opts.model,
      tool_calls: null,
      tests: ciPass ? 'ci passing' : null,
      verdict: null,
      verdict_url: null,
    });
  }

  const record = {
    run_id: runId,
    issue: opts.issue,
    path: opts.path,
    model: opts.model,
    started_at: (pr && pr.createdAt) || issue.createdAt,
    ended_at: (pr && (pr.mergedAt || pr.updatedAt)) || issue.closedAt || issue.createdAt,
    branch: pr ? pr.headRefName : null,
    pr: pr ? pr.number : null,
    pr_url: pr ? pr.url : null,
    worktree: null,
    sections,
    evaluation: {
      pr_url: pr ? pr.url : null,
      tests: ciPass ? 'ci passing' : null,
      verdict: verdict ? verdict.sha : null,
      merged: pr ? pr.state === 'MERGED' : null,
      merged_at: pr ? pr.mergedAt : null,
    },
  };

  process.stdout.write(JSON.stringify(record) + '\n');
}

main();
