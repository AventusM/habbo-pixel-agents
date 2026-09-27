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

// --- Fresh owner approval (M010/S03, contract section 5) ---
// An owner approval is a comment whose body, trimmed and lowercased with
// trailing punctuation stripped, is exactly one approval word — or begins
// with /approve or gsd:approve. Comments beginning gsd-loop/GSD: are never
// approvals. Fresh means createdAt is later than the PR head commit date.

const APPROVAL_WORDS = new Set([
  'ok', 'okay', 'k', 'approve', 'approved', 'lgtm', 'ship it',
  'merge', 'merge it', 'go ahead', 'do it', 'yes',
]);
const APPROVAL_PREFIXES = ['/approve', 'gsd:approve'];

/** True when a raw comment body is an approval per the contract vocabulary. */
export function isApprovalBody(body) {
  const normalized = String(body ?? '').trim().toLowerCase().replace(/[.!…]+$/, '').trim();
  if (!normalized) return false;
  if (APPROVAL_PREFIXES.some((p) => normalized.startsWith(p))) return true;
  if (normalized.startsWith('gsd-loop') || normalized.startsWith('gsd:')) return false;
  return APPROVAL_WORDS.has(normalized);
}

function commentAuthor(comment) {
  const author = comment?.author;
  const login = typeof author === 'string' ? author : author?.login;
  return typeof login === 'string' ? login : '';
}

function isBotLogin(login) {
  return /\[bot\]$/i.test(login) || login.toLowerCase() === 'bot';
}

/**
 * Newest fresh approval from gh comment objects [{body, author, createdAt}].
 * Fresh = createdAt strictly later than headDateIso (the PR head commit date).
 * Bot authors never count; when ownerLogins is given the author must be one.
 * Returns {fresh, approval} with approval {body, author, createdAt} or null.
 */
export function findFreshApproval(comments, headDateIso, ownerLogins = null) {
  const headTime = Date.parse(headDateIso);
  if (!Array.isArray(comments) || Number.isNaN(headTime)) return { fresh: false, approval: null };
  const owners = Array.isArray(ownerLogins) ? new Set(ownerLogins.map((o) => String(o).toLowerCase())) : null;
  let best = null;
  for (const comment of comments) {
    const body = comment?.body ?? '';
    if (!isApprovalBody(body)) continue;
    const login = commentAuthor(comment);
    if (!login || isBotLogin(login)) continue;
    if (owners && !owners.has(login.toLowerCase())) continue;
    const at = Date.parse(comment?.createdAt);
    if (Number.isNaN(at) || at <= headTime) continue;
    if (!best || at > Date.parse(best.createdAt)) {
      best = { body: String(body).trim(), author: login, createdAt: comment.createdAt };
    }
  }
  return { fresh: best !== null, approval: best };
}

// Gates a fresh approval lifts (human-only) vs never lifts (lane-verified).
const LIFTABLE_GATES = ['humanMergeOnly', 'humanMergeTrailer', 'stacked', 'escalated'];
const UNLIFTABLE_GATES = ['blocked', 'rework', 'ciFailing', 'jevMissing'];

/**
 * Evaluate which gates a fresh approval lifts. `gates` maps gate names to
 * truthy-when-set; labels are accepted as an array of label names too
 * (gsd:escalated / gsd:blocked / gsd:rework are read from it).
 * A fresh approval lifts human-only gates but never blocked/rework/CI/JEV.
 */
export function approvalLifts({ approval = null, gates = {} } = {}) {
  const labels = new Set(
    (Array.isArray(gates.labels) ? gates.labels : []).map((l) => (typeof l === 'string' ? l : l?.name)),
  );
  const isSet = (name, ...labelNames) =>
    Boolean(gates[name]) || labelNames.some((l) => labels.has(l));
  const state = {
    humanMergeOnly: isSet('humanMergeOnly'),
    humanMergeTrailer: isSet('humanMergeTrailer'),
    stacked: isSet('stacked'),
    escalated: isSet('escalated', 'gsd:escalated'),
    blocked: isSet('blocked', 'gsd:blocked'),
    rework: isSet('rework', 'gsd:rework'),
    ciFailing: isSet('ciFailing'),
    jevMissing: isSet('jevMissing'),
  };
  if (!approval) {
    return { lifted: [], stillBlocking: Object.keys(state).filter((k) => state[k]) };
  }
  return {
    lifted: LIFTABLE_GATES.filter((k) => state[k]),
    stillBlocking: UNLIFTABLE_GATES.filter((k) => state[k]),
  };
}
