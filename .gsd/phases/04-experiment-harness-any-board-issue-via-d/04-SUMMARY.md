---
id: M004
title: "Experiment harness - any board issue via dynamic opencode-go models, visualized in the room"
status: complete
completed_at: 2026-09-26T09:50:07.992Z
key_decisions:
  - D017 dispatch-first trio (D016 quota policy)
  - D018 evidence-complete close-out precedent
key_files:
  - scripts/exp/dispatch.mjs
  - scripts/exp/schema.json
  - scripts/exp/translate-loop.mjs
  - scripts/exp/hook-record.mjs
  - src/state/expRunStore.ts
  - src/expFeed.ts
  - src/expHistoryPanel.ts
  - src/RoomCanvas.tsx
  - scripts/hooks-feed-mapper.mjs
lessons_learned:
  - Delivery can outrun GSD bookkeeping — sealing with delivery reasons keeps the roadmap truthful (recurring D014 pattern).
  - Deterministic turn-end capture + draft PRs made multi-model comparison repeatable without touching main.
---

# M004: Experiment harness - any board issue via dynamic opencode-go models, visualized in the room

**Experiment harness delivered: dispatch any board issue to N models in isolated worktrees, capture per-run JSONL, watch runs as room agents; owner-directed close-out.**

## What Happened

Delivered across three slices: S01 (commits f757b75/d1a98f4) per-run JSONL schema + deterministic turn-end hook emitter + loop translator with tests and PROBE.md on main; S02 (commit 9f6b5c8) dispatch harness with namespaced branches/worktrees, guards and the worker prompt contract, proven by the exp-97 trio run (PRs #112–114, Kimi ranked verdict, winner #114 per D017); S03 (commits 578eb05/9f6b5c8/94bb0c0 + PR #115) the room side — ExpRunStore, expFeed parsing/summaries/agent mapping, canvas history panel, wired into RoomCanvas/sceneRenderer. The owner directed the close-out and waived a fresh simultaneous multi-model visual demo; verification rests on committed code, 26 exp/hooks tests, the trio run artifacts, and green full-suite + typecheck (.gsd/exec/6f7f03c3-d1d9-43ea-8af3-6a1ce74495f3.stdout). Slices S01–S03 sealed as skipped with delivery reasons (D014 precedent; tasks cascaded). Follow-ups: optional live demo; feed-map v2 names; M005 consumer step.

## Success Criteria Results

All four criteria met — see .gsd/phases/04-experiment-harness-any-board-issue-via-d/04-VALIDATION.md (verdict pass).

## Definition of Done Results

All three slices delivered and sealed; exp suites + full suite + tsc green; dispatch guards exercised; merges remained human.

## Requirement Outcomes

Not provided.

## Deviations

Owner-directed close-out; fresh multi-model visual demo waived; slices sealed as skipped (D014).

## Follow-ups

Optional live demo of the history panel; align prototype feed-map to v2 command names; M005 consumer step (apply inbox intents).
