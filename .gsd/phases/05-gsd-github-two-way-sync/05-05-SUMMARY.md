---
id: S05
parent: M005
milestone: M005
provides:
  - "GitHub→GSD first hop: verified webhook deliveries become exactly-once, loop-guarded sync intents"
requires: []
affects:
  - scripts/web-server.mjs
key_files:
  - scripts/gsd-github-sync.mjs
  - scripts/gsd-github-sync.d.mts
  - scripts/web-server.mjs
  - tests/gsd-github-sync.test.ts
key_decisions:
  - "Sync intents land in .gsd/runtime/github-sync/inbox.jsonl plus a GSD notification; DB application stays consumer-side (agents/MCP), keeping the webhook free of GSD-internal writes"
patterns_established:
  - "Pure-classifier + thin-wiring split for webhook integrations (mirrors hooks-feed-mapper)"
observability_surfaces:
  - .gsd/runtime/github-sync/inbox.jsonl
  - .gsd/runtime/github-sync/state.json
  - .gsd/notifications.jsonl (source: github-sync)
drill_down_paths: []
duration: 45m
verification_result: passed
completed_at: 2026-09-26
---

# S05: GitHub→GSD webhook branch

**Verified webhook deliveries become exactly-once GitHub→GSD sync intents, loop-guarded.**

## What Happened

- `scripts/gsd-github-sync.mjs` (pure module): `parseTitlePrefix` for M00X(/S0X) titles; `classifyGithubSyncEvent` with loop guards — `issues` event only, closed/reopened transitions only, prefix required, bot senders (`[bot]` / `type: Bot`) and `<!-- gsd-sync -->` bodies ignored, `hop` stamped 1; stable dedupe key (issue + action + transition timestamp); `toNotification` builds the notification-store row.
- `scripts/web-server.mjs`: sync branch inside `handleGithubWebhook` right after HMAC verification; accepted intents append to `.gsd/runtime/github-sync/inbox.jsonl`, update the `state.json` dedupe map, and append a `.gsd/notifications.jsonl` row. Entirely try/catch'd so the 202 contract cannot break; board debounce untouched.
- Commits: `8f1be59` (module + guards + tests), `b7fce38` (wiring).

## Verification

- `npx vitest run`: 48 files / 673 tests green (11 new for the classifier).
- `npx tsc --noEmit` clean; `node --check scripts/web-server.mjs` ok.
- Signed smoke on the live server (`PORT=3457`, `WEBHOOK_SECRET`): two identical `issues.closed` deliveries → `202` twice; inbox exactly **1** line; `state.json` holds the dedupe key; notification row `GitHub #9999 (M005/S05) closed — sync intent queued`.

## Forward Intelligence

### What the next slice should know
- Inbox contract: one JSON object per line — `{ v, kind: 'github-sync-intent', ts, action: 'issues.closed'|'issues.reopened', issue, title, milestoneId, sliceId|null, actor, hop: 1, key }`.
- S06 (GSD→GitHub) must carry the `<!-- gsd-sync -->` marker on bot comments so S05's guard ignores the echo, and honor the same one-hop rule; this slice's dedupe-key pattern is the reference.
- Applying intents to GSD state (evidence/flags) is the consumer side's job (agent/auto pass reading the inbox via MCP tools) — S07's round-trip should define and prove that consumption step.

### What's fragile
- `state.json` is an unbounded map; prune if webhook volume grows.
- The receiver still requires the compiled board bundle (`boardHelpers`) — the sync branch runs on that same path.
