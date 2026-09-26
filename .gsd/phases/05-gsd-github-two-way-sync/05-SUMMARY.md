---
id: M005
title: "GSD↔GitHub Two-Way Sync"
status: complete
completed_at: 2026-09-26T09:37:07.135Z
key_decisions:
  - D024 file-queue intents with exactly-once dedupe
  - D025 guarded activation model for reactions
  - D026 gsd:synced label echo guard
key_files:
  - scripts/gsd-github-sync.mjs
  - scripts/gsd-github-reactions.mjs
  - scripts/hooks/gsd-event-hook.mjs
  - scripts/web-server.mjs
  - tests/gsd-github-sync.test.ts
  - tests/gsd-github-reactions.test.ts
  - tests/gsd-event-hook.test.ts
lessons_learned:
  - UAT rehearsals catch protocol gaps unit tests cannot see — the user-actor echo only surfaced when the loop was run live (D026).
  - Comment/text markers cannot travel on close payloads; a payload-visible label is the reliable echo guard.
---

# M005: GSD↔GitHub Two-Way Sync

**GitHub↔GSD sync live in both directions: close/reopen → exactly-once intents; slice transitions → label+comment+close; echoes ignored (D024–D026).**

## What Happened

Delivered in three slices. S05 (commits 8f1be59/b7fce38, PR #116): a pure classifier turns signed webhook deliveries into exactly-once sync intents (title-prefix parse; guards: issues-only, closed/reopened transitions, bot/marker/label ignores; dedupe state) and the webhook receiver records them to .gsd/runtime/github-sync/inbox.jsonl plus a GSD notification. S06 (commits 8fac12d/a444395, PR #117): a pure reactions classifier (complete-slice → comment+close; skip-slice → comment) plus safe-by-default hook activation (--github live, --dry-run read-only, event-hash dedupe, historical no-replay). S07 (commit 8b94c46 + live UAT): a read-only reconcile found 18 agreeing issue↔GSD pairs and zero real stragglers; the live round trip on 2026-09-26 proved the loop — scratch #118 close/reopen each produced exactly one intent, a fixture complete-slice labeled (gsd:synced), commented (marker) and closed #110, and the labeled close delivery was ignored (inbox 3→3, no oscillation). The UAT surfaced one real gap: reactions run as the repo user, so the comment marker alone could not suppress the echo — fixed in-slice by the D026 label protocol. Slices S05–S07 sealed as skipped with delivery reasons (D014 precedent); consumer-side application of inbox intents remains an explicit follow-up (D024).

## Success Criteria Results

All three roadmap criteria proven live — see .gsd/phases/05-gsd-github-two-way-sync/05-VALIDATION.md (verdict pass).

## Definition of Done Results

Both halves implemented + guarded; live round trip converged on real GitHub state (#118 close/reopen intents; #110 labeled+closed; labeled echo ignored); 684 tests + tsc green.

## Requirement Outcomes

Not provided.

## Deviations

Delivery via PRs/direct commits; slices sealed as skipped (D014); consumer-side DB application deferred by design (D024).

## Follow-ups

Consumer: apply inbox intents to canonical slice state via MCP (agent/auto pass); optional real webhook endpoint wiring (public URL); #118 left open for manual replay; align the prototype feed-map to v2 command names.
