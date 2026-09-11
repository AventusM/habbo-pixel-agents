#!/usr/bin/env node
// scripts/exp/dispatch.mjs (M004/S02)
// Repeatable experiment dispatcher: one board issue x N opencode-go models.
// For each model the dispatcher creates an isolated git worktree on a pinned
// base commit with branch exp/<issue>-<slug>-<run>, writes a run registry
// entry plus a worker prompt carrying EXP_RUN_ID / EXP_ISSUE / EXP_MODEL,
// and prints the operator worker-launch step. Launching the workers stays an
// explicit operator step: scripts cannot spawn agents.
//
// Usage:
//   node scripts/exp/dispatch.mjs --issue 97 \
//     --models opencode-go/deepseek-v4-flash,opencode-go/kimi-k2.7-code \
//     [--base HEAD] [--run 20260912-153000] [--path direct] [--dry-run]
//   node scripts/exp/dispatch.mjs --cleanup --issue 97 --run 20260912-153000
//
// Flags --repo, --runs-dir and --worktree-root override locations (tests).
// Flag --issue-body-file "<title>\n<body>" skips the gh fetch (tests).
// Exit 0 on success; exit 2 on usage/validation errors.

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const PATHS = new Set(['gsd-loop', 'direct']);

function parseArgs(argv) {
  const o = { base: 'HEAD', path: 'direct', dryRun: false, cleanup: false };
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
  console.error(`dispatch: ${msg}`);
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
    'dispatch: one board issue x N models into isolated worktrees',
    '  dispatch --issue N --models m1,m2 [--base HEAD] [--run STAMP] [--path direct] [--dry-run]',
    '  dispatch --cleanup --issue N --run STAMP',
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

function fetchIssue(root, num) {
  const j = JSON.parse(
    sh('gh', ['issue', 'view', String(num), '--json', 'number,title,body'], { cwd: root }),
  );
  return { title: j.title || '', body: j.body || '' };
}

function buildPrompt(o) {
  const lines = [
    `# Experiment worker briefing (M004/S02 dispatch)`,
    ``,
    `You are one of N parallel experiment workers. Implement the issue below and ONLY the issue below.`,
    ``,
    `## Environment (already exported for your shell session)`,
    `  export EXP_RUN_ID=${o.runId}`,
    `  export EXP_ISSUE=${o.issue}`,
    `  export EXP_MODEL=${o.model}`,
    `  export EXP_PATH=${o.path}`,
    `  export EXP_OUT=${o.expOut}`,
    ``,
    `Your checkout: ${o.worktree} (branch ${o.branch}, base ${o.baseSha}). Never touch main, never touch other worktrees.`,
    ``,
    `## Work item: #${o.issue} ${o.issueTitle}`,
    ``,
    o.issueBody.trim(),
    ``,
    `## Section records (primary capture — do this, it is the experiment)`,
    `Run hook-record from your worktree root. Prefer explicit flags (env works too):`,
    `After reading the issue:`,
    `  node scripts/exp/hook-record.mjs --run-id ${o.runId} --issue ${o.issue} --model ${o.model} --out ${o.expOut} --section spec --result done --summary "<1 line: what the issue asks>"`,
    `After implementing and with the full exp suite green:`,
    `  node scripts/exp/hook-record.mjs --run-id ${o.runId} --issue ${o.issue} --model ${o.model} --out ${o.expOut} --section build --result done --tests "<e.g. 8 passed>" --branch ${o.branch} --summary "<1 line: what changed>"`,
    `Records append to ${o.expOut} (shared run file — append only, never rewrite).`,
    ``,
    `## Delivery (draft PR only)`,
    `Stage ONLY your deliverable files by exact path (never git add -A: lane-local`,
    `runtime files like .gsd/exec/ must not leak into the diff):`,
    `  git status --short  # inspect first; stage only benchmark deliverables`,
    `  git add tests/exp-hook-record.test.ts  # example: adjust to the issue`,
    `  git commit -m "<type>(exp): <what> (#${o.issue} [${o.modelShort}])"`,
    `  git push -u origin ${o.branch}`,
    `  gh pr create --draft --head ${o.branch} --base main \\`,
    `    --title "exp(${o.issue}): ${o.issueTitle} [${o.modelShort}]" \\`,
    `    --body "Experiment draft for #${o.issue} (model ${o.model}, run ${o.runId}). Do not merge without owner approval."`,
    ``,
    `## Standing rules (hard)`,
    `- Draft PR only. NEVER merge, never approve, never auto-merge.`,
    `- Main untouched. Worktree-only changes. Figure assets stay local-only/gitignored.`,
    `- No network except pushing your exp branch and gh reads / draft-PR creation. Hermetic tests only.`,
  ];
  return lines.join('\n') + '\n';
}

function dispatch(o) {
  const issue = Number(o.issue);
  if (!Number.isInteger(issue) || issue < 1) fail('--issue N (positive integer) is required');
  const models = String(o.models || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (models.length === 0) fail('--models m1,m2 (comma-separated opencode-go ids) is required');
  for (const m of models) {
    if (!m.includes('/')) fail(`--models entry must look like opencode-go/<name>, got ${JSON.stringify(m)}`);
  }
  if (!PATHS.has(o.path)) fail(`--path must be one of ${[...PATHS].join('|')}`);

  const root = resolve(o.repo ?? sh('git', ['rev-parse', '--show-toplevel']).trim());
  const baseSha = sh('git', ['-C', root, 'rev-parse', '--verify', `${o.base}^{commit}`]).trim();
  const run = o.run ?? stampNow();
  const runsDir = resolve(o.runsDir ?? join(root, 'scripts/exp/runs'));
  const wtRoot = resolve(o.worktreeRoot ?? join(root, '.worktrees'));

  let issueTitle = '';
  let issueBody = '';
  if (o.issueBodyFile) {
    const raw = readFileSync(resolve(o.issueBodyFile), 'utf8').split('\n');
    issueTitle = (raw.shift() ?? '').trim();
    issueBody = raw.join('\n');
  } else if (!o.dryRun) {
    ({ title: issueTitle, body: issueBody } = fetchIssue(root, issue));
  } else {
    issueTitle = `(dry-run placeholder for #${issue})`;
    issueBody = 'dry-run: issue body not fetched.';
  }

  const plans = models.map((model) => {
    const s = slug(model);
    const runId = `exp-${run}-${issue}-${s}`;
    const branch = `exp/${issue}-${s}-${run}`;
    const dir = `exp-${run}-${issue}-${s}`;
    return { model, modelShort: s, runId, branch, dir, worktree: join(wtRoot, dir) };
  });

  if (o.dryRun) {
    for (const p of plans) {
      process.stdout.write(`RUN ${p.runId} ${p.branch} ${p.worktree}\n`);
    }
    process.stdout.write(`BASE ${baseSha} DRY-RUN (no writes)\n`);
    return;
  }

  mkdirSync(runsDir, { recursive: true });
  mkdirSync(wtRoot, { recursive: true });
  for (const p of plans) {
    if (!existsSync(p.worktree)) {
      sh('git', ['-C', root, 'worktree', 'add', '-b', p.branch, p.worktree, baseSha]);
    }
    const expOut = join(runsDir, `${p.runId}.jsonl`);
    const meta = {
      run_id: p.runId,
      issue,
      model: p.model,
      path: o.path,
      branch: p.branch,
      worktree: p.worktree,
      base_sha: baseSha,
      created_at: new Date().toISOString(),
      pr: null,
    };
    writeFileSync(join(runsDir, `${p.runId}.meta.json`), JSON.stringify(meta, null, 2) + '\n');
    const prompt = buildPrompt({
      runId: p.runId,
      issue,
      model: p.model,
      modelShort: p.modelShort,
      path: o.path,
      branch: p.branch,
      worktree: p.worktree,
      baseSha,
      expOut,
      issueTitle,
      issueBody: issueBody.slice(0, 4000),
    });
    const promptPath = join(runsDir, `${p.runId}.prompt.md`);
    writeFileSync(promptPath, prompt);
    process.stdout.write(`RUN ${p.runId} ${p.branch} ${p.worktree}\n`);
    process.stdout.write(`PROMPT ${promptPath}\n`);
  }
  process.stdout.write(
    `OPERATOR next: spawn one agent per RUN line (isolated worktree above) with the PROMPT file content as its briefing, then collect ${runsDir}/*.jsonl\n`,
  );
}

function cleanup(o) {
  const issue = Number(o.issue);
  if (!Number.isInteger(issue) || issue < 1) fail('--issue N is required for --cleanup');
  if (!o.run) fail('--run STAMP is required for --cleanup');
  const root = resolve(o.repo ?? sh('git', ['rev-parse', '--show-toplevel']).trim());
  const wtRoot = resolve(o.worktreeRoot ?? join(root, '.worktrees'));
  const prefix = `exp-${o.run}-${issue}-`;
  let removed = 0;
  if (existsSync(wtRoot)) {
    for (const name of readdirSync(wtRoot)) {
      if (!name.startsWith(prefix)) continue;
      const p = join(wtRoot, name);
      sh('git', ['-C', root, 'worktree', 'remove', '--force', p]);
      // dirname exp-<run>-<issue>-<slug> maps to branch exp/<issue>-<slug>-<run>
      const m = /^exp-(\d{8}-\d{6})-(\d+)-(.+)$/.exec(name);
      if (m) {
        const branch = `exp/${m[2]}-${m[3]}-${m[1]}`;
        const branches = sh('git', ['-C', root, 'branch', '--list', branch]).trim();
        if (branches) sh('git', ['-C', root, 'branch', '-D', branch]);
      }
      process.stdout.write(`REMOVED ${name}\n`);
      removed++;
    }
  }
  // Run records under scripts/exp/runs/ are evaluation artifacts: kept.
  process.stdout.write(`CLEANUP done, removed ${removed} worktree(s); run records kept\n`);
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
  dispatch(o);
}

main();
