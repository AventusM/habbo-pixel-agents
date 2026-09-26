#!/usr/bin/env node
// scripts/exp/dispatch.mjs (M004/S02)
// Fan one board issue out to N opencode-go models in isolated worktrees.
// Each run gets a namespaced branch (exp/<issue>-<model>-<stamp>) and a
// per-model worktree; workers open DRAFT PRs only and never merge or close
// the issue (no Closes/Fixes/Resolves keywords), so parallel runs and the
// gsd-loop cannot collide.
//
// Usage:
//   node scripts/exp/dispatch.mjs --issue 80 \
//     --models opencode-go/deepseek-flash,opencode-go/glm-5.3 \
//     [--base origin/main] [--run-id exp-...] [--dry-run] [--setup-only]
// --dry-run prints the plan as JSON and writes nothing.
// Default prints a launch JSON (one entry per model) for the orchestrator
// to spawn builders (e.g. via Paseo agents); --setup-only skips that output.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseArgs(argv) {
  const o = { base: null, runId: null, dryRun: false, setupOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = (name) => {
      const v = argv[++i];
      if (v == null || v.startsWith('--')) {
        console.error(`dispatch: --${name} needs a value`);
        process.exit(2);
      }
      return v;
    };
    if (a === '--issue') o.issue = Number(val('issue'));
    else if (a === '--models') o.models = val('models').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--base') o.base = val('base');
    else if (a === '--run-id') o.runId = val('run-id');
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--setup-only') o.setupOnly = true;
    else {
      console.error(`dispatch: unknown arg ${JSON.stringify(a)}`);
      process.exit(2);
    }
  }
  if (!Number.isInteger(o.issue) || o.issue < 1) {
    console.error('dispatch: --issue N (positive integer) is required');
    process.exit(2);
  }
  if (!o.models || o.models.length === 0) {
    console.error('dispatch: --models m1,m2 (at least one model) is required');
    process.exit(2);
  }
  return o;
}

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
}

function slugify(model) {
  const base = String(model).split('/').pop();
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return slug || 'model';
}

function utcStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(
    d.getUTCMinutes(),
  )}${p(d.getUTCSeconds())}`;
}

function ghIssue(n) {
  try {
    return JSON.parse(sh('gh', ['issue', 'view', String(n), '--json', 'number,title,state,labels']));
  } catch {
    console.error(`dispatch: cannot read issue #${n} (does it exist?)`);
    process.exit(2);
  }
}

function baseSha(ref) {
  try {
    return sh('git', ['rev-parse', ref]);
  } catch {
    return sh('git', ['rev-parse', 'HEAD']);
  }
}

function localBranchExists(b) {
  try {
    sh('git', ['show-ref', '--verify', `refs/heads/${b}`]);
    return true;
  } catch {
    return false;
  }
}

function originBranchExists(b) {
  try {
    return sh('git', ['ls-remote', '--heads', 'origin', b]).length > 0;
  } catch {
    return false;
  }
}

function promptFor(entry, issueTitle) {
  return `# Experiment run ${entry.run_id}

Work item: #${entry.issue} — ${issueTitle}
Model: ${entry.model} (opencode-go exclusively)
Branch: ${entry.branch} (already checked out in this worktree)
Base: ${entry.base}

Instructions:
1. Read the contract from the issue (\`gh issue view ${entry.issue}\`); implement exactly its outcomes.
2. Run the checks that cover your change (\`npm run typecheck\`, relevant vitest files, then the full suite if green).
3. Open a DRAFT PR against \`main\` from this branch. The PR body MUST contain \`Exp-Run: ${entry.run_id}\` and MUST NOT contain Closes/Fixes/Resolves keywords.
4. Never merge. Never push to any other branch. Never touch \`main\`.

Record progress with scripts/exp/hook-record.mjs using --run-id ${entry.run_id}:
  spec/worker/review turn ends map to --section spec|build|review.
`;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  const issue = ghIssue(o.issue);
  const labels = (issue.labels || []).map((l) => l.name);
  if (labels.includes('gsd:ready')) {
    console.error(
      `dispatch: WARNING issue #${o.issue} is gsd:ready — the gsd-loop build lane may also build it. ` +
        'Experiment branches are namespaced, but expect an extra loop PR.',
    );
  }
  if (issue.state !== 'OPEN' && !o.dryRun) {
    console.error(`dispatch: issue #${o.issue} is ${issue.state}; refusing setup on a non-open issue`);
    process.exit(2);
  }

  const stamp = utcStamp();
  const runId = o.runId ?? `exp-${stamp.replace('-', '')}-${o.issue}`;
  const base = o.base ?? baseSha('origin/main');
  const root = resolve(process.cwd(), '.gsd/exp-worktrees', runId);

  const plan = o.models.map((model) => {
    const slug = slugify(model);
    return {
      model,
      slug,
      branch: `exp/${o.issue}-${slug}-${stamp}`,
      worktree: resolve(root, slug),
    };
  });

  if (o.dryRun) {
    process.stdout.write(JSON.stringify({ run_id: runId, issue: o.issue, base, plan }, null, 2) + '\n');
    return;
  }

  for (const p of plan) {
    if (localBranchExists(p.branch) || originBranchExists(p.branch)) {
      console.error(`dispatch: branch ${p.branch} already exists; aborting (pass a fresh --run-id)`);
      process.exit(2);
    }
  }

  const runs = [];
  for (const p of plan) {
    mkdirSync(p.worktree, { recursive: true });
    execFileSync('git', ['worktree', 'add', '-b', p.branch, p.worktree, base], { stdio: 'inherit' });
    const entry = { run_id: runId, issue: o.issue, model: p.model, branch: p.branch, base, worktree: p.worktree };
    writeFileSync(
      resolve(p.worktree, 'EXP_RUN.md'),
      promptFor({ ...entry }, String(issue.title || '')),
    );
    runs.push({ ...entry, prompt_file: resolve(p.worktree, 'EXP_RUN.md') });
  }
  writeFileSync(
    resolve(root, 'run.json'),
    JSON.stringify({ run_id: runId, issue: o.issue, base, created_at: new Date().toISOString(), runs }, null, 2) + '\n',
  );

  if (!o.setupOnly) {
    process.stdout.write(JSON.stringify(runs, null, 2) + '\n');
  }
}

main();
