#!/usr/bin/env node
// scripts/exp/eval-brief.mjs (M004 eval lane)
// Build a merge-lane reviewer briefing for one worker PR: a detached
// read-only eval worktree at the PR head sha plus a prompt that points at
// scripts/exp/EVAL.md, bakes in the diff stat, and dictates the exact
// verdict format (parsed by translate-loop) and the review hook record.
// The reviewer model must differ from the recorded build model (refused).
// Launching the reviewer stays an explicit operator step.
//
// Usage:
//   node scripts/exp/eval-brief.mjs --pr 99 --run-id exp-...-97-<slug> \
//     [--model opencode-go/kimi-k3] [--dry-run]
//   node scripts/exp/eval-brief.mjs --cleanup --run-id exp-...-97-<slug>
//
// Flags --repo, --runs-dir and --worktree-root override locations (tests).
// Flag --pr-file <json> skips the gh fetch (tests).
// Exit 0 on success; exit 2 on usage/validation errors.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_MODEL = 'opencode-go/kimi-k3';

function parseArgs(argv) {
  const o = { model: DEFAULT_MODEL, dryRun: false, cleanup: false };
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
  console.error(`eval-brief: ${msg}`);
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
    'eval-brief: reviewer briefing + read-only worktree for one worker PR',
    '  eval-brief --pr N --run-id ID [--model opencode-go/kimi-k3] [--dry-run]',
    '  eval-brief --cleanup --run-id ID',
  ].join('\n');
}

function fetchPr(root, num) {
  const pr = JSON.parse(
    sh('gh', ['pr', 'view', String(num), '--json', 'number,title,headRefOid,headRefName,baseRefName,url,files'], { cwd: root }),
  );
  pr.headSha = pr.headRefOid;
  return pr;
}

function statFromFiles(files) {
  if (!Array.isArray(files) || files.length === 0) return '(diff stat unavailable)';
  const rows = files
    .slice(0, 60)
    .map((f) => `  ${f.path} +${f.additions ?? '?'} -${f.deletions ?? '?'}`);
  if (files.length > 60) rows.push(`  ... (${files.length - 60} more files)`);
  return rows.join('\n').slice(0, 2000);
}

function buildPrompt(o) {
  return [
    `# Experiment reviewer briefing (M004 eval lane)`,
    ``,
    `You review worker PR #${o.prNumber} (${o.prTitle}) for run ${o.runId}. Apply the rubric below (canonical source post-merge: scripts/exp/EVAL.md) and follow the verdict format exactly.`,
    ``,
    `## Rubric (every finding needs file:line + command evidence, never vibes)`,
    `- R1 scope containment (blocking): diff limited to issue-relevant paths; no lane junk (.gsd/exec/, .gsd/uat/, node_modules, lockfiles unless justified, IDE files); no unrelated refactors. Compare the worker's own commits vs the pinned base (git diff base...head); PR-vs-main drift from a newer base is operator scope — say so, do not fail the worker for it.`,
    `- R2 tests as proof (red suite is blocking): run the issue-stated suite green in your worktree; new tests must exercise the new behavior (reference the new code path; would fail if it regressed); tests hermetic. The worker run records must parse as JSONL with schema-required keys (run_id, issue, path, model per line; sections per run).`,
    `- R3 repo standards (violations blocking): npx tsc --noEmit clean where TS touched (strict); no console.log/debugger leftovers; no secrets/keys; naming + placement follow the area (tests/ for tests, scripts/exp/*.mjs plain node); commit message <type>(<scope>): <what> (#N [model]). No lint config exists — do not invent a lint gate.`,
    `- R4 issue fidelity: map every ## Outcomes box to file:line evidence or mark unmet (blocking if unmet).`,
    `- R5 blast radius (advisory): what could break, who consumes touched files.`,
    `Any blocking R1–R4 fail → REWORK, else APPROVE.`,
    ``,
    `## Environment`,
    `  export EXP_RUN_ID=${o.runId}   (hook correlation: review record lands in the WORKER run file)`,
    `  export EXP_ISSUE=${o.issue}`,
    `  export EXP_MODEL=${o.model}   (reviewer; disjoint from build model ${o.buildModel})`,
    `  export EXP_OUT=${o.expOut}`,
    ``,
    `Your checkout (READ-ONLY): ${o.evalWorktree} (detached at PR head ${o.headSha}). Never commit, push, merge, or modify it. Verify \`git status --short\` is empty when done. A node_modules symlink may exist for test runs; it is untracked lane junk, ignore it.`,
    ``,
    `## PR under review`,
    `PR: ${o.prUrl} (head ${o.headRefName}, base into ${o.baseRefName})`,
    `Build model: ${o.buildModel} | Worker branch: ${o.workerBranch}`,
    `Diff stat:`,
    '```',
    o.stat,
    '```',
    `Issue body (fidelity source):`,
    o.issueBody.slice(0, 3000),
    ``,
    `## Checks`,
    `Run R1–R5 above with evidence. For R2, execute the suite yourself; do not trust the worker's word.`,
    ``,
    `## Verdict delivery (exact format — a translator parses it)`,
    `Write ${o.verdictPath}, first line EXACTLY:`,
    `gsd-loop verdict for ${o.headSha} issue #${o.issue}`,
    `then Verdict: APPROVE|REWORK — <one line>, ### Evidence bullets, ### Blocking with - [ ] items (REWORK) or (none) (APPROVE). Post:`,
    `  gh pr comment ${o.prNumber} --body-file ${o.verdictPath}`,
    `Apply the matching machine label (translate-loop reads it; nothing auto-merges on it):`,
    `  gh pr edit ${o.prNumber} --add-label gsd:approved   (or gsd:rework; remove the other if present)`,
    `Then append the review record (result must match the verdict):`,
    `  node scripts/exp/hook-record.mjs --run-id ${o.runId} --issue ${o.issue} --model ${o.model} --out ${o.expOut} --section review --result <approved|rework> --verdict ${o.headSha.slice(0, 12)} --verdict-url <comment-url> --summary "<one line>"`,
    ``,
    `## Standing rules (hard)`,
    `- No commits, pushes, merges, approvals. Comment + hook record only.`,
    `- Main untouched. Eval worktree read-only. Figure assets local-only/gitignored.`,
  ].join('\n') + '\n';
}

function brief(o) {
  if (!o.runId) fail('--run-id ID (worker run) is required');
  const root = resolve(o.repo ?? sh('git', ['rev-parse', '--show-toplevel']).trim());
  const runsDir = resolve(o.runsDir ?? join(root, 'scripts/exp/runs'));
  const metaPath = join(runsDir, `${o.runId}.meta.json`);
  if (!existsSync(metaPath)) fail(`no run registry entry: ${metaPath} (dispatch the issue first)`);
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  if (o.model === meta.model) {
    fail(`reviewer model ${o.model} equals build model ${meta.model} (eval must be disjoint)`);
  }

  let pr;
  if (o.prFile) {
    pr = JSON.parse(readFileSync(resolve(o.prFile), 'utf8'));
  } else {
    if (!o.pr) fail('--pr N (worker PR) is required');
    pr = fetchPr(root, Number(o.pr));
  }
  const prNumber = pr.number ?? Number(o.pr);
  if (!pr.headSha) fail('PR head sha unavailable');

  const evalWorktree = join(resolve(o.worktreeRoot ?? join(root, '.worktrees')), '.eval', `${o.runId}-eval`);
  const expOut = join(runsDir, `${o.runId}.jsonl`);
  const promptPath = join(runsDir, `${o.runId}.eval.prompt.md`);

  let issueBody = '';
  if (!o.dryRun && !o.prFile) {
    try {
      issueBody = execFileSync('gh', ['issue', 'view', String(meta.issue), '--json', 'body', '--jq', '.body'], {
        encoding: 'utf8', cwd: root, timeout: 60000,
      });
    } catch { issueBody = '(issue body unavailable offline)'; }
  } else {
    issueBody = o.prFile ? '(offline fixture)' : '(dry-run: issue body not fetched)';
  }
  const stat = o.dryRun || o.prFile ? '(offline fixture)' : statFromFiles(pr.files);

  const prompt = buildPrompt({
    runId: o.runId,
    issue: meta.issue,
    model: o.model,
    buildModel: meta.model,
    prNumber,
    prTitle: pr.title ?? '',
    prUrl: pr.url ?? '',
    headSha: pr.headSha,
    headRefName: pr.headRefName ?? '',
    baseRefName: pr.baseRefName ?? 'main',
    workerBranch: meta.branch ?? '',
    evalWorktree,
    expOut,
    verdictPath: join(runsDir, `${o.runId}.verdict.md`),
    issueBody,
    stat,
  });

  if (o.dryRun) {
    process.stdout.write(`EVAL ${o.runId} pr=${prNumber} model=${o.model} worktree=${evalWorktree}\n`);
    process.stdout.write('DRY-RUN (no writes)\n');
    return;
  }

  mkdirSync(evalWorktree.split('/.eval/')[0], { recursive: true });
  if (!existsSync(evalWorktree)) {
    sh('git', ['-C', root, 'worktree', 'add', '--detach', evalWorktree, pr.headSha]);
  }
  const nm = join(root, 'node_modules');
  const link = join(evalWorktree, 'node_modules');
  if (existsSync(nm) && !existsSync(link)) {
    try { symlinkSync(nm, link, 'dir'); } catch { /* best effort */ }
  }
  writeFileSync(promptPath, prompt);
  process.stdout.write(`EVAL ${o.runId} pr=${prNumber} model=${o.model} worktree=${evalWorktree}\n`);
  process.stdout.write(`PROMPT ${promptPath}\n`);
  process.stdout.write(`OPERATOR next: spawn one reviewer agent (model ${o.model}) with the PROMPT content as its briefing\n`);
}

function cleanup(o) {
  if (!o.runId) fail('--run-id ID is required for --cleanup');
  const root = resolve(o.repo ?? sh('git', ['rev-parse', '--show-toplevel']).trim());
  const evalWorktree = join(resolve(o.worktreeRoot ?? join(root, '.worktrees')), '.eval', `${o.runId}-eval`);
  if (existsSync(evalWorktree)) {
    sh('git', ['-C', root, 'worktree', 'remove', '--force', evalWorktree]);
    process.stdout.write(`REMOVED ${o.runId}-eval\n`);
  } else {
    process.stdout.write(`NOTHING to remove for ${o.runId}\n`);
  }
  // Verdicts + review records are evaluation artifacts: kept.
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
