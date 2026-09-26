#!/usr/bin/env node
// scripts/hooks/gsd-event-hook.mjs
// PROTOTYPE (M003/S07), extended for M005/S06: reacts to GSD workflow events
// from .gsd/event-log.jsonl.
//
// Feed path: mapped GSD mutations append a structured "hook feed" event to
// .gsd/hooks-feed.jsonl (room / status consumers).
//
// GitHub path (M005/S06): slice terminal events (complete-slice, skip-slice)
// become GitHub reactions — comment (and close on completion) the M00X/S0X
// titled issue, guarded so the two sync halves never ping-pong:
//   - comments carry the <!-- gsd-sync --> marker AND issues get the gsd:synced
//     label, so S05's receiver ignores the echo even though the actor is the
//     authenticated repo user rather than a bot account
//   - dedupe by event hash in a state file: at most once, across restarts
//   - actor 'github-sync' events are never echoed (one hop max)
//
// Usage: node scripts/hooks/gsd-event-hook.mjs [--once] [--github] [--dry-run]
//                                             [--event-log <path>] [--state <path>]
//                                             [--milestone <id> --slice <id> --seal skipped|completed]
//   --once       process the current tail once and exit (tests / --github catch-up)
//   --github     enable LIVE GitHub reactions (gh comment/close); default off
//   --dry-run    compute reactions, log intent, never write (read-only gh lookups)
//   --event-log  override the event log path (fixtures)
//   --state      override the reaction dedupe state path
//   --seal       synthetic seal mode (no event log needed): react to a slice's
//                terminal state directly. gsd-pi's skip-slice handler emits no
//                event-log entry, so a lane that seals via skip-slice cannot use
//                the tail; this builds the same reaction object and runs the
//                same guarded write path, deduped by a stable key.
//
// Feed output: .gsd/hooks-feed.jsonl  (gitignored via .gsd rules)

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'node:child_process';
import {
  classifyGsdEvent,
  buildReactionComment,
  matchesIssueTitle,
} from '../gsd-github-reactions.mjs';
import { SYNC_LABEL } from '../gsd-github-sync.mjs';

const argv = process.argv.slice(2);
const once = argv.includes('--once');
const githubLive = argv.includes('--github');
const dryRun = argv.includes('--dry-run');
function flagValue(name, fallback) {
  const idx = argv.indexOf(name);
  return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : fallback;
}
const EVENT_LOG = flagValue('--event-log', '.gsd/event-log.jsonl');
const FEED = '.gsd/hooks-feed.jsonl';
const STATE_PATH = flagValue('--state', '.gsd/runtime/github-sync/gsd-events-state.json');

// Which GSD commands trigger which deterministic feed reactions (role mapping)
const REACTIONS = {
  'plan-milestone': { role: 'planner', action: 'room-notify', text: 'milestone planned' },
  'plan-slice': { role: 'planner', action: 'room-notify', text: 'slice planned' },
  'plan-task': { role: 'planner', action: 'room-notify', text: 'task planned' },
  'task-complete': { role: 'executor', action: 'board-update', text: 'task completed' },
  'slice-complete': { role: 'executor', action: 'board-update', text: 'slice completed' },
  'validate-milestone': { role: 'reviewer', action: 'gate-check', text: 'milestone validated' },
  'complete-milestone': { role: 'reviewer', action: 'gate-check', text: 'milestone completed' },
  'decision-save': { role: 'planner', action: 'room-notify', text: 'decision recorded' },
};

function appendFeed(event) {
  fs.appendFileSync(FEED, JSON.stringify(event) + '\n');
}

// --- GitHub reactions (M005/S06) ---

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

const reactionState = loadState();

function findIssue(reaction) {
  const query = `${reaction.milestoneId}/${reaction.sliceId} in:title`;
  const out = execFileSync(
    'gh',
    [
      'issue', 'list', '--state', 'all', '--search', query,
      '--json', 'number,title,state', '--limit', '10',
    ],
    { encoding: 'utf8' },
  );
  return JSON.parse(out).find((issue) => matchesIssueTitle(issue.title, reaction)) ?? null;
}

function reactToGsd(reaction) {
  if (reactionState[reaction.key]) {
    console.log(`[gsd-github-reactions] ${reaction.milestoneId}/${reaction.sliceId} already handled`);
    return;
  }
  const issue = findIssue(reaction);
  if (!issue) {
    console.log(`[gsd-github-reactions] ${reaction.milestoneId}/${reaction.sliceId} — no matching issue`);
    return;
  }
  if (!githubLive) {
    const closeNote = reaction.close ? ' and close it' : '';
    console.log(
      `[gsd-github-reactions] would label + comment on #${issue.number} "${issue.title}"${closeNote}`,
    );
    return;
  }
  reactionState[reaction.key] = new Date().toISOString();
  saveState(reactionState);
  try {
    execFileSync(
      'gh',
      [
        'label', 'create', SYNC_LABEL,
        '--description', 'Synced by the GSD two-way sync',
        '--color', '5319e7',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] },
    );
  } catch {
    // label already exists
  }
  execFileSync('gh', ['issue', 'edit', String(issue.number), '--add-label', SYNC_LABEL], {
    encoding: 'utf8',
  });
  execFileSync(
    'gh',
    ['issue', 'comment', String(issue.number), '--body', buildReactionComment(reaction)],
    { encoding: 'utf8' },
  );
  if (reaction.close) {
    execFileSync('gh', ['issue', 'close', String(issue.number)], { encoding: 'utf8' });
  }
  console.log(`[gsd-github-reactions] #${issue.number} ${reaction.close ? 'commented + closed' : 'commented'}`);
}

function maybeReact(entry) {
  if (!githubLive && !dryRun) return;
  const reaction = classifyGsdEvent(entry);
  if (!reaction) return;
  try {
    reactToGsd(reaction);
  } catch (err) {
    console.error(`[gsd-github-reactions] ${err.message}`);
  }
}

// --- synthetic seal mode (M008 continuation lane) ---
// Reflect a slice terminal state without depending on .gsd/event-log.jsonl.
// Example:
//   node scripts/hooks/gsd-event-hook.mjs --github --milestone M008 --slice S02 --seal skipped
const seal = flagValue('--seal', null);
if (seal) {
  const mid = flagValue('--milestone', null);
  const sid = flagValue('--slice', null);
  if (!mid || !sid) {
    console.error('[gsd-slice-reaction] --seal requires --milestone <id> and --slice <id>');
    process.exit(2);
  }
  const cmd = seal === 'completed' ? 'complete-slice' : seal === 'skipped' ? 'skip-slice' : null;
  if (!cmd) {
    console.error(`[gsd-slice-reaction] unknown --seal '${seal}' (expected skipped|completed)`);
    process.exit(2);
  }
  if (!githubLive && !dryRun) {
    console.log('[gsd-slice-reaction] no --github or --dry-run; nothing to do (safe by default)');
    process.exit(0);
  }
  maybeReact({
    cmd,
    params: { milestoneId: mid, sliceId: sid },
    ts: new Date().toISOString(),
    actor: 'agent',
    hash: `manual:${mid}/${sid}:${cmd}`,
  });
  process.exit(0);
}

// --- event processing ---

function processLine(line, { react = false } = {}) {
  if (!line.trim()) return;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return; // partial line or noise
  }
  const feedMapping = REACTIONS[entry.cmd];
  if (feedMapping) {
    const event = {
      source: 'gsd-event-hook',
      ts: new Date().toISOString(),
      gsdCmd: entry.cmd,
      params: entry.params ?? {},
      actor: entry.actor,
      role: feedMapping.role,
      action: feedMapping.action,
      text: feedMapping.text,
    };
    appendFeed(event);
    console.log(`[gsd-event-hook] ${entry.cmd} -> ${feedMapping.role}/${feedMapping.action}`);
  }
  if (react) maybeReact(entry);
}

function tailFromEnd(filePath, onData) {
  let position = fs.statSync(filePath).size;
  const watcher = fs.watch(path.dirname(filePath), () => {
    try {
      const size = fs.statSync(filePath).size;
      if (size < position) position = 0; // truncated/rotated
      if (size > position) {
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(size - position);
        fs.readSync(fd, buffer, 0, buffer.length, position);
        fs.closeSync(fd);
        position = size;
        for (const line of buffer.toString().split('\n')) onData(line);
      }
    } catch {
      // file being written concurrently; retry on next watch event
    }
  });
  return () => watcher.close();
}

if (!fs.existsSync(EVENT_LOG)) {
  console.error(`no event log at ${EVENT_LOG}`);
  process.exit(1);
}

// Process the existing tail once so tests see recent events. Historical
// entries react only in --dry-run or explicit --once --github catch-up runs.
const existing = fs.readFileSync(EVENT_LOG, 'utf8').trimEnd().split('\n').slice(-10);
const reactHistorical = dryRun || (once && githubLive);
for (const line of existing) processLine(line, { react: reactHistorical });

if (once) {
  console.log('[gsd-event-hook] --once done');
  process.exit(0);
}

console.log(`[gsd-event-hook] watching ${EVENT_LOG} (ctrl-c to stop)`);
const stop = tailFromEnd(EVENT_LOG, (line) => processLine(line, { react: true }));
process.on('SIGINT', () => {
  stop();
  process.exit(0);
});
