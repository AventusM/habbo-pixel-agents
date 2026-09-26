// scripts/gsd-github-reactions.mjs
// Pure classifier for the GSD→GitHub half of the two-way sync (M005/S06):
// turns one .gsd/event-log.jsonl entry into a GitHub reaction — or null when
// a loop guard says ignore. No fs, no network: scripts/hooks/gsd-event-hook.mjs
// runs the gh calls; vitest covers the logic (same shape as gsd-github-sync.mjs).

import { parseTitlePrefix } from './gsd-github-sync.mjs';

const REACTIONS = {
  'complete-slice': { close: true, verb: 'completed' },
  'skip-slice': { close: false, verb: 'skipped' },
};

const BOT_MARKER = '<!-- gsd-sync -->';

/**
 * Classify one GSD event-log entry into a GitHub reaction, or null to ignore.
 * Guards: known slice commands only; milestoneId + sliceId present; a stable
 * event hash for dedupe; actor 'github-sync' never echoes (one hop max).
 */
export function classifyGsdEvent(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const spec = REACTIONS[entry.cmd];
  if (!spec) return null;
  const milestoneId = entry.params?.milestoneId;
  const sliceId = entry.params?.sliceId;
  if (typeof milestoneId !== 'string' || !milestoneId) return null;
  if (typeof sliceId !== 'string' || !sliceId) return null;
  if (typeof entry.hash !== 'string' || !entry.hash) return null;
  if (entry.actor === 'github-sync') return null;
  return {
    v: 1,
    kind: 'gsd-github-reaction',
    ts: new Date().toISOString(),
    cmd: entry.cmd,
    milestoneId,
    sliceId,
    close: spec.close,
    verb: spec.verb,
    hop: 1,
    key: entry.hash,
  };
}

/** Comment body for a reaction; always carries the gsd-sync marker. */
export function buildReactionComment(reaction) {
  const target = `${reaction.milestoneId}/${reaction.sliceId}`;
  const tail = reaction.close
    ? 'this issue is being closed to match GSD state'
    : 'GSD state cancelled this slice; leaving the issue open for triage';
  return `GSD: ${target} ${reaction.verb} — ${tail}. ${BOT_MARKER}`;
}

/** True when the issue title names exactly this milestone/slice. */
export function matchesIssueTitle(title, reaction) {
  const prefix = parseTitlePrefix(title);
  if (!prefix) return false;
  return (
    prefix.milestoneId === reaction.milestoneId &&
    (prefix.sliceId ?? null) === reaction.sliceId
  );
}
