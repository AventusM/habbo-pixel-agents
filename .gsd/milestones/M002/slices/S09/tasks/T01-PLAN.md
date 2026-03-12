# T01: 16-agent-factory-workflow 01

**Slice:** S09 — **Milestone:** M002

## Description

Build the agent classification system that maps JSONL transcript data to roles, teams, and display names.

Purpose: Foundation for all role-based features (outfits, section assignment, idle behaviors, sidebar grouping). Without classification, agents have no identity beyond "Claude N".
Output: `agentClassifier.ts` with classification pipeline, extended `agentTypes.ts`, and comprehensive tests.

## Must-Haves

- [ ] "Agents with subagent_type in JSONL are classified into correct role and team"
- [ ] "Agents without subagent_type trigger a classification request (popup signal)"
- [ ] "Agent display names follow '<Role> - <Task>' format"
- [ ] "Role-to-team mapping covers all GSD subagent types"

## Files

- `src/agentClassifier.ts`
- `src/agentTypes.ts`
- `tests/agentClassifier.test.ts`
