#!/usr/bin/env node
// scripts/hooks/gsd-event-hook.mjs
// PROTOTYPE (M003/S07): reacts to GSD workflow events from .gsd/event-log.jsonl.
//
// Demonstrates the deterministic-reaction data path for GSD roles (planner /
// executor / reviewer): every GSD mutation (plan-slice, plan-milestone,
// task-complete, ...) is appended to the event log; this watcher tails it and
// emits a structured "hook feed" event that downstream consumers (the room's
// web-server, a status chip, a board updater) could act on.
//
// Usage: node scripts/hooks/gsd-event-hook.mjs [--once]
//   --once : process the current tail position and exit (for tests)
//
// Feed output: .gsd/hooks-feed.jsonl  (gitignored via .gsd rules)

import fs from 'fs';
import path from 'path';

const EVENT_LOG = '.gsd/event-log.jsonl';
const FEED = '.gsd/hooks-feed.jsonl';

// Which GSD commands trigger which deterministic reactions (role mapping)
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

function processLine(line) {
  if (!line.trim()) return;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return; // partial line or noise
  }
  const reaction = REACTIONS[entry.cmd];
  if (!reaction) return;
  const event = {
    source: 'gsd-event-hook',
    ts: new Date().toISOString(),
    gsdCmd: entry.cmd,
    params: entry.params ?? {},
    actor: entry.actor,
    role: reaction.role,
    action: reaction.action,
    text: reaction.text,
  };
  appendFeed(event);
  console.log(`[gsd-event-hook] ${entry.cmd} -> ${reaction.role}/${reaction.action}`);
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

const once = process.argv.includes('--once');
if (!fs.existsSync(EVENT_LOG)) {
  console.error(`no event log at ${EVENT_LOG}`);
  process.exit(1);
}

// Process existing tail content once (last 10 lines) so tests see recent events
const existing = fs.readFileSync(EVENT_LOG, 'utf8').trimEnd().split('\n').slice(-10);
for (const line of existing) processLine(line);

if (once) {
  console.log('[gsd-event-hook] --once done');
  process.exit(0);
}

console.log(`[gsd-event-hook] watching ${EVENT_LOG} (ctrl-c to stop)`);
const stop = tailFromEnd(EVENT_LOG, processLine);
process.on('SIGINT', () => {
  stop();
  process.exit(0);
});
