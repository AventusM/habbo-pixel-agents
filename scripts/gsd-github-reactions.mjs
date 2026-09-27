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

/** Comment body for a reaction; always carries the gsd-sync marker.
 * Canonical wording per docs/guides/ISSUE-PR-CONTRACT.md section 6:
 * delivered comments are headed `gsd-sync: <MID>/<SID> delivered`, name the
 * merge commit + per-outcome evidence, then close; seal-skipped comments use
 * the same head with `sealed skipped` + delivery reasons and do not close.
 * Every comment carries the marker plus a stable dedupe key. */
export function buildReactionComment(reaction, opts = {}) {
  const target = `${reaction.milestoneId}/${reaction.sliceId}`;
  const key = reaction.key || opts.key || 'manual';
  const marker = `${BOT_MARKER} <!-- gsd-key: ${key} -->`;
  if (reaction.close) {
    const mergeRef = opts.mergeSha ? `delivered in ${opts.mergeSha}` : 'delivered';
    const evidence = opts.evidence ? ` — evidence: ${opts.evidence}` : '';
    return `gsd-sync: ${target} delivered — ${mergeRef}${evidence}; closing to match GSD state. ${marker}`;
  }
  const reasons = opts.reasons ? ` Reasons: ${opts.reasons}` : '';
  return `gsd-sync: ${target} sealed skipped — GSD state cancelled this slice; leaving the issue open for triage.${reasons} ${marker}`;
}

/** True when the issue is already in a terminal (closed) state — skip it. */
export function isIssueTerminal(issue) {
  const state = typeof issue?.state === 'string' ? issue.state.toLowerCase() : '';
  return state === 'closed';
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
