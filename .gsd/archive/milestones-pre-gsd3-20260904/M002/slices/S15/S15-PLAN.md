# S15: Auto Despawn Agents On Task Completion

**Goal:** Add auto-despawn for sub-agents that have completed their tasks, detected by reading the last JSONL line for `stop_reason: "end_turn"` combined with a file staleness check (15 seconds since last modification).
**Demo:** Add auto-despawn for sub-agents that have completed their tasks, detected by reading the last JSONL line for `stop_reason: "end_turn"` combined with a file staleness check (15 seconds since last modification).

## Must-Haves


## Tasks

- [x] **T01: 17.5-auto-despawn-agents-on-task-completion 01** `est:2min`
  - Add auto-despawn for sub-agents that have completed their tasks, detected by reading the last JSONL line for `stop_reason: "end_turn"` combined with a file staleness check (15 seconds since last modification).

Purpose: Currently agents persist in the room forever after task completion because their JSONL files remain on disk. This makes the room cluttered with inactive avatars.
Output: Modified `src/agentManager.ts` with completion detection, plus new test file.

## Files Likely Touched

- `src/agentManager.ts`
- `tests/agentManager.test.ts`
