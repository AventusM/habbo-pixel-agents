# M004: Experiment harness - any board issue via dynamic opencode-go models, visualized in the room

**Vision:** Dispatch any GitHub/ADO board issue to N dynamically-chosen opencode-go models in isolated worktrees, capture per-section work as append-only JSONL via deterministic turn-end hooks, and watch runs as persistent room agents with an on-screen per-agent history - so builder configurations can be compared repeatably and visibly. Draft PRs only, human merges, main untouched; the worker PR is the evaluation artifact.

## Success Criteria

- Repeatable dispatch of any board issue to N dynamically-chosen opencode-go models
- Uniform per-run JSONL section capture via turn-end hooks (loop translator as backstop)
- In-room persistent agents (dynamic N) + per-agent history visualization
- Reusable, safe (drafts only, isolated worktrees, main untouched, human merges; worker PR is the evaluation artifact)

## Slices

## Boundary Map

Not provided.
<!-- gsd:state-version=102:0 -->
