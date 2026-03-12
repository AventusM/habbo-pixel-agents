# S14: Fix Agent Discovery Pipeline Deduplicate Spawns Filter Parent Conversations Classify Sub Agents Properly

**Goal:** Fix three bugs in the agent discovery pipeline: (1) filter out root-level parent conversation JSONL files so only subagent files spawn avatars, (2) read companion meta.
**Demo:** Fix three bugs in the agent discovery pipeline: (1) filter out root-level parent conversation JSONL files so only subagent files spawn avatars, (2) read companion meta.

## Must-Haves


## Tasks

- [x] **T01: 17.4-fix-agent-discovery-pipeline 01** `est:2min`
  - Fix three bugs in the agent discovery pipeline: (1) filter out root-level parent conversation JSONL files so only subagent files spawn avatars, (2) read companion meta.json files for authoritative sub-agent classification instead of unreliable JSONL transcript scanning, (3) add deduplication guard in RoomCanvas.tsx agentCreated handler to prevent duplicate spawn side effects.

Purpose: Parent conversations and duplicate spawns clutter the room with phantom avatars that don't represent actual working sub-agents.
Output: Corrected agent discovery with clean subagent-only spawning.

## Files Likely Touched

- `src/agentManager.ts`
- `src/agentClassifier.ts`
- `src/RoomCanvas.tsx`
- `tests/agentClassifier.test.ts`
