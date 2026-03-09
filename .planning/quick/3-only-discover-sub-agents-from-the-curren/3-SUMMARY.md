---
phase: quick-3
plan: 01
subsystem: agent-discovery
tags: [agent-manager, session-filtering, cleanup]
dependency_graph:
  requires: []
  provides: [active-session-only-discovery]
  affects: [agentManager]
tech_stack:
  added: []
  patterns: [active-session-detection, session-switching-with-cleanup]
key_files:
  modified:
    - src/agentManager.ts
decisions:
  - findActiveSessionDir selects session by most recent root JSONL mtime
  - switchToSession disposes all agent watchers except top-level dir watcher
  - agentRemoved sent for each stale agent during session switch
metrics:
  duration: 1min
  completed: "2026-03-09"
---

# Quick Task 3: Only Discover Sub-Agents from the Current Active Session

Active-session-only agent discovery using root JSONL mtime to identify the current Claude Code session, preventing stale agents from past sessions from spawning avatars.

## Task Results

### Task 1: Restrict discovery to active session only

| Field | Value |
|-------|-------|
| Status | Complete |
| Commit | 033e1cd |
| Files | src/agentManager.ts |

Added `findActiveSessionDir(claudeDir)` that scans all session directories, finds root-level JSONL files (parent conversation files), and returns the session directory whose root JSONL has the most recent mtime. The `discoverAgents()` method now only scans that single active session for `subagents/*.jsonl` files.

Added `scanAndWatchSession()` to encapsulate per-session scanning and watcher setup. Added `switchToSession()` that disposes all agent-level watchers (preserving the top-level dir watcher), sends `agentRemoved` for each tracked agent, clears the agents map, then re-discovers from the new session.

The top-level `fs.watch(claudeDir)` watcher now detects new session directories and calls `findActiveSessionDir()` to check if the new directory becomes the active session, triggering a full switchover if so.

## Deviations from Plan

None - plan executed exactly as written. The `agentRemoved` message type already existed in `agentTypes.ts`, so no type changes were needed.

## Verification

- TypeScript compiles without errors (pre-existing test type errors in messageBridge.test.ts are unrelated)
- Active session identified by most recent root JSONL mtime
- Only active session's subagents/ scanned and watched
- Session switching cleans up old agents and re-discovers

## Self-Check: PASSED
