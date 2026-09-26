#!/usr/bin/env node
// scripts/hooks/gsd-sync-wake.mjs
// Session-start consumer for the GitHub→GSD inbox (Q14): print one compact
// wake note for unseen sync intents and mark them seen.
//
// Usage: node scripts/hooks/gsd-sync-wake.mjs [--no-mark]
//          [--inbox <path>] [--seen <path>]
//   --no-mark   print without consuming (nothing is written)
//
// stdout carries ONLY the wake note (empty when nothing is pending);
// diagnostics go to stderr, so harnesses can inject stdout verbatim.

import fs from 'node:fs';
import path from 'node:path';
import { parseInbox, collectPending, formatWake, markSeen } from '../gsd-sync-wake.mjs';

const argv = process.argv.slice(2);
function flagValue(name, fallback) {
  const idx = argv.indexOf(name);
  return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : fallback;
}
const noMark = argv.includes('--no-mark');
const INBOX = flagValue('--inbox', '.gsd/runtime/github-sync/inbox.jsonl');
const SEEN = flagValue('--seen', '.gsd/runtime/github-sync/seen.json');

function readJson(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

let inboxText = '';
try {
  inboxText = fs.readFileSync(INBOX, 'utf8');
} catch {
  inboxText = '';
}

const seen = readJson(SEEN);
const pending = collectPending(parseInbox(inboxText), seen);
const note = formatWake(pending);

if (!note) {
  console.error('[gsd-sync-wake] nothing pending');
  process.exit(0);
}

process.stdout.write(note + '\n');
if (!noMark) {
  fs.mkdirSync(path.dirname(SEEN), { recursive: true });
  fs.writeFileSync(SEEN, JSON.stringify(markSeen(seen, pending), null, 2) + '\n');
  console.error(`[gsd-sync-wake] marked ${pending.length} seen`);
}
