# T01: 17.4-fix-agent-discovery-pipeline 01

**Slice:** S14 — **Milestone:** M002

## Description

Fix three bugs in the agent discovery pipeline: (1) filter out root-level parent conversation JSONL files so only subagent files spawn avatars, (2) read companion meta.json files for authoritative sub-agent classification instead of unreliable JSONL transcript scanning, (3) add deduplication guard in RoomCanvas.tsx agentCreated handler to prevent duplicate spawn side effects.

Purpose: Parent conversations and duplicate spawns clutter the room with phantom avatars that don't represent actual working sub-agents.
Output: Corrected agent discovery with clean subagent-only spawning.

## Must-Haves

- [ ] "Root-level JSONL files (parent conversations) do not spawn avatars in the room"
- [ ] "Sub-agent classification reads meta.json agentType field as authoritative source"
- [ ] "Duplicate agentCreated messages do not cause duplicate spawn side effects"

## Files

- `src/agentManager.ts`
- `src/agentClassifier.ts`
- `src/RoomCanvas.tsx`
- `tests/agentClassifier.test.ts`
