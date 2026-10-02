#!/usr/bin/env node
// scripts/abide-pr-judge.mjs
// CI ratchet judge for a PR's changed files. Runs `abide audit` at head and at
// base, then reports only rules that got WORSE in the PR — pre-existing
// findings in a touched file never block (the RoomCanvas extraction target
// carries pre-existing act bands). Writes one JSON verdict for the commenter.
//
// Usage:
//   node scripts/abide-pr-judge.mjs --base-sha <sha> --head-sha <sha> [--out <path>]
//     [--rubric <path>] [--max-files <n>] [--abide-bin <cmd>] [--json]
//
// Exit: 0 clear (warnings ok); 1 regressions; 2 usage; 3 judge/infra error.
// The JSON is written even on infra error so the PR comment can explain it.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const EXIT_CLEAR = 0;
const EXIT_REGRESSION = 1;
const EXIT_USAGE = 2;
const EXIT_INFRA = 3;

const DEFAULT_MAX_FILES = 60;
const CODE_RX = /\.(ts|tsx|mts|cts|mjs|cjs|js|jsx)$/i;

function usage() {
  console.error(
    'usage: node scripts/abide-pr-judge.mjs --base-sha <sha> --head-sha <sha> ' +
      '[--out <path>] [--rubric <path>] [--max-files <n>] [--abide-bin <cmd>] [--json]',
  );
}

function flagValue(argv, name) {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
}

function run(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  } catch (err) {
    const stderr = err && err.stderr ? String(err.stderr).trim() : '';
    const tail = stderr.split('\n').slice(-4).join(' | ');
    throw new Error(`${cmd} ${args.join(' ')} failed: ${tail || err.message}`);
  }
}

function git(args, cwd) {
  return run('git', args, { cwd }).trim();
}

function isJudgeable(file) {
  const f = String(file).replace(/^\.\//, '');
  if (!CODE_RX.test(f)) return false;
  if (/^(dist|node_modules|assets|coverage)\//.test(f)) return false;
  if (/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(f)) return false;
  return true;
}

function existsAt(ref, file, cwd) {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}:${file}`], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function audit(bin, cwd, files) {
  // `abide audit` exits non-zero when it finds broken bands but still prints
  // the full JSON report on stdout — parse stdout rather than treating the
  // exit code as failure.
  let result;
  try {
    const out = execFileSync(bin, ['audit', ...files, '--json'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10 * 60 * 1000,
      maxBuffer: 64 * 1024 * 1024,
    });
    result = JSON.parse(out);
  } catch (err) {
    const out = err && err.stdout ? String(err.stdout) : '';
    if (out.trim()) result = JSON.parse(out);
    else {
      const stderr = err && err.stderr ? String(err.stderr).trim().split('\n').slice(-4).join(' | ') : '';
      throw new Error(`${bin} audit failed: ${stderr || err.message}`);
    }
  }
  // A chunk the judge could not score (bad key, unavailable model, gateway
  // error) yields no bands and would otherwise read as "no findings" — a
  // silent pass. Fail closed instead.
  const failed = (result.byFile || []).filter((f) => (f.chunksFailed || 0) > 0 || f.error);
  if (failed.length > 0) {
    const detail = failed[0].error || `${failed[0].chunksFailed} chunk(s) not judged`;
    throw new Error(`abide audit could not judge ${failed.length} file(s): ${detail}`);
  }
  return result;
}

/** Map `${rule}\u0000${file}` -> severity (2 broken, 1 flagged, absent = 0). */
function severityMap(result) {
  const map = new Map();
  const key = (rule, file) => `${rule}\u0000${String(file).replace(/^\.\//, '')}`;
  for (const rule of result?.byRule || []) {
    for (const file of rule.broken || []) map.set(key(rule.ruleId, file), 2);
    for (const file of rule.flagged || []) {
      const k = key(rule.ruleId, file);
      if ((map.get(k) ?? 0) < 1) map.set(k, 1);
    }
  }
  return map;
}

function ratchet(headMap, baseMap) {
  const regressions = [];
  const warnings = [];
  for (const [k, sev] of headMap) {
    const baseSev = baseMap.get(k) ?? 0;
    if (sev <= baseSev) continue;
    const [rule, file] = k.split('\u0000');
    const entry = { rule, file, band: sev >= 2 ? 'act' : 'flag', baseBand: baseSev === 0 ? 'clear' : 'flag' };
    if (sev >= 2) regressions.push(entry);
    else warnings.push(entry);
  }
  return { regressions, warnings };
}

function writeReport(outPath, report) {
  if (outPath) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(path.resolve(outPath), JSON.stringify(report, null, 2));
  }
}

function main() {
  const argv = process.argv.slice(2);
  const baseSha = flagValue(argv, '--base-sha');
  const headSha = flagValue(argv, '--head-sha');
  const out = flagValue(argv, '--out') || '.abide/judge.json';
  const rubric = flagValue(argv, '--rubric') || '.abide/rubric.json';
  const abideBin = flagValue(argv, '--abide-bin') || process.env.ABIDE_BIN || 'abide';
  const maxFiles = Number(flagValue(argv, '--max-files') || DEFAULT_MAX_FILES);
  const asJson = argv.includes('--json');
  const root = process.cwd();

  if (!baseSha || !headSha) {
    usage();
    process.exit(EXIT_USAGE);
  }

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseSha,
    headSha,
    verdict: 'error',
    changedFiles: [],
    judged: [],
    skipped: [],
    regressions: [],
    warnings: [],
    spendUsd: 0,
    error: null,
  };

  try {
    if (!fs.existsSync(path.resolve(root, rubric))) {
      throw new Error(`rubric not found at ${rubric}`);
    }
    const changed = git(['diff', '--name-only', '--diff-filter=ACMR', baseSha, headSha], root)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    report.changedFiles = changed;

    const judgeable = changed.filter(isJudgeable);
    const capped = judgeable.slice(0, maxFiles);
    report.skipped = judgeable.slice(maxFiles);
    report.judged = capped;

    if (capped.length === 0) {
      report.verdict = 'clear';
      writeReport(out, report);
      if (asJson) console.log(JSON.stringify(report, null, 2));
      process.exit(EXIT_CLEAR);
    }

    const headResult = audit(abideBin, root, capped);
    report.spendUsd += headResult.spendUsd || 0;
    const headMap = severityMap(headResult);

    // Base tree: a detached worktree at baseSha, judged with the base rubric.
    const baseFiles = capped.filter((f) => existsAt(baseSha, f, root));
    let baseMap = new Map();
    let worktree = null;
    if (baseFiles.length > 0) {
      worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'abide-base-'));
      git(['worktree', 'add', '--detach', '--force', worktree, baseSha], root);
      try {
        // Judge base with the SAME rubric as head so rule additions/removals
        // don't skew the ratchet (the base tree may predate the rubric).
        const rubricDst = path.join(worktree, '.abide', 'rubric.json');
        fs.mkdirSync(path.dirname(rubricDst), { recursive: true });
        fs.copyFileSync(path.resolve(root, rubric), rubricDst);
        const baseResult = audit(abideBin, worktree, baseFiles);
        report.spendUsd += baseResult.spendUsd || 0;
        baseMap = severityMap(baseResult);
      } finally {
        try {
          git(['worktree', 'remove', '--force', worktree], root);
        } catch {
          fs.rmSync(worktree, { recursive: true, force: true });
        }
      }
    }

    const { regressions, warnings } = ratchet(headMap, baseMap);
    report.regressions = regressions;
    report.warnings = warnings;
    report.verdict = regressions.length > 0 ? 'fail' : 'clear';
  } catch (err) {
    report.verdict = 'error';
    report.error = err instanceof Error ? err.message : String(err);
  }

  writeReport(out, report);
  if (asJson) console.log(JSON.stringify(report, null, 2));

  if (report.verdict === 'error') process.exit(EXIT_INFRA);
  process.exit(report.verdict === 'fail' ? EXIT_REGRESSION : EXIT_CLEAR);
}

main();
