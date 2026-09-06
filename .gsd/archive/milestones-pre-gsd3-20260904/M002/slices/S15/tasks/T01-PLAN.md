# T01: 17.5-auto-despawn-agents-on-task-completion 01

**Slice:** S15 — **Milestone:** M002

## Description

Add auto-despawn for sub-agents that have completed their tasks, detected by reading the last JSONL line for `stop_reason: "end_turn"` combined with a file staleness check (15 seconds since last modification).

Purpose: Currently agents persist in the room forever after task completion because their JSONL files remain on disk. This makes the room cluttered with inactive avatars.
Output: Modified `src/agentManager.ts` with completion detection, plus new test file.

## Must-Haves

- [ ] "Completed sub-agents (end_turn + 15s stale) are automatically despawned"
- [ ] "Still-running agents (tool_use or recent end_turn) are NOT despawned"
- [ ] "Corrupt or partial JSONL last lines are silently skipped without crashing"

## Files

- `src/agentManager.ts`
- `tests/agentManager.test.ts`
