---
phase: quick-4
plan: 01
subsystem: agent-lifecycle
tags: [fs-watch, agent-despawn, file-deletion, teleport-booth]

requires:
  - phase: 16-agent-factory-workflow
    provides: AgentManager with agent tracking, teleport booth despawn flow in RoomCanvas

provides:
  - File deletion detection for sub-agent JSONL files
  - agentRemoved message triggering walk-to-booth despawn animation

affects: [agent-lifecycle, room-canvas-despawn]

tech-stack:
  added: []
  patterns: [dual-detection with fs.watch + periodic fallback, collect-then-mutate for Map iteration]

key-files:
  created: []
  modified: [src/agentManager.ts]

key-decisions:
  - "Dual detection: fs.watch callback + periodic checkIdleAgents fallback for reliable deletion detection across OS/filesystem combinations"
  - "Collect-then-remove pattern in checkIdleAgents to avoid mutating Map during iteration"

patterns-established:
  - "removeAgent() as single cleanup method for agent despawn — send message, dispose watcher, delete state"

requirements-completed: [QUICK-4]

duration: 1min
completed: 2026-03-09
---

# Quick Task 4: Auto-despawn Agents Through Teleport Booth Summary

**File deletion detection in AgentManager sends agentRemoved to trigger walk-to-booth despawn with teleport flash effect**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-09T17:04:36Z
- **Completed:** 2026-03-09T17:05:34Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `removeAgent()` private method that sends `agentRemoved`, disposes per-file watcher, and cleans up agent state
- `watchSubagentsDir` now detects both file creation AND deletion events
- `checkIdleAgents` includes periodic file existence fallback for missed fs.watch events
- Dual detection ensures reliable despawn across macOS, Linux, and different filesystem behaviors

## Task Commits

Each task was committed atomically:

1. **Task 1: Detect JSONL file deletion and send agentRemoved** - `ddf45c6` (feat)

## Files Created/Modified
- `src/agentManager.ts` - Added removeAgent() method, file deletion detection in watchSubagentsDir, file existence fallback in checkIdleAgents

## Decisions Made
- Dual detection approach (fs.watch + periodic check) ensures reliable deletion detection across OS/filesystem combinations where fs.watch may miss events
- Collect-then-remove pattern avoids mutating the agents Map during iteration in checkIdleAgents

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Agent despawn flow is now complete end-to-end: file deletion triggers agentRemoved, which triggers RoomCanvas walk-to-booth and teleport flash animation
- No blockers

---
*Phase: quick-4*
*Completed: 2026-03-09*
