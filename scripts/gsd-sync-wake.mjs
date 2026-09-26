// scripts/gsd-sync-wake.mjs
// Pure wake helper for the GitHub→GSD inbox (Q14, M005 consumer follow-up):
// filter unseen sync intents and build one compact note a session-start hook
// can inject. No fs — scripts/hooks/gsd-sync-wake.mjs and the opencode plugin
// do the reads/writes (same split as hooks-feed-mapper / gsd-github-sync).

const MAX_LINES = 5;

/** Parse inbox JSONL text into intents; blank/bad lines are skipped. */
export function parseInbox(text) {
  const out = [];
  for (const line of String(text ?? '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const entry = JSON.parse(trimmed);
      if (entry && typeof entry === 'object' && typeof entry.key === 'string') out.push(entry);
    } catch {
      // partial line or noise
    }
  }
  return out;
}

/** Intents whose dedupe key has not been seen yet, newest first. */
export function collectPending(intents, seen) {
  const seenKeys = seen && typeof seen === 'object' ? seen : {};
  return intents
    .filter((intent) => !seenKeys[intent.key])
    .sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
}

/** Compact multi-line wake note; null when nothing is pending. */
export function formatWake(pending) {
  if (!pending || pending.length === 0) return null;
  const plural = pending.length === 1 ? '' : 's';
  const lines = [`GSD↔GitHub sync — ${pending.length} pending transition${plural}:`];
  for (const intent of pending.slice(0, MAX_LINES)) {
    const target = intent.sliceId
      ? `${intent.milestoneId}/${intent.sliceId}`
      : (intent.milestoneId ?? 'unknown');
    lines.push(`- #${intent.issue} (${target}) ${intent.action} · ${intent.ts}`);
  }
  if (pending.length > MAX_LINES) lines.push(`…and ${pending.length - MAX_LINES} more`);
  lines.push('Inbox: .gsd/runtime/github-sync/inbox.jsonl (apply via gsd tooling or acknowledge).');
  return lines.join('\n');
}

/** New seen map with the pending keys marked; does not mutate the input. */
export function markSeen(seen, pending, at = new Date().toISOString()) {
  const next = { ...(seen && typeof seen === 'object' ? seen : {}) };
  for (const intent of pending) next[intent.key] = at;
  return next;
}
