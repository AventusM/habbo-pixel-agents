---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/agentManager.ts]
autonomous: true
requirements: [QUICK-4]

must_haves:
  truths:
    - "When a sub-agent JSONL file is deleted, the agent despawns through its team teleport booth"
    - "When a sub-agent JSONL file watcher fires and the file no longer exists, agentRemoved is sent"
    - "Internal agent state and watchers are cleaned up on file deletion"
  artifacts:
    - path: "src/agentManager.ts"
      provides: "File deletion detection in watchSubagentsDir and per-agent watcher error handling"
      contains: "agentRemoved"
  key_links:
    - from: "src/agentManager.ts"
      to: "RoomCanvas.tsx agentRemoved handler"
      via: "onMessage({ type: 'agentRemoved' })"
      pattern: "type.*agentRemoved"
---

<objective>
Detect sub-agent JSONL file deletion and send agentRemoved to trigger walk-to-booth despawn animation.

Purpose: Currently agents spawn but never despawn when their JSONL files are removed. The RoomCanvas already has a complete despawn flow (walk to booth, teleport flash, remove) — it just never receives the agentRemoved message.

Output: Modified agentManager.ts with file deletion detection.
</objective>

<execution_context>
@/Users/antonmoroz/.claude/get-shit-done/workflows/execute-plan.md
@/Users/antonmoroz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/agentManager.ts
@src/agentTypes.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Detect JSONL file deletion and send agentRemoved</name>
  <files>src/agentManager.ts</files>
  <action>
Two changes needed in agentManager.ts:

1. **In `watchSubagentsDir` method** (line ~388): The `fs.watch` callback currently only handles the case where a file exists and is new. Add handling for when a tracked JSONL file is deleted:

```
// In the fs.watch callback, after the existing "new file" check:
// If the file does NOT exist but we ARE tracking it, the agent's file was deleted
if (!fs.existsSync(filePath) && this.agents.has(filePath)) {
  this.removeAgent(filePath);
}
```

2. **Add a private `removeAgent(jsonlPath)` method** that encapsulates the cleanup:
   - Get the agent state from `this.agents` (return early if not found)
   - Send `agentRemoved` message via `this.onMessage({ type: 'agentRemoved', agentId: agent.agentId })`
   - Dispose and delete the per-file watcher from `this.watchers` for that jsonlPath
   - Delete the agent from `this.agents`
   - Log: `[AgentManager] Agent file removed, despawning: {agentId}`

3. **In the per-agent `watchJsonlFile` watcher** (inside `trackAgent`, line ~324): The `watchJsonlFile` utility watches for file changes. When the file is deleted, the watcher may fire an error or the file may become unreadable. Add a periodic existence check in `checkIdleAgents` as a fallback:

   In `checkIdleAgents` method, after the idle timeout check, add:
   ```
   // Also check if the JSONL file still exists — file deletion fallback
   if (!fs.existsSync(agent.jsonlPath)) {
     this.removeAgent(agent.jsonlPath);
   }
   ```
   Note: Use `for (const [jsonlPath, agent] of this.agents)` instead of destructuring `[, agent]` so we have the key. Collect paths-to-remove in an array first, then iterate and call removeAgent (avoid mutating map during iteration).

This dual approach (subagents dir watcher + periodic check) ensures deletion is caught even if the fs.watch event is missed (which happens on some OS/filesystem combinations).
  </action>
  <verify>
    npm run build 2>&1 | tail -5
  </verify>
  <done>
    - watchSubagentsDir detects file deletion and calls removeAgent
    - checkIdleAgents periodically verifies JSONL files still exist
    - removeAgent sends agentRemoved, disposes watcher, cleans up state
    - Build passes with no errors
  </done>
</task>

</tasks>

<verification>
- `npm run build` succeeds
- Code review: `removeAgent` method exists and sends `agentRemoved` message
- Code review: `watchSubagentsDir` handles both file creation AND deletion
- Code review: `checkIdleAgents` includes file existence fallback
</verification>

<success_criteria>
When a sub-agent's JSONL file is deleted, the AgentManager sends an `agentRemoved` message causing the avatar to walk to its team's teleport booth and despawn with a flash effect.
</success_criteria>

<output>
After completion, create `.planning/quick/4-auto-despawn-agents-through-teleport-boo/4-01-SUMMARY.md`
</output>
