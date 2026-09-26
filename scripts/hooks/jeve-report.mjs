#!/usr/bin/env node
// scripts/hooks/jeve-report.mjs
// Q15 CLI: build one JEV/abide handoff report for a git change set and write
// <out>/<name>-<headSha8>.{json,md}. Reads .abide/events.jsonl + rubric.json,
// optionally runs a live `abide check` on uncommitted changed files, optionally
// comments a PR (`gh`) and appends a hooks-feed row. The pure math lives in
// ../jeve-report.mjs.
//
// Usage: node scripts/hooks/jeve-report.mjs [--base <ref>] [--head <ref>]
//   [--files a,b,c] [--out <dir>] [--name <slug>] [--live] [--pr <n>]
//   [--require-clear] [--feed] [--latest] [--quiet] [--stdout md|json|none]
//   [--events <path>] [--rubric <path>] [--head-sha <sha>] [--base-sha <sha>]
//
// Exit: 0 ok; 1 with --require-clear unless verdict is clear/empty; 2 usage/IO.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildReport, renderMarkdown } from '../jeve-report.mjs';

const USAGE = [
  'usage: node scripts/hooks/jeve-report.mjs [--base <ref>] [--head <ref>]',
  '  [--files a,b,c] [--out <dir>] [--name <slug>] [--live] [--pr <n>]',
  '  [--require-clear] [--feed] [--latest] [--quiet] [--stdout md|json|none]',
  '  [--events <path>] [--rubric <path>] [--head-sha <sha>] [--base-sha <sha>]',
].join('\n');

const FLAG_KEYS = {
  '--base': 'base',
  '--head': 'head',
  '--files': 'files',
  '--out': 'out',
  '--name': 'name',
  '--pr': 'pr',
  '--stdout': 'stdout',
  '--events': 'events',
  '--rubric': 'rubric',
  '--head-sha': 'headSha',
  '--base-sha': 'baseSha',
  '--live': 'live',
  '--require-clear': 'requireClear',
  '--feed': 'feed',
  '--latest': 'latest',
  '--quiet': 'quiet',
};
const VALUE_KEYS = new Set([
  'base', 'head', 'files', 'out', 'name', 'pr', 'stdout', 'events', 'rubric',
  'headSha', 'baseSha',
]);

class UsageError extends Error {}

function defaultOptions() {
  return {
    base: 'origin/main',
    head: 'HEAD',
    stdout: 'md',
    out: '.abide/reports',
    name: null,
    pr: null,
    files: null,
    events: null,
    rubric: null,
    headSha: null,
    baseSha: null,
    live: false,
    requireClear: false,
    feed: false,
    latest: false,
    quiet: false,
  };
}

function parseArgs(argv) {
  const options = defaultOptions();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const key = FLAG_KEYS[arg];
    if (!key) throw new UsageError(`unknown flag ${arg}`);
    if (VALUE_KEYS.has(key)) {
      const value = argv[i + 1];
      if (value === undefined || value === '' || value.startsWith('--')) {
        throw new UsageError(`missing value for ${arg}`);
      }
      options[key] = value;
      i += 1;
    } else {
      options[key] = true;
    }
  }
  if (!['md', 'json', 'none'].includes(options.stdout)) {
    throw new UsageError(`--stdout must be md|json|none (got ${options.stdout})`);
  }
  return options;
}

function firstLine(err) {
  const message = err && err.message ? String(err.message) : String(err);
  return message.split('\n')[0].slice(0, 300);
}

// Keep child stderr out of the parent's stderr (sync exec forwards it by
// default) while still capturing it for diagnostics in err.message.
const STDIO = ['ignore', 'pipe', 'pipe'];

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: STDIO }).trim();
}

function gitOk(root, args) {
  try {
    return git(root, args);
  } catch {
    return null;
  }
}

function rel(root, filePath) {
  return path.relative(root, filePath) || filePath;
}

function resolvePath(root, value) {
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

function detectRepoName(root) {
  const url = gitOk(root, ['remote', 'get-url', 'origin']);
  if (url) {
    const match = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
    if (match) return match[1];
  }
  return path.basename(root);
}

function slug(value) {
  return String(value || 'detached').toLowerCase().replace(/\//g, '-');
}

/** Normalize a --head-sha/--base-sha override: resolve refs, keep raw test shas. */
function resolveSha(root, value) {
  if (!value) return null;
  return gitOk(root, ['rev-parse', '--verify', `${value}^{commit}`]) || value;
}

/** Best-effort live check: `abide check --json` over uncommitted changed files. */
function runLive(root, changedFiles) {
  let porcelain = '';
  try {
    porcelain = execFileSync('git', ['status', '--porcelain'], {
      cwd: root,
      encoding: 'utf8',
      stdio: STDIO,
    });
  } catch (err) {
    return { ran: false, reason: `live check unavailable: ${firstLine(err)}`, spendUsd: 0 };
  }
  const dirty = new Set();
  for (const line of porcelain.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let file = trimmed.slice(3);
    const arrow = file.indexOf(' -> ');
    if (arrow !== -1) file = file.slice(arrow + 4);
    dirty.add(file.replace(/^"(.*)"$/, '$1'));
  }
  const overlap = changedFiles.filter((file) => dirty.has(file));
  if (overlap.length === 0) {
    return { ran: false, reason: 'no uncommitted changes for the changed files', spendUsd: 0 };
  }
  try {
    const out = execFileSync('abide', ['check', ...overlap, '--json'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 120_000,
      stdio: STDIO,
    });
    const parsed = JSON.parse(out);
    return {
      ran: true,
      reason: null,
      spendUsd: typeof parsed.spendUsd === 'number' ? parsed.spendUsd : 0,
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    };
  } catch (err) {
    return { ran: false, reason: `live check unavailable: ${firstLine(err)}`, spendUsd: 0 };
  }
}

function appendFeed(root, report, headSha, jsonPath, mdPath) {
  const feedPath = path.join(root, '.gsd', 'hooks-feed.jsonl');
  const row = {
    source: 'jeve-handoff',
    ts: report.generatedAt,
    role: 'reviewer',
    action: 'abide-report',
    sessionId: process.env.JEVE_SESSION || null,
    headSha,
    verdict: report.verdict,
    json: rel(root, jsonPath),
    md: rel(root, mdPath),
    changedFiles: report.changedFiles.length,
  };
  try {
    fs.mkdirSync(path.dirname(feedPath), { recursive: true });
    fs.appendFileSync(feedPath, JSON.stringify(row) + '\n');
  } catch (err) {
    console.error(`jeve-report: feed append failed: ${firstLine(err)}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  let root;
  try {
    root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: STDIO,
    }).trim();
  } catch (err) {
    throw new Error(`not inside a git worktree (${firstLine(err)})`);
  }

  const notes = [];
  const headRef = options.head;
  const headSha = resolveSha(root, options.headSha) || git(root, ['rev-parse', headRef]);
  const subject =
    gitOk(root, ['log', '-1', '--format=%s', headSha]) ||
    gitOk(root, ['log', '-1', '--format=%s', headRef]) ||
    '';

  let baseSha = resolveSha(root, options.baseSha) || gitOk(root, ['merge-base', options.base, headRef]);
  if (!baseSha && options.headSha) baseSha = gitOk(root, ['merge-base', options.base, options.headSha]);
  if (!baseSha) baseSha = gitOk(root, ['rev-parse', options.base]);
  if (!baseSha) throw new Error(`cannot resolve base ${options.base}`);

  let baseTime = null;
  baseTime = gitOk(root, ['show', '-s', '--format=%cI', baseSha]);
  if (!baseTime) notes.push(`base time unavailable for ${String(baseSha).slice(0, 8)}`);

  let changed;
  if (options.files !== null) {
    changed = options.files.split(',').map((file) => file.trim()).filter(Boolean);
  } else {
    const out = git(root, ['diff', '--name-only', `${baseSha}...${headSha}`]);
    changed = out ? out.split('\n').map((file) => file.trim()).filter(Boolean) : [];
  }
  const deletedFiles = changed.filter((file) => !fs.existsSync(resolvePath(root, file)));
  const changedFiles = changed.filter((file) => fs.existsSync(resolvePath(root, file)));

  const rubricPath = resolvePath(root, options.rubric || path.join(root, '.abide', 'rubric.json'));
  let rubric;
  try {
    rubric = JSON.parse(fs.readFileSync(rubricPath, 'utf8'));
  } catch (err) {
    throw new Error(`cannot read rubric at ${rel(root, rubricPath)} (${firstLine(err)})`);
  }

  const eventsPath = resolvePath(root, options.events || path.join(root, '.abide', 'events.jsonl'));
  let eventsText = '';
  try {
    eventsText = fs.readFileSync(eventsPath, 'utf8');
  } catch {
    notes.push(`no events file: ${rel(root, eventsPath)}`);
  }

  const liveResult = options.live ? runLive(root, changedFiles) : null;
  const branch = gitOk(root, ['rev-parse', '--abbrev-ref', 'HEAD']) || 'detached';
  const report = buildReport({
    repoRoot: root,
    repoName: detectRepoName(root),
    branch,
    base: { ref: options.base, sha: baseSha },
    head: { sha: headSha, subject },
    changedFiles,
    deletedFiles,
    rubric,
    eventsText,
    liveResult,
    baseTime,
    generatedAt: new Date().toISOString(),
    extraNotes: notes,
  });

  const outDir = resolvePath(root, options.out);
  fs.mkdirSync(outDir, { recursive: true });
  const name = slug(options.name || branch);
  const baseFile = `${name}-${String(headSha).slice(0, 8)}`;
  const jsonPath = path.join(outDir, `${baseFile}.json`);
  const mdPath = path.join(outDir, `${baseFile}.md`);
  const markdown = renderMarkdown(report);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(mdPath, markdown);
  if (options.latest) {
    fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(path.join(outDir, 'latest.md'), markdown);
  }

  if (options.pr) {
    try {
      execFileSync('gh', ['pr', 'comment', String(options.pr), '--body-file', mdPath], {
        cwd: root,
        encoding: 'utf8',
        stdio: STDIO,
      });
    } catch (err) {
      console.error(`jeve-report: pr comment failed: ${firstLine(err)}`);
    }
  }

  if (options.feed) appendFeed(root, report, headSha, jsonPath, mdPath);

  if (options.stdout === 'json') {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else if (options.stdout === 'md' && !options.quiet) {
    process.stdout.write(`${report.verdict} ${rel(root, jsonPath)} ${rel(root, mdPath)}\n`);
  }

  if (options.requireClear && report.verdict !== 'clear' && report.verdict !== 'empty') return 1;
  return 0;
}

let exitCode = 0;
try {
  exitCode = main();
} catch (err) {
  if (err instanceof UsageError) {
    console.error(`jeve-report: ${err.message}`);
    console.error(USAGE);
  } else {
    console.error(`jeve-report: ${firstLine(err)}`);
  }
  exitCode = 2;
}
process.exitCode = exitCode;
