#!/usr/bin/env node
// scripts/exp/select-brief.mjs (M004 select lane)
// Build a judge-run briefing that compares 2+ worker PRs for one issue and
// recommends a single winner for human merge. One detached read-only
// checkout per candidate PR head, one self-contained prompt, one judge run
// id. The judge model must differ from every resolvable candidate build
// model (refused). Launching the judge stays an explicit operator step.
//
// Usage:
//   node scripts/exp/select-brief.mjs --issue 97 --prs 99,100 \
//     [--model opencode-go/kimi-k3] [--run 20260912-153000] [--dry-run]
//   node scripts/exp/select-brief.mjs --cleanup --run-id <judge-run-id>
//
// Flags --repo, --runs-dir and --worktree-root override locations (tests).
// Flags --prs-file <json array> and --issue-file <title\nbody> skip gh (tests).
// Exit 0 on success; exit 2 on usage/validation errors.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_MODEL = 'opencode-go/kimi-k3';

function parseArgs(argv) {
  const o = { model: DEFAULT_MODEL, path: 'direct', dryRun: false, cleanup: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') { o.dryRun = true; continue; }
    if (a === '--cleanup') { o.cleanup = true; continue; }
    if (a === '--help' || a === '-h') { o.help = true; continue; }
    if (!a.startsWith('--')) fail(`unexpected positional arg ${JSON.stringify(a)}`);
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) fail(`--${key} needs a value`);
    o[camel(key)] = next;
    i++;
  }
  return o;
}

function camel(k) {
  return k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function fail(msg) {
  console.error(`select-brief: ${msg}`);
  process.exit(2);
}

function sh(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', ...opts });
  } catch (e) {
    const err = e.stderr || e.message;
    fail(`${cmd} ${args.join(' ')} failed: ${String(err).split('\n')[0]}`);
  }
}

function usage() {
  return [
    'select-brief: judge briefing + candidate checkouts for 2+ worker PRs',
    '  select-brief --issue N --prs a,b [--model opencode-go/kimi-k3] [--dry-run]',
    '  select-brief --cleanup --run-id <judge-run-id>',
  ].join('\n');
}

function stampNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function slug(model) {
  return model
    .split('/')
    .slice(-2)
    .join('-')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fetchPr(root, num) {
  const pr = JSON.parse(
    sh('gh', ['pr', 'view', String(num), '--json', 'number,title,body,headRefOid,headRefName,baseRefName,url,files'], { cwd: root }),
  );
  pr.headSha = pr.headRefOid;
  const m = /model (opencode-go\/[A-Za-z0-9._-]+)/.exec(pr.body || '');
  pr.buildModel = m ? m[1] : 'unknown';
  return pr;
}

function statFromFiles(files) {
  if (!Array.isArray(files) || files.length === 0) return '(diff stat unavailable)';
  const rows = files
    .slice(0, 40)
    .map((f) => `  ${f.path} +${f.additions ?? '?'} -${f.deletions ?? '?'}`);
  if (files.length > 40) rows.push(`  ... (${files.length - 40} more files)`);
  return rows.join('\n').slice(0, 1500);
}

function buildPrompt(o) {
  const cands = o.candidates
    .map(
      (c) =>
        `PR #${c.number} (${c.title}) — model ${c.buildModel}, head ${c.headSha}, dir ${c.dir}\nDiff stat:\n\`\`\`\n${c.stat}\n\`\`\``,
    )
    .join('\n\n');
  return [
    `# Experiment judge briefing (M004 select lane)`,
    ``,
    `You compare ${o.candidates.length} worker PRs for issue #${o.issue} and recommend ONE winner for human merge (or no-winner with reasons). Judge the artifacts, never the models. Canonical procedure post-merge: scripts/exp/SELECT.md.`,
    ``,
    `## Environment`,
    `  export EXP_RUN_ID=${o.runId}   (judge run; own jsonl, not a worker file)`,
    `  export EXP_ISSUE=${o.issue}`,
    `  export EXP_MODEL=${o.model}   (judge; disjoint from all build models)`,
    `  export EXP_OUT=${o.expOut}`,
    ``,
    `Candidate checkouts (READ-ONLY, detached at PR heads):`,
    ...o.candidates.map((c) => `- ${c.dir}  (PR #${c.number}, head ${c.headSha})`),
    `Never commit, push, or modify them. A node_modules symlink may exist for test runs; ignore it.`,
    ``,
    `## Candidates`,
    ``,
    cands,
    ``,
    `Issue fidelity source:`,
    o.issueBody.slice(0, 2500),
    ``,
    `Prior evidence: each PR carries eval verdict comments (first line 'gsd-loop verdict for ...') — read them with gh pr view <N> --json comments, then verify key claims yourself (re-run suites, spot-check diffs). Verdicts inform, they do not decide.`,
    ``,
    `## Comparison (score each, then pick)`,
    `- Correctness margin: which new tests assert more behavior (keys, edges, failure precision — quote assertions).`,
    `- Diff minimality: smaller single-concern diffs win ties.`,
    `- Robustness: flake risks (shared dirs, timing, ordering) count against.`,
    `- Commit hygiene: message format, one concern.`,
    `- Eval-verdict agreement: where verdicts disagree or hedge, re-check the underlying claim.`,
    ``,
    `## Selection delivery (exact format)`,
    `Post ONE comment on issue #${o.issue}, first line EXACTLY:`,
    `exp-select for issue #${o.issue}: winner #<M> (<build-model>)`,
    `(or: exp-select for issue #${o.issue}: no winner)`,
    `then Scores: one line per candidate, Rationale: 2–4 sentences, Runner-up disposition: recommendation only.`,
    `Then append the judge record:`,
    `  node scripts/exp/hook-record.mjs --run-id ${o.runId} --issue ${o.issue} --model ${o.model} --out ${o.expOut} --section review --result approved --verdict <winner-short-sha> --verdict-url <issue-comment-url> --summary "selected #<M> over #<rest>: <reasons>"`,
    `(For no-winner: --result blocked, summary states why.)`,
    ``,
    `## Standing rules (hard)`,
    `- Recommend only. NEVER merge, approve, or close anything.`,
    `- Main untouched. Candidate checkouts read-only. Figure assets local-only/gitignored.`,
  ].join('\n') + '\n';
}

function brief(o) {
  const issue = Number(o.issue);
  if (!Number.isInteger(issue) || issue < 1) fail('--issue N (positive integer) is required');
  const prNums = String(o.prs || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (prNums.length < 2) fail('--prs a,b (two or more worker PRs) is required');

  const root = resolve(o.repo ?? sh('git', ['rev-parse', '--show-toplevel']).trim());
  const runsDir = resolve(o.runsDir ?? join(root, 'scripts/exp/runs'));
  const wtRoot = resolve(o.worktreeRoot ?? join(root, '.worktrees'));
  const run = o.run ?? stampNow();
  const runId = `exp-${run}-${issue}-select-${slug(o.model)}`;

  let prs;
  if (o.prsFile) {
    prs = JSON.parse(readFileSync(resolve(o.prsFile), 'utf8'));
  } else {
    prs = prNums.map((n) => fetchPr(root, Number(n)));
  }
  for (const pr of prs) {
    if (!pr.headSha) fail(`PR head sha unavailable for ${pr.number ?? '?'}`);
    pr.buildModel = pr.buildModel ?? pr.model ?? 'unknown';
    if (pr.buildModel !== 'unknown' && o.model === pr.buildModel) {
      fail(`judge model ${o.model} equals build model of PR #${pr.number} (judge must be disjoint)`);
    }
  }

  let issueBody = '';
  if (o.issueFile) {
    issueBody = readFileSync(resolve(o.issueFile), 'utf8');
  } else if (!o.dryRun) {
    try {
      issueBody = execFileSync('gh', ['issue', 'view', String(issue), '--json', 'body', '--jq', '.body'], {
        encoding: 'utf8', cwd: root, timeout: 60000,
      });
    } catch { issueBody = '(issue body unavailable offline)'; }
  } else {
    issueBody = '(dry-run: issue body not fetched)';
  }

  const selDir = join(wtRoot, '.select', runId);
  const candidates = prs.map((pr) => ({
    number: pr.number,
    title: pr.title ?? '',
    buildModel: pr.buildModel,
    headSha: pr.headSha,
    dir: join(selDir, `pr${pr.number}`),
    stat: o.dryRun || o.prsFile ? '(offline fixture)' : statFromFiles(pr.files),
  }));

  const expOut = join(runsDir, `${runId}.jsonl`);
  const promptPath = join(runsDir, `${runId}.prompt.md`);
  const prompt = buildPrompt({
    runId, issue, model: o.model, expOut, issueBody, candidates,
  });

  if (o.dryRun) {
    process.stdout.write(`JUDGE ${runId} issue=${issue} model=${o.model}\n`);
    for (const c of candidates) {
      process.stdout.write(`CANDIDATE pr=${c.number} model=${c.buildModel} dir=${c.dir}\n`);
    }
    process.stdout.write('DRY-RUN (no writes)\n');
    return;
  }

  mkdirSync(selDir, { recursive: true });
  const nm = join(root, 'node_modules');
  for (const c of candidates) {
    if (!existsSync(c.dir)) {
      sh('git', ['-C', root, 'worktree', 'add', '--detach', c.dir, c.headSha]);
    }
    const link = join(c.dir, 'node_modules');
    if (existsSync(nm) && !existsSync(link)) {
      try { symlinkSync(nm, link, 'dir'); } catch { /* best effort */ }
    }
  }
  mkdirSync(runsDir, { recursive: true });
  writeFileSync(
    join(runsDir, `${runId}.meta.json`),
    JSON.stringify({
      run_id: runId, issue, model: o.model, path: o.path ?? 'direct', kind: 'select',
      candidates: candidates.map((c) => ({ pr: c.number, model: c.buildModel, head_sha: c.headSha })),
      created_at: new Date().toISOString(), pr: null,
    }, null, 2) + '\n',
  );
  writeFileSync(promptPath, prompt);
  process.stdout.write(`JUDGE ${runId} issue=${issue} model=${o.model}\n`);
  for (const c of candidates) {
    process.stdout.write(`CANDIDATE pr=${c.number} model=${c.buildModel} dir=${c.dir}\n`);
  }
  process.stdout.write(`PROMPT ${promptPath}\n`);
  process.stdout.write(`OPERATOR next: spawn one judge agent (model ${o.model}) with the PROMPT content as its briefing\n`);
}

function cleanup(o) {
  if (!o.runId) fail('--run-id <judge-run-id> is required for --cleanup');
  const root = resolve(o.repo ?? sh('git', ['rev-parse', '--show-toplevel']).trim());
  const selDir = join(resolve(o.worktreeRoot ?? join(root, '.worktrees')), '.select', o.runId);
  if (existsSync(selDir)) {
    for (const name of readdirSync(selDir)) {
      sh('git', ['-C', root, 'worktree', 'remove', '--force', join(selDir, name)]);
    }
    rmdirSync(selDir);
    process.stdout.write(`REMOVED ${o.runId}\n`);
  } else {
    process.stdout.write(`NOTHING to remove for ${o.runId}\n`);
  }
  // Judge records are evaluation artifacts: kept.
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) {
    process.stdout.write(usage() + '\n');
    return;
  }
  if (o.cleanup) {
    cleanup(o);
    return;
  }
  brief(o);
}

main();
