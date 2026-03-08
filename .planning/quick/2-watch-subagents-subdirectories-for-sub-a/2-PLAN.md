---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/agentManager.ts]
autonomous: true
requirements: [QUICK-2]

must_haves:
  truths:
    - "Sub-agent JSONL files in session/subagents/ directories are discovered and tracked"
    - "New sub-agent JSONL files appearing at runtime are detected via watchers"
    - "All watchers are cleaned up on dispose()"
  artifacts:
    - path: "src/agentManager.ts"
      provides: "Sub-agent discovery and watching"
      contains: "subagents"
  key_links:
    - from: "discoverAgents()"
      to: "trackAgent()"
      via: "scanning subagents subdirectories"
      pattern: "subagents.*trackAgent"
---

<objective>
Watch subagents subdirectories for sub-agent JSONL files in AgentManager.

Purpose: Claude Code stores sub-agent transcripts in `{session-uuid}/subagents/agent-{id}.jsonl` subdirectories, but the current AgentManager only watches for top-level JSONL files. Sub-agents are never discovered.

Output: Updated agentManager.ts that discovers and watches sub-agent JSONL files.
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
  <name>Task 1: Add sub-agent discovery and watching to AgentManager</name>
  <files>src/agentManager.ts</files>
  <action>
Modify discoverAgents() in src/agentManager.ts to discover sub-agent JSONL files in session subdirectories. Add three capabilities:

**1. Scan existing session directories for subagents (in discoverAgents, after the top-level JSONL scan):**

After the existing `for (const file of files)` loop that scans top-level .jsonl files, add a second pass over the same `files` array. For each entry that is a directory (use `stat.isDirectory()`), check if it has a `subagents/` subdirectory. If so, read all `.jsonl` files in that subagents dir and call `this.trackAgent()` for each one that was modified within RECENT_THRESHOLD_MS. Call `this.watchSubagentsDir()` on the subagents path.

If the session directory exists but has no `subagents/` subdir yet, call `this.watchSessionDirForSubagents(sessionDirPath)` to detect when the subagents dir appears later.

**2. Add `watchSessionDirForSubagents(sessionDirPath: string)` private method:**

Use `fs.watch()` on the session directory. When a `subagents` directory appears (eventType change/rename, filename === 'subagents'), check if it's a directory with `fs.existsSync` + `fs.statSync().isDirectory()`. If so, call `this.watchSubagentsDir()` on the subagents path, then close this session-level watcher (it's no longer needed). Store the watcher in `this.watchers` with key `__sessiondir__${sessionDirPath}`.

**3. Add `watchSubagentsDir(subagentsDirPath: string)` private method:**

Use `fs.watch()` on the subagents directory. When a new .jsonl file appears, call `this.trackAgent()` with the full path (if not already tracked). Store in `this.watchers` with key `__subagentsdir__${subagentsDirPath}`.

**4. Update the existing top-level directory watcher** (the `fs.watch(claudeDir, ...)` block):

In addition to the existing check for `.jsonl` files, also detect new directories. When a new directory appears (filename doesn't end in .jsonl, and `fs.statSync` shows it's a directory), call `this.watchSessionDirForSubagents()` on it.

Wrap all fs.stat/fs.readdir calls in try/catch (files may disappear between readdir and stat). Use the same RECENT_THRESHOLD_MS filter for sub-agent files. All new watchers are stored in this.watchers map so dispose() cleans them up automatically (the existing dispose loop handles this).
  </action>
  <verify>npx tsc --noEmit 2>&1 | head -20</verify>
  <done>
    - discoverAgents() scans session dirs for subagents/*.jsonl and tracks them
    - New session directories are watched for subagents/ subdirs appearing
    - New .jsonl files in subagents/ dirs are detected and tracked at runtime
    - All watchers stored in this.watchers for cleanup on dispose()
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes
- Manual verification: with Claude Code running sub-agents, the extension discovers and displays them in the orchestration panel
</verification>

<success_criteria>
Sub-agent JSONL files in session/subagents/ directories are discovered, watched, and tracked identically to top-level session JSONL files.
</success_criteria>

<output>
After completion, create `.planning/quick/2-watch-subagents-subdirectories-for-sub-a/2-SUMMARY.md`
</output>
