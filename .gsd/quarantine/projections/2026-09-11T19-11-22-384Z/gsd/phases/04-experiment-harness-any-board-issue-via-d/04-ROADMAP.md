# M004: Experiment harness - any board issue via zeroshot or gsd-loop, visualized in the room

**Vision:** Dispatch any GitHub/ADO board issue to a fixed zeroshot cluster and/or the gsd-loop lanes (both Opencode), capture per-section work as append-only JSONL, and watch both workflows as persistent room agents with an on-screen history of each agent's work summary - so builder configurations can be compared repeatably and visibly.

## Success Criteria

- Repeatable dispatch of any board issue to zeroshot, gsd-loop, or both
- Uniform per-run JSONL section capture for both paths
- In-room persistent agents + per-agent history visualization
- Reusable, safe (drafts only, isolated, main untouched)

## Slices

- [ ] **S01: Capture schema + translators (zeroshot vs loop sections)** `risk:medium` `depends:[]`
  > After this: Translator converts a zeroshot sample run and gsd-loop artifacts (e.g. #79/#92) into uniform per-run JSONL section records; unit tests pass on fixtures.

- [ ] **S02: Dispatch harness - any board issue to either path** `[sketch]` `risk:medium` `depends:[S01]`
  > After this: Pick a board issue and a path (zeroshot / loop / both) from a control; runs execute in isolated worktrees on a fixed base commit and open draft PRs; main untouched.

- [ ] **S03: Room agents + history panel for workflow sections** `[sketch]` `risk:medium` `depends:[S01,S02]`
  > After this: Two persistent workflow agents track current sections via tool-text/speech; a viewport history panel shows per-agent summaries and solution outcomes during a simultaneous run.

## Boundary Map

Not provided.
<!-- gsd:state-version=13:0 -->
