---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/agentManager.ts]
autonomous: true
requirements: [QUICK-3]

must_haves:
  truths:
    - "Only sub-agents from the current active session appear as avatars"
    - "Stale agents from completed past sessions do not spawn"
    - "New sub-agents spawning in the active session are still detected"
  artifacts:
    - path: "src/agentManager.ts"
      provides: "Active-session-only agent discovery"
      contains: "findActiveSessionDir"
  key_links:
    - from: "discoverAgents()"
      to: "findActiveSessionDir()"
      via: "filters session dirs to only the active one"
      pattern: "findActiveSessionDir"
---

<objective>
Restrict agent discovery to only the current active Claude Code session, preventing stale agents from past sessions from appearing.

Purpose: The agent manager currently scans ALL session directories under the Claude project dir, causing completed/old session sub-agents to appear as if still working. Only the current active session's sub-agents should be tracked.

Output: Modified agentManager.ts that identifies the active session and only discovers sub-agents from it.
</objective>

<execution_context>
@/Users/antonmoroz/.claude/get-shit-done/workflows/execute-plan.md
@/Users/antonmoroz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/agentManager.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restrict discovery to active session only</name>
  <files>src/agentManager.ts</files>
  <action>
Add a private method `findActiveSessionDir(claudeDir: string): string | null` that:
1. Reads all entries in `claudeDir`
2. For each directory entry, checks if a root-level JSONL file exists (the parent conversation file — these are files directly in the session dir, NOT in subagents/)
3. Gets the mtime of each root-level JSONL file found
4. Returns the session directory path whose root JSONL has the most recent mtime
5. Returns null if no session directories with JSONL files exist

Then modify `discoverAgents()` to:
1. Call `findActiveSessionDir(claudeDir)` to get the single active session dir
2. If null, log and return early
3. Only scan that ONE session directory for `subagents/*.jsonl` files (existing logic from the for-loop, but applied to just the active session dir)
4. Only call `watchSubagentsDir` or `watchSessionDirForSubagents` on the active session dir
5. Keep the top-level `fs.watch(claudeDir)` watcher but modify it: when a new session directory appears, check if it becomes the new active session (has a more recently modified root JSONL). If so, dispose all existing agent watchers (but NOT the top-level dir watcher), clear the agents map, send `agentRemoved` messages for each cleared agent, and re-discover from the new active session. This handles the case where the user starts a new Claude Code session.

For the `agentRemoved` message, check if it already exists in `ExtensionMessage` type. If not, add a new message type `{ type: 'agentRemoved'; agentId: string }` to the union in `agentTypes.ts`. The webview should already handle unknown message types gracefully (ignore them), so no webview changes are needed for now — the avatar will simply stop receiving updates and eventually idle out.

Important implementation details:
- The root JSONL file in a session dir has the same name as the directory (e.g., `abc123/abc123.jsonl`) OR could be any `.jsonl` file directly in the session dir (not in subagents/). Use the most recently modified one.
- Keep the `RECENT_THRESHOLD_MS` check for individual sub-agent JSONL files within the active session.
- Log which session was identified as active: `[AgentManager] Active session: {dirname} (root JSONL modified {N}s ago)`
  </action>
  <verify>npx tsc --noEmit 2>&1 | head -20</verify>
  <done>Agent discovery only scans the single most-recently-active session directory. Old session sub-agents are never tracked. New session detection triggers cleanup and re-discovery.</done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors: `npx tsc --noEmit`
- Manual verification: with multiple session dirs in ~/.claude/projects/, only the active session's sub-agents should be logged as tracked
</verification>

<success_criteria>
- `discoverAgents()` identifies the active session by most-recent root JSONL mtime
- Only that session's subagents/ directory is scanned and watched
- When a new session becomes active, old agents are cleaned up
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/3-only-discover-sub-agents-from-the-curren/3-SUMMARY.md`
</output>
