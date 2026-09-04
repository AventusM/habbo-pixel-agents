# T05: 16-agent-factory-workflow 05

**Slice:** S09 — **Milestone:** M002

## Description

Integrate agent classification into the agent discovery pipeline so agents are automatically classified on spawn and assigned to teams.

Purpose: Connects the classification logic (Plan 01) with the agent lifecycle, so every agent gets a role, team, and display name before the webview renders them.
Output: Updated agentManager.ts with classification step, extended transcript parsing, and webview messaging.

## Must-Haves

- [ ] "Agent classification runs automatically when JSONL session is discovered"
- [ ] "Agents without subagent_type trigger a VS Code input prompt for manual classification"
- [ ] "Classified agents have correct display names in '<Role> - <Task>' format"
- [ ] "Classification data is sent to webview via ExtensionMessage"

## Files

- `src/agentManager.ts`
- `src/transcriptParser.ts`
- `src/agentTypes.ts`
- `src/extension.ts`
