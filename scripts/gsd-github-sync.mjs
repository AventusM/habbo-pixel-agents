// scripts/gsd-github-sync.mjs
// Pure classifier for the GitHub→GSD sync branch (M005/S05): turns a verified
// GitHub webhook payload into a sync intent — or null when a loop guard says
// ignore. No fs, no network: scripts/web-server.mjs does the writes, vitest
// covers the logic (same shape as scripts/hooks-feed-mapper.mjs).

const TITLE_PREFIX = /^(M\d{3})(?:\/(S\d{2}))?\b/;
const TRANSITIONS = new Set(['closed', 'reopened']);
const BOT_MARKER = '<!-- gsd-sync -->';
export const SYNC_LABEL = 'gsd:synced';

/** Parse the M00X(/S0X) title-prefix convention into ids; null when absent. */
export function parseTitlePrefix(title) {
  if (typeof title !== 'string') return null;
  const match = TITLE_PREFIX.exec(title.trim());
  if (!match) return null;
  return match[2] ? { milestoneId: match[1], sliceId: match[2] } : { milestoneId: match[1] };
}

function isBotSender(sender) {
  if (!sender || typeof sender !== 'object') return false;
  if (sender.type === 'Bot') return true;
  return typeof sender.login === 'string' && /\[bot\]$/i.test(sender.login);
}

function hasSyncLabel(issue) {
  return (
    Array.isArray(issue?.labels) && issue.labels.some((label) => label?.name === SYNC_LABEL)
  );
}

function hasBotMarker(payload, marker) {
  const body = payload?.issue?.body;
  return typeof body === 'string' && body.includes(marker);
}

/** Stable exactly-once key: issue + action + the transition's own timestamp. */
export function dedupeKey(issueNumber, action, issue) {
  const stamp =
    (action === 'closed' ? issue?.closed_at : issue?.updated_at) ?? issue?.updated_at ?? '';
  return `${issueNumber}:issues.${action}:${stamp}`;
}

/**
 * Classify one GitHub webhook delivery into a sync intent, or null to ignore.
 * Guards: issues event only; closed/reopened transitions only; M00X(/S0X)
 * title required; bot senders, gsd-sync-marked bodies, and gsd:synced-labeled
 * issues ignored (one hop).
 */
export function classifyGithubSyncEvent(event, payload, opts = {}) {
  if (event !== 'issues') return null;
  const action = payload?.action;
  if (!TRANSITIONS.has(action)) return null;
  const issue = payload?.issue;
  if (!issue || !Number.isInteger(issue.number)) return null;
  const prefix = parseTitlePrefix(issue.title);
  if (!prefix) return null;
  const marker = typeof opts.botMarker === 'string' ? opts.botMarker : BOT_MARKER;
  if (isBotSender(payload?.sender) || hasBotMarker(payload, marker) || hasSyncLabel(issue)) {
    return null;
  }
  return {
    v: 1,
    kind: 'github-sync-intent',
    ts: new Date().toISOString(),
    action: `issues.${action}`,
    issue: issue.number,
    title: String(issue.title),
    milestoneId: prefix.milestoneId,
    sliceId: prefix.sliceId ?? null,
    actor: typeof payload?.sender?.login === 'string' ? payload.sender.login : null,
    hop: 1,
    key: dedupeKey(issue.number, action, issue),
  };
}

/** GSD notification row for an accepted intent (notification-store shape). */
export function toNotification(intent, id) {
  const target = intent.sliceId ? `${intent.milestoneId}/${intent.sliceId}` : intent.milestoneId;
  const verb = intent.action === 'issues.closed' ? 'closed' : 'reopened';
  return {
    id,
    ts: intent.ts,
    severity: 'info',
    message: `GitHub #${intent.issue} (${target}) ${verb} — sync intent queued`,
    source: 'github-sync',
    read: false,
  };
}
