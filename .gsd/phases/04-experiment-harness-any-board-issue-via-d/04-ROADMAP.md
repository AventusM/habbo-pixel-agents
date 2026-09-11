# M004: Experiment harness - any board issue via dynamic opencode-go models, visualized in the room

**Vision:** Dispatch any GitHub/ADO board issue to N dynamically-chosen opencode-go models in isolated worktrees, capture per-section work as append-only JSONL via deterministic turn-end hooks, and watch runs as persistent room agents with an on-screen per-agent history - so builder configurations can be compared repeatably and visibly. Draft PRs only, human merges, main untouched; the worker PR is the evaluation artifact.

## Success Criteria

- Repeatable dispatch of any board issue to N dynamically-chosen opencode-go models
- Uniform per-run JSONL section capture via turn-end hooks (loop translator as backstop)
- In-room persistent agents (dynamic N) + per-agent history visualization
- Reusable, safe (drafts only, isolated worktrees, main untouched, human merges; worker PR is the evaluation artifact)

## Slices

- [ ] **S01: Capture schema + translators (zeroshot vs loop sections)** `risk:medium` `depends:[]`
  > After this: Translator converts a zeroshot sample run and gsd-loop artifacts (e.g. #79/#92) into uniform per-run JSONL section records; unit tests pass on fixtures.

- [ ] **S02: Dispatch harness - any board issue to N dynamic opencode-go models** `[sketch]` `risk:medium` `depends:[S01]`
  > After this: A benchmark issue is dispatched to 2+ dynamically-chosen opencode-go models; namespaced draft PRs open; per-run hook records emitted.

- [ ] **S03: Room agents (dynamic N) + history panel** `[sketch]` `risk:medium` `depends:[S01,S02]`
  > After this: A simultaneous multi-model run renders one room agent per active run plus a viewport history panel with per-agent summaries and PR links; owner gives visual sign-off.

## Boundary Map

Not provided.
<!-- gsd:state-version=17:0 -->
